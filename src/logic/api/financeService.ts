import { supabase } from './supabase';
import type { Payment, UUID } from '../../domain/types';

export interface Shift {
    id: UUID;
    colaborador_id: UUID;
    colaborador_nombre?: string; // Optional in DB, joined
    horario: 'matutino' | 'vespertino';
    hora_inicio: string;
    hora_cierre?: string;
    total_efectivo: number;
    estatus: 'abierto' | 'cerrado';
}

export async function getPayments(): Promise<Payment[]> {
    const { data, error } = await supabase
        .from('payments')
        .select('*')
        .order('fecha_pago', { ascending: false });

    if (error) {
        console.error('Error getting payments:', error);
        return [];
    }
    return data as Payment[];
}

export async function getCurrentShift(): Promise<Shift | null> {
    const { data, error } = await supabase
        .from('shifts')
        .select('*')
        .eq('estatus', 'abierto')
        .single();

    if (error || !data) return null;
    return data as Shift;
}

export async function closeShift(shiftId: string, declaredCash: number): Promise<{ success: boolean; difference: number }> {
    const { data: shift, error: fetchError } = await supabase
        .from('shifts')
        .select('total_efectivo')
        .eq('id', shiftId)
        .single();

    if (fetchError || !shift) return { success: false, difference: 0 };

    const diff = declaredCash - shift.total_efectivo;
    const now = new Date().toISOString();

    const { error: updateError } = await supabase
        .from('shifts')
        .update({ estatus: 'cerrado', hora_cierre: now })
        .eq('id', shiftId);

    if (updateError) return { success: false, difference: 0 };

    return { success: true, difference: diff };
    return { success: true, difference: diff };
}

export async function openShift(userId: string, initialCash: number): Promise<boolean> {
    const hour = new Date().getHours();
    const horario = hour < 14 ? 'matutino' : 'vespertino';

    const { error } = await supabase.from('shifts').insert({
        colaborador_id: userId,
        horario: horario,
        hora_inicio: new Date().toISOString(),
        total_efectivo: initialCash,
        estatus: 'abierto'
    });

    if (error) {
        console.error('Error opening shift:', error);
        return false;
    }
    return true;
}

export async function registerPayment(payment: Omit<Payment, 'id'>): Promise<boolean> {
    // 1. Get Open Shift
    const currentShift = await getCurrentShift();
    let shiftId = currentShift?.id;

    if (!shiftId && payment.metodo_pago === 'efectivo') {
        // Warning but proceed
    }

    // 2. Insert Payment
    const { error: insertError } = await supabase
        .from('payments')
        .insert({
            ...payment,
            turno_id: shiftId
        });

    if (insertError) {
        console.error('Error inserting payment', insertError);
        return false;
    }

    // 3. Update Subscription if Plan/User present (Membership Payment)
    if (payment.usuario_id && payment.plan_id) {
        try {
            // Get Plan Duration
            const { data: plan } = await supabase.from('plans').select('duracion_dias').eq('id', payment.plan_id).single();

            if (plan) {
                // Get Latest Sub to decide: Extend or New
                const { data: subs } = await supabase
                    .from('subscriptions')
                    .select('*')
                    .eq('usuario_id', payment.usuario_id)
                    .order('fecha_vencimiento', { ascending: false })
                    .limit(1);

                const latestSub = subs?.[0];
                const now = new Date();

                let isExtension = false;

                // Check if active (not expired)
                if (latestSub) {
                    const expiry = new Date(latestSub.fecha_vencimiento);
                    if (expiry > now) {
                        isExtension = true;
                    }
                }

                if (isExtension && latestSub) {
                    // EXTEND existing
                    const currentEnd = new Date(latestSub.fecha_vencimiento);
                    const newEnd = new Date(currentEnd.getTime() + (plan.duracion_dias * 24 * 60 * 60 * 1000));

                    await supabase.from('subscriptions').update({
                        fecha_vencimiento: newEnd.toISOString(),
                        estatus: 'activa', // Ensure active
                        plan_id: payment.plan_id // Switch plan if changed
                    }).eq('id', latestSub.id);

                } else {
                    // NEW Subscription
                    const startDate = now;
                    const endDate = new Date(startDate.getTime() + (plan.duracion_dias * 24 * 60 * 60 * 1000));

                    await supabase.from('subscriptions').insert({
                        usuario_id: payment.usuario_id,
                        plan_id: payment.plan_id,
                        fecha_inicio: startDate.toISOString(),
                        fecha_vencimiento: endDate.toISOString(),
                        estatus: 'activa'
                    });
                }
            }
        } catch (e) {
            console.error('Error updating subscription logic', e);
        }
    }

    // 4. Update Shift Cash if needed
    if (shiftId && payment.metodo_pago === 'efectivo') {
        const newTotal = (currentShift?.total_efectivo || 0) + payment.total;
        await supabase.from('shifts').update({ total_efectivo: newTotal }).eq('id', shiftId);
    }

    return true;
}
