import { supabase } from './supabase';
import type { Member, Subscription } from '../../domain/types';

export interface MemberWithStatus extends Member {
    subscriptionStatus: 'activa' | 'vencida' | 'cancelada' | 'sin_suscripcion';
    daysRemaining: number;
    currentPlanName?: string;
}

export async function getMembers(limit = 50): Promise<MemberWithStatus[]> {
    // Fetch recent members with their subscriptions
    const { data, error } = await supabase
        .from('members')
        .select(`
            *,
            subscriptions (
                *,
                plan:plans(nombre)
            )
        `)
        .order('fecha_registro', { ascending: false })
        .limit(limit);

    if (error) {
        console.error('Error fetching members:', error);
        return [];
    }

    return mapMembersWithStatus(data);
}

export async function getMembersCount(): Promise<number> {
    const { count, error } = await supabase
        .from('members')
        .select('*', { count: 'exact', head: true });

    if (error) {
        console.error('Error counting members:', error);
        return 0;
    }
    return count || 0;
}

export async function getActiveMemberCount(): Promise<number> {
    const today = new Date().toISOString();
    // Count distinct users with active valid subscription
    // Since Supabase doesn't support easy 'distinct' in count without raw sql or RPC,
    // we will count active subscriptions. It's a close enough proxy.
    const { count, error } = await supabase
        .from('subscriptions')
        .select('*', { count: 'exact', head: true })
        .eq('estatus', 'activa')
        .gt('fecha_vencimiento', today);

    if (error) return 0;
    return count || 0;
}

export async function searchMembers(query: string): Promise<MemberWithStatus[]> {
    if (!query) return [];

    // Search by name or last name
    const { data, error } = await supabase
        .from('members')
        .select(`
            *,
            *,
            subscriptions (*, plan:plans(nombre))
        `)
        .or(`nombre.ilike.%${query}%,apellido.ilike.%${query}%`)
        .limit(10);

    if (error) {
        console.error('Error searching members:', error);
        return [];
    }

    return mapMembersWithStatus(data);
}

export async function findMemberForCheckIn(query: string): Promise<MemberWithStatus | null> {
    // 1. Try by ID (exact match)
    const { data: byId } = await supabase
        .from('members')
        .select(`*, subscriptions (*, plan:plans(nombre))`)
        .eq('id', query)
        .maybeSingle();

    if (byId) {
        return mapMembersWithStatus([byId])[0];
    }

    // 2. Try by Name (Partial match)
    // We limit to 1 for check-in safety. If multiple match, we might need UI handling, 
    // but for now we take the first strict match.
    const { data: byName } = await supabase
        .from('members')
        .select(`*, subscriptions (*, plan:plans(nombre))`)
        .or(`nombre.ilike.%${query}%,apellido.ilike.%${query}%`)
        .limit(1);

    if (byName && byName.length > 0) {
        return mapMembersWithStatus(byName)[0];
    }

    return null;
}

interface MemberWithSubscriptions extends Member {
    subscriptions: (Subscription & { plan?: { nombre: string } })[];
}

function mapMembersWithStatus(data: MemberWithSubscriptions[]): MemberWithStatus[] {
    const today = new Date();

    return data.map((member) => {
        // Find the relevant subscription (active or latest)
        // IMPORTANT: Sort by fecha_vencimiento DESC first, then prioritize
        // active subscriptions with FUTURE expiration dates
        const subs = (member.subscriptions as Subscription[])
            .sort((a, b) => new Date(b.fecha_vencimiento).getTime() - new Date(a.fecha_vencimiento).getTime());

        // First, try to find an active subscription with valid (future) expiration
        const validActiveSub = subs.find(s =>
            s.estatus === 'activa' && new Date(s.fecha_vencimiento) > today
        );

        // Fallback to latest subscription regardless of status
        const latestSub = subs[0];

        const targetSub = validActiveSub || latestSub;

        let status: MemberWithStatus['subscriptionStatus'] = 'sin_suscripcion';
        let daysResult = 0;

        if (targetSub) {
            const dueDate = new Date(targetSub.fecha_vencimiento);
            const diffTime = dueDate.getTime() - today.getTime();
            daysResult = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            // CRITICAL: Overwrite DB status if date is past
            if (daysResult < 0) {
                status = 'vencida';
            } else {
                status = targetSub.estatus;
            }
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
            daysRemaining: daysResult,
            currentPlanName: targetSub?.plan?.nombre,
            visitas_disponibles: member.visitas_disponibles,
            ultima_visita: member.ultima_visita // Pass through for check-in logic
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

export async function createMember(member: Omit<Member, 'id' | 'estatus' | 'fecha_registro'>, colaboradorId?: string): Promise<Member | null> {
    const { data, error } = await supabase
        .from('members')
        .insert({
            ...member,
            estatus: 'activo',
            colaborador_id: colaboradorId
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

export async function updateSubscriptionExpiration(memberId: string, newDate: string, planId?: string): Promise<boolean> {
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
        let targetPlanId = planId;

        // If no planId provided, try to find a "Standard" or "Mensual" plan as fallback
        if (!targetPlanId) {
            const { data: plans } = await supabase
                .from('plans')
                .select('id')
                .eq('activo', true)
                .order('precio', { ascending: true }) // Assume cheapest is default? Or safer to fail.
                .limit(1);
            targetPlanId = plans?.[0]?.id;
        }

        if (!targetPlanId) {
            console.error('Cannot create subscription without a framework plan.');
            return false;
        }

        const { error } = await supabase.from('subscriptions').insert({
            usuario_id: memberId,
            plan_id: targetPlanId,
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

