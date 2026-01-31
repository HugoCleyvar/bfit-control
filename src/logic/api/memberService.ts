import { supabase } from './supabase';
import type { Member, Subscription } from '../../domain/types';

export interface MemberWithStatus extends Member {
    subscriptionStatus: 'activa' | 'vencida' | 'cancelada' | 'sin_suscripcion';
    daysRemaining: number;
}

export async function getMembers(): Promise<MemberWithStatus[]> {
    // Fetch members with their subscriptions
    const { data, error } = await supabase
        .from('members')
        .select(`
            *,
            subscriptions (
                *
            )
        `);

    if (error) {
        console.error('Error fetching members:', error);
        return [];
    }

    const today = new Date();

    return data.map((member: any) => {
        // Find the relevant subscription (active or latest)
        // We prioritize 'activa', then check for 'vencida' if no active found.
        const subs = member.subscriptions as Subscription[];
        const activeSub = subs.find(s => s.estatus === 'activa');
        const latestSub = subs.sort((a, b) => new Date(b.fecha_vencimiento).getTime() - new Date(a.fecha_vencimiento).getTime())[0];

        const targetSub = activeSub || latestSub;

        let status: MemberWithStatus['subscriptionStatus'] = 'sin_suscripcion';
        let daysResult = 0;

        if (targetSub) {
            status = targetSub.estatus;
            const dueDate = new Date(targetSub.fecha_vencimiento);
            const diffTime = dueDate.getTime() - today.getTime();
            daysResult = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        }

        return {
            id: member.id,
            nombre: member.nombre,
            apellido: member.apellido,
            foto_url: member.foto_url,
            telefono: member.telefono,
            fecha_nacimiento: member.fecha_nacimiento,
            estatus: member.estatus,
            fecha_registro: member.fecha_registro,
            subscriptionStatus: status,
            daysRemaining: daysResult
        };
    });
}

export async function deleteMember(id: string): Promise<boolean> {
    const { error } = await supabase.from('members').delete().eq('id', id);
    if (error) {
        console.error('Error deleting member:', error);
        return false;
    }
    return true;
}

export async function createMember(member: Omit<Member, 'id' | 'estatus' | 'fecha_registro'>): Promise<Member | null> {
    const { data, error } = await supabase
        .from('members')
        .insert({
            ...member,
            estatus: 'activo'
        })
        .select()
        .single();

    if (error) {
        console.error('Error creating member:', error);
        return null;
    }
    return data;
}

export async function updateMember(id: string, updates: Partial<Member>): Promise<Member | null> {
    const { data, error } = await supabase
        .from('members')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

    if (error) {
        console.error('Error updating member:', error);
        return null;
    }
    return data;
}

export async function updateSubscriptionExpiration(memberId: string, newDate: string): Promise<boolean> {
    // 1. Find active or latest sub
    const { data: subs } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('usuario_id', memberId)
        .order('fecha_vencimiento', { ascending: false })
        .limit(1);

    const targetSub = subs?.[0];

    if (!targetSub) {
        // If no sub exists, we need to create one.
        // We need a valid plan_id for the FK constraint.
        const { data: plans } = await supabase.from('plans').select('id').limit(1);
        const defaultPlanId = plans?.[0]?.id;

        if (!defaultPlanId) {
            console.error('Cannot create subscription without a valid plan.');
            return false;
        }

        const { error } = await supabase.from('subscriptions').insert({
            usuario_id: memberId,
            plan_id: defaultPlanId,
            fecha_inicio: new Date().toISOString(),
            fecha_vencimiento: newDate,
            estatus: 'activa'
        });
        return !error;
    }

    // 2. Update existing
    const { error } = await supabase
        .from('subscriptions')
        .update({
            fecha_vencimiento: newDate,
            estatus: new Date(newDate) > new Date() ? 'activa' : 'vencida'
        })
        .eq('id', targetSub.id);

    return !error;
}

