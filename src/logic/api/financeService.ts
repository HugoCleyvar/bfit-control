import { supabase } from './supabase';
import type { Payment, Shift, CashCount, Expense } from '../../domain/types';
import { calculateNominalExpiration } from '../../domain/dateUtils';

export interface PaymentWithDetails extends Payment {
    member?: { nombre: string; apellido: string; telefono?: string };
    plan?: { nombre: string; duracion_dias: number };
}

export async function getPayments(limit = 50): Promise<PaymentWithDetails[]> {
    const { data, error } = await supabase
        .from('payments')
        .select(`
            *,
            member:members (
                nombre,
                apellido,
                telefono
            ),
            plan:plans (
                nombre,
                duracion_dias
            )
        `)
        .order('fecha_pago', { ascending: false })
        .limit(limit);

    if (error) {
        console.error('Error getting payments:', error);
        return [];
    }
    return data as PaymentWithDetails[];
}

export async function getMemberPayments(memberId: string, limit = 5): Promise<PaymentWithDetails[]> {
    const { data, error } = await supabase
        .from('payments')
        .select(`
            *,
            member:members (
                nombre,
                apellido,
                telefono
            ),
            plan:plans (
                nombre,
                duracion_dias
            )
        `)
        .eq('usuario_id', memberId)
        .order('fecha_pago', { ascending: false })
        .limit(limit);

    if (error) {
        console.error('Error getting member payments:', error);
        return [];
    }
    return data as PaymentWithDetails[];
}


export async function getTodayIncome(): Promise<number> {
    const todayStr = new Date().toISOString().split('T')[0];
    const { data, error } = await supabase
        .from('payments')
        .select('total')
        .gte('fecha_pago', `${todayStr}T00:00:00`);

    if (error || !data) return 0;

    // Sum purely on client side for now, safer execution
    return data.reduce((sum, p) => sum + p.total, 0);
}

// New Admin function to see ALL open shifts
export async function getActiveShifts(): Promise<(Shift & { profiles: { nombre: string } })[]> {
    const { data, error } = await supabase
        .from('shifts')
        .select('*, profiles(nombre)')
        .eq('estatus', 'abierto');

    if (error) {
        console.error('Error getting active shifts:', error);
        return [];
    }
    return (data || []) as (Shift & { profiles: { nombre: string } })[];
}

// New Admin function to see Shift History
export async function getShiftHistory(limit = 20): Promise<(Shift & { profiles: { nombre: string } })[]> {
    const { data, error } = await supabase
        .from('shifts')
        .select('*, profiles(nombre)')
        .eq('estatus', 'cerrado')
        .order('hora_cierre', { ascending: false })
        .limit(limit);

    if (error) {
        console.error('Error getting shift history:', error);
        return [];
    }
    return (data || []) as (Shift & { profiles: { nombre: string } })[];
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

export async function getShiftExpenses(shiftId: string): Promise<Expense[]> {
    const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .eq('turno_id', shiftId)
        .order('fecha_hora', { ascending: false });

    if (error) return [];
    return data as Expense[];
}

export async function registerExpense(shiftId: string, amount: number, concept: string, userId: string): Promise<boolean> {
    // 1. Create Expense Record
    const { error: expError } = await supabase
        .from('expenses')
        .insert({
            turno_id: shiftId,
            monto: amount,
            concepto: concept,
            usuario_id: userId
        });

    if (expError) return false;

    // 2. Update Shift (Increase withdrawals, Decrease total cash in hand)
    const { data: shift } = await supabase.from('shifts').select('retiros, total_efectivo').eq('id', shiftId).single();

    if (!shift) return false;

    const newRetiros = (shift.retiros || 0) + amount;
    const newTotal = (shift.total_efectivo || 0) - amount;

    const { error: shiftError } = await supabase
        .from('shifts')
        .update({
            retiros: newRetiros,
            total_efectivo: newTotal
        })
        .eq('id', shiftId);

    return !shiftError;
}

export async function closeShift(shiftId: string, cashCount: CashCount, totalDeclared: number): Promise<{ success: boolean; difference: number }> {
    const { data: shift, error: fetchError } = await supabase
        .from('shifts')
        .select('total_efectivo')
        .eq('id', shiftId)
        .single();

    if (fetchError || !shift) return { success: false, difference: 0 };

    const diff = totalDeclared - shift.total_efectivo;
    const now = new Date().toISOString();

    const { error: updateError } = await supabase
        .from('shifts')
        .update({
            estatus: 'cerrado',
            hora_cierre: now,
            desglose_cierre: cashCount // Store the JSON breakdown
        })
        .eq('id', shiftId);

    if (updateError) return { success: false, difference: 0 };

    return { success: true, difference: diff };
}

export async function openShift(userId: string, initialCash: number): Promise<boolean> {
    const hour = new Date().getHours();
    const horario = hour < 14 ? 'matutino' : 'vespertino';

    const { error } = await supabase.from('shifts').insert({
        colaborador_id: userId,
        horario: horario,
        hora_inicio: new Date().toISOString(),
        total_efectivo: initialCash, // Starts with initial fund
        monto_inicial: initialCash,
        retiros: 0,
        estatus: 'abierto'
    });

    if (error) {
        console.error('Error opening shift:', error);
        return false;
    }
    return true;
}

export async function registerPayment(payment: Omit<Payment, 'id'> & { force?: boolean }): Promise<{ success: boolean; message?: string }> {
    // 0. Double Payment Protection (5 min rule)
    if (!payment.force) {
        const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
        const { data: duplicates } = await supabase
            .from('payments')
            .select('id')
            .eq('usuario_id', payment.usuario_id)
            .eq('total', payment.total)
            .gte('fecha_pago', fiveMinsAgo);

        if (duplicates && duplicates.length > 0) {
            // Updated: Return detailed message
            return { success: false, message: 'DUPLICADO: Ya existe un pago idéntico registrado para este miembro hace menos de 5 minutos.' };
        }
    }

    // 1. Get Open Shift (Global - specific requirement: Attribute to OPEN shift)
    // We try to find the open shift. If multiple, we might have an issue, but we pick the single one.
    const currentShift = await getCurrentShift();
    const shiftId = currentShift?.id;

    if (!shiftId && payment.metodo_pago === 'efectivo') {
        // Warning but proceed
    }

    // 2. Insert Payment
    // Destructure force away so it doesn't hit the DB
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { force, ...paymentData } = payment;

    const { error: insertError } = await supabase
        .from('payments')
        .insert({
            ...paymentData,
            turno_id: shiftId // Attribute to ANY open shift found
        });

    if (insertError) {
        console.error('Error inserting payment', insertError);
        return { success: false, message: 'Error al registrar el pago en base de datos.' };
    }

    let warningMessage = '';

    // 3. Update Subscription if Plan/User present (Membership Payment)
    if (payment.usuario_id && payment.plan_id) {
        try {
            // Get Plan Duration
            const { data: plan } = await supabase.from('plans').select('nombre, duracion_dias').eq('id', payment.plan_id).single();

            if (plan) {
                // TICKET LOGIC: Check if plan is a "Pack" or "Visit"
                const normName = plan.nombre.toLowerCase();
                if (normName.includes('visita') || normName.includes('paquete')) {
                    let ticketsToAdd = 1;
                    const match = normName.match(/(\d+)\s*visita/); // Match "10 visitas", "5 visita" etc.
                    if (match) {
                        ticketsToAdd = parseInt(match[1]);
                    }

                    if (ticketsToAdd > 0) {
                        const { data: member } = await supabase.from('members').select('visitas_disponibles').eq('id', payment.usuario_id).single();
                        const newCount = (member?.visitas_disponibles || 0) + ticketsToAdd;
                        const { error: ticketError } = await supabase.from('members').update({ visitas_disponibles: newCount }).eq('id', payment.usuario_id);
                        if (ticketError) {
                            console.error('CRITICAL: Failed to update tickets after payment', ticketError);
                            warningMessage = 'Pago registrado, pero ERROR al asignar visitas. Verificar manualmente.';
                        }
                    }
                }

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

                // DATE LOGIC: Date-to-Date (Month + 1 - 1 Day)
                // Base date is either Now (New) or Expiry (Extension)
                let baseDate = isExtension && latestSub ? new Date(latestSub.fecha_vencimiento) : now;

                // Use the nominal expiration logic for plans of 28+ days (monthly approx)
                let newEnd: Date;
                if (plan.duracion_dias >= 28) {
                    const monthsToAdd = Math.round(plan.duracion_dias / 30);
                    newEnd = calculateNominalExpiration(baseDate, monthsToAdd);
                } else {
                    // Short term plans - add days
                    newEnd = new Date(baseDate.getTime() + (plan.duracion_dias * 24 * 60 * 60 * 1000));
                }

                // Safety: Ensure newEnd is effectively in the future
                if (newEnd <= baseDate) {
                    newEnd = new Date(baseDate.getTime() + (plan.duracion_dias * 24 * 60 * 60 * 1000));
                }


                if (isExtension && latestSub) {
                    // EXTEND existing
                    const { error: subError } = await supabase.from('subscriptions').update({
                        fecha_vencimiento: newEnd.toISOString(),
                        estatus: 'activa', // Ensure active
                        plan_id: payment.plan_id // Switch plan if changed
                    }).eq('id', latestSub.id);

                    if (subError) throw subError;

                } else {
                    // NEW Subscription
                    const startDate = now;
                    // If new, start now, end at calculated date
                    // Note: If Base was 'Now', newEnd is already correct relative to now.

                    const { error: subError } = await supabase.from('subscriptions').insert({
                        usuario_id: payment.usuario_id,
                        plan_id: payment.plan_id,
                        fecha_inicio: startDate.toISOString(),
                        fecha_vencimiento: newEnd.toISOString(),
                        estatus: 'activa'
                    });

                    if (subError) throw subError;
                }
            } else {
                warningMessage = 'Pago registrado, pero NO se encontró el plan para actualizar la suscripción.';
            }
        } catch (e) {
            console.error('Error updating subscription logic', e);
            warningMessage = 'Pago registrado EXITOSAMENTE, pero hubo un error al actualizar la membresía. Por favor actualiza la fecha manualmente.';
        }
    }

    // 4. Update Shift Cash if needed
    if (shiftId && payment.metodo_pago === 'efectivo') {
        const newTotal = (currentShift?.total_efectivo || 0) + payment.total;
        const { error: shiftError } = await supabase.from('shifts').update({ total_efectivo: newTotal }).eq('id', shiftId);
        if (shiftError) {
            console.error('Error updating shift cash', shiftError);
            // We don't fail the whole operation since payment matches, but audit log would be nice
        }
    }

    if (warningMessage) {
        return { success: true, message: warningMessage };
    }

    return { success: true };
}

// Chart Data: Revenue last 7 days
export async function getWeeklyRevenue(): Promise<{ date: string; total: number }[]> {
    const today = new Date();
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 6); // Include today
    const sevenDaysStr = sevenDaysAgo.toISOString().split('T')[0];

    // Fetch payments since 7 days ago
    const { data, error } = await supabase
        .from('payments')
        .select('fecha_pago, total')
        .gte('fecha_pago', `${sevenDaysStr}T00:00:00`);

    if (error) {
        console.error('Error fetching weekly revenue:', error);
        return [];
    }

    // Initialize map with 0 for last 7 days to show empty days
    const revenueMap: Record<string, number> = {};
    for (let i = 0; i < 7; i++) {
        const d = new Date(sevenDaysAgo);
        d.setDate(sevenDaysAgo.getDate() + i);
        const dateKey = d.toISOString().split('T')[0];
        // Format nicer: "Mon 01" or just "DD/MM" - keeping ISO key for sorting, formatting in UI
        revenueMap[dateKey] = 0;
    }

    // Sum totals
    data.forEach((p: { fecha_pago: string; total: number }) => {
        const dateKey = new Date(p.fecha_pago).toISOString().split('T')[0];
        if (revenueMap[dateKey] !== undefined) {
            revenueMap[dateKey] += p.total;
        }
    });

    // Convert to array
    return Object.entries(revenueMap).map(([date, total]) => ({
        date, // YYYY-MM-DD
        total
    }));
}

export async function deletePaymentAdmin(paymentId: string): Promise<{ success: boolean; message?: string }> {
    // 1. Fetch the payment
    const { data: payment } = await supabase.from('payments').select('*').eq('id', paymentId).single();
    if (!payment) return { success: false, message: 'Pago no encontrado.' };

    // 2. Fetch the plan
    if (payment.plan_id && payment.usuario_id) {
        const { data: plan } = await supabase.from('plans').select('*').eq('id', payment.plan_id).single();
        if (plan) {
            const normName = plan.nombre.toLowerCase();
            // Revert tickets
            if (normName.includes('visita') || normName.includes('paquete')) {
                let ticketsToSub = 1;
                const match = normName.match(/(\d+)\s*visita/);
                if (match) {
                    ticketsToSub = parseInt(match[1]);
                }
                if (ticketsToSub > 0) {
                    const { data: member } = await supabase.from('members').select('visitas_disponibles').eq('id', payment.usuario_id).single();
                    const newCount = Math.max(0, (member?.visitas_disponibles || 0) - ticketsToSub);
                    await supabase.from('members').update({ visitas_disponibles: newCount }).eq('id', payment.usuario_id);
                }
            } else {
                // Revert date
                const { data: subs } = await supabase
                    .from('subscriptions')
                    .select('*')
                    .eq('usuario_id', payment.usuario_id)
                    .order('fecha_vencimiento', { ascending: false })
                    .limit(1);

                const latestSub = subs?.[0];
                if (latestSub) {
                    let oldEnd = new Date(latestSub.fecha_vencimiento);
                    if (plan.duracion_dias >= 28) {
                        const monthsToSub = Math.round(plan.duracion_dias / 30);
                        let year = oldEnd.getFullYear();
                        let month = oldEnd.getMonth() - monthsToSub;
                        while (month < 0) {
                            year--;
                            month += 12;
                        }
                        oldEnd.setFullYear(year);
                        oldEnd.setMonth(month);
                    } else {
                        oldEnd = new Date(oldEnd.getTime() - (plan.duracion_dias * 24 * 60 * 60 * 1000));
                    }
                    await supabase.from('subscriptions').update({ fecha_vencimiento: oldEnd.toISOString() }).eq('id', latestSub.id);
                }
            }
        }
    }

    // 3. Subtract from open shift if it matches the current shift
    if (payment.turno_id && payment.metodo_pago === 'efectivo') {
        const currentShift = await getCurrentShift();
        if (currentShift && currentShift.id === payment.turno_id) {
            const newTotal = Math.max(0, (currentShift.total_efectivo || 0) - payment.total);
            await supabase.from('shifts').update({ total_efectivo: newTotal }).eq('id', payment.turno_id);
        }
    }

    // 4. Delete the payment
    const { error: delError } = await supabase.from('payments').delete().eq('id', paymentId);
    if (delError) return { success: false, message: 'Error eliminando el registro de pago.' };

    return { success: true, message: 'Pago eliminado y vigencia/visitas revertida correctamente.' };
}

export interface DailyReportRow {
    date: string;
    attendeesMorning: number;
    attendeesEvening: number;
    totalAttendees: number;
    paymentsByPlan: Record<string, number>;
    totalShiftReturns: number; // total handed over to admin from closed shifts
}

export async function getDailyPerformanceSummary(days = 7): Promise<DailyReportRow[]> {
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - (days - 1));
    const startStr = startDate.toISOString().split('T')[0];

    // Fetch Attendance
    const { data: attendanceData } = await supabase
        .from('attendance')
        .select('fecha_hora')
        .gte('fecha_hora', `${startStr}T00:00:00`);

    // Fetch Payments with Plans to group by membership type
    const { data: paymentData } = await supabase
        .from('payments')
        .select(`
            fecha_pago, 
            plan:plans(nombre)
        `)
        .gte('fecha_pago', `${startStr}T00:00:00`);

    // Fetch Shifts to get closed cash differences (Corte entregado)
    const { data: shiftData } = await supabase
        .from('shifts')
        .select('hora_cierre, total_efectivo, desglose_cierre, fondo_siguiente_turno')
        .eq('estatus', 'cerrado')
        .gte('hora_cierre', `${startStr}T00:00:00`);

    const reportMap: Record<string, DailyReportRow> = {};

    for (let i = 0; i < days; i++) {
        const d = new Date(startDate);
        d.setDate(startDate.getDate() + i);
        const dateKey = d.toISOString().split('T')[0];
        reportMap[dateKey] = {
            date: dateKey,
            attendeesMorning: 0,
            attendeesEvening: 0,
            totalAttendees: 0,
            paymentsByPlan: {},
            totalShiftReturns: 0
        };
    }

    // Aggregate Attendance
    (attendanceData || []).forEach((a: any) => {
        const d = new Date(a.fecha_hora);
        const dateKey = d.toISOString().split('T')[0];
        if (reportMap[dateKey]) {
            reportMap[dateKey].totalAttendees++;
            if (d.getHours() < 14) {
                reportMap[dateKey].attendeesMorning++;
            } else {
                reportMap[dateKey].attendeesEvening++;
            }
        }
    });

    // Aggregate Payments
    (paymentData || []).forEach((p: any) => {
        const d = new Date(p.fecha_pago);
        const dateKey = d.toISOString().split('T')[0];
        if (reportMap[dateKey]) {
            const planName = p.plan?.nombre || 'Desconocido';
            reportMap[dateKey].paymentsByPlan[planName] = (reportMap[dateKey].paymentsByPlan[planName] || 0) + 1;
        }
    });

    // Aggregate Shift Cut (Corte de caja)
    (shiftData || []).forEach((s: any) => {
        if (!s.hora_cierre) return;
        const d = new Date(s.hora_cierre);
        const dateKey = d.toISOString().split('T')[0];
        if (reportMap[dateKey]) {
            // "Corte" = Cash Count Total (or total_efectivo if JSON not used) - Fondo para el siguiente
            // Default logic: Cash handed over to Admin 
            let collectedInDrawer = s.total_efectivo || 0;
            if (s.desglose_cierre && typeof s.desglose_cierre === 'object' && 'total' in s.desglose_cierre) {
                // If the user actually verified cash into `desglose_cierre.total`
                collectedInDrawer = (s.desglose_cierre as any).total;
            }
            const leftInDrawer = s.fondo_siguiente_turno ? Number(s.fondo_siguiente_turno) : 0;
            const handedToAdmin = Math.max(0, collectedInDrawer - leftInDrawer);
            
            reportMap[dateKey].totalShiftReturns += handedToAdmin;
        }
    });

    return Object.values(reportMap).sort((a, b) => b.date.localeCompare(a.date));
}
