import { supabase, fetchAllRows } from './supabase';
import type { Member, Subscription } from '../../domain/types';
import { parseLocalDate, formatLocalDateToYMD } from '../../domain/dateUtils';

export interface MemberWithStatus extends Member {
    subscriptionStatus: 'activa' | 'vencida' | 'cancelada' | 'sin_suscripcion';
    daysRemaining: number;
    currentPlanName?: string;
    subscriptionEndDate?: string; // fecha_vencimiento of the subscription behind subscriptionStatus
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

    return mapMembersWithStatus(data || []);
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
    const todayStr = formatLocalDateToYMD(new Date());
    const { count, error } = await supabase
        .from('subscriptions')
        .select('*', { count: 'exact', head: true })
        .neq('estatus', 'cancelada')
        .gte('fecha_vencimiento', todayStr);

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
            subscriptions (*, plan:plans(nombre))
        `)
        .or(`nombre.ilike.%${query}%,apellido.ilike.%${query}%`)
        .limit(10);

    if (error) {
        console.error('Error searching members:', error);
        return [];
    }

    return mapMembersWithStatus(data || []);
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

export function mapMembersWithStatus(data: MemberWithSubscriptions[]): MemberWithStatus[] {
    const today = new Date();

    return (data || []).map((member) => {
        const rawSubs = Array.isArray(member.subscriptions) ? member.subscriptions : [];

        // Sort subscriptions by expiration date DESC
        const subs = [...rawSubs].sort((a, b) => {
            const expA = parseLocalDate(a.fecha_vencimiento, true).getTime();
            const expB = parseLocalDate(b.fecha_vencimiento, true).getTime();
            return expB - expA;
        });

        // 1. Priority: Find active unexpired subscription (not cancelled)
        const validActiveSub = subs.find(s => {
            if (s.estatus === 'cancelada') return false;
            const exp = parseLocalDate(s.fecha_vencimiento, true);
            return exp >= today;
        });

        // 2. Fallback to latest subscription
        const latestSub = subs[0];
        const targetSub = validActiveSub || latestSub;

        let status: MemberWithStatus['subscriptionStatus'] = 'sin_suscripcion';
        let daysResult = 0;

        if (targetSub) {
            const expirationDate = parseLocalDate(targetSub.fecha_vencimiento, true);
            const diffTime = expirationDate.getTime() - today.getTime();
            daysResult = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (targetSub.estatus === 'cancelada') {
                status = 'cancelada';
            } else if (expirationDate < today) {
                status = 'vencida';
            } else {
                status = 'activa';
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
            subscriptionEndDate: targetSub?.fecha_vencimiento,
            visitas_disponibles: member.visitas_disponibles,
            ultima_visita: member.ultima_visita
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
    const expDate = parseLocalDate(newDate, true);
    const isFutureOrToday = expDate >= new Date();
    const cleanDateStr = formatLocalDateToYMD(expDate);

    // 1. Find active or latest sub
    const { data: subs } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('usuario_id', memberId)
        .order('fecha_vencimiento', { ascending: false })
        .limit(1);

    const targetSub = subs?.[0];

    if (!targetSub) {
        let targetPlanId = planId;

        if (!targetPlanId) {
            const { data: plans } = await supabase
                .from('plans')
                .select('id')
                .eq('activo', true)
                .order('precio', { ascending: true })
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
            fecha_inicio: formatLocalDateToYMD(new Date()),
            fecha_vencimiento: cleanDateStr,
            estatus: isFutureOrToday ? 'activa' : 'vencida'
        });

        if (isFutureOrToday) {
            await supabase.from('members').update({ estatus: 'activo' }).eq('id', memberId);
        }

        return !error;
    }

    // 2. Update existing
    const { error } = await supabase
        .from('subscriptions')
        .update({
            fecha_vencimiento: cleanDateStr,
            estatus: isFutureOrToday ? 'activa' : 'vencida',
            recordatorio_enviado: false,
            recordatorio_enviado_at: null
        })
        .eq('id', targetSub.id);

    if (isFutureOrToday) {
        await supabase.from('members').update({ estatus: 'activo' }).eq('id', memberId);
    }

    return !error;
}

// Full member roster with computed status - unlike getMembers(), not capped at a display limit.
// Used by reports that need to look at every member, not just the most recently registered ones.
export async function getAllMembersWithStatus(): Promise<MemberWithStatus[]> {
    const data = await fetchAllRows<MemberWithSubscriptions>((from, to) =>
        supabase
            .from('members')
            .select(`*, subscriptions (*, plan:plans(nombre))`)
            .range(from, to)
    );

    return mapMembersWithStatus(data);
}

export interface ChurnedMember {
    id: string;
    nombre: string;
    apellido: string;
    telefono?: string;
    planName?: string;
    fechaVencimiento: string;
}

// Members whose most recent subscription expired within [from, to] and hasn't been renewed
// since (their computed status is still 'vencida' today). Reuses mapMembersWithStatus so this
// stays consistent with what counts as "active"/"expired" everywhere else in the app.
export async function getChurnedMembers(from: Date, to: Date): Promise<ChurnedMember[]> {
    const all = await getAllMembersWithStatus();

    return all
        .filter((m): m is MemberWithStatus & { subscriptionEndDate: string } =>
            m.subscriptionStatus === 'vencida' && !!m.subscriptionEndDate
        )
        .filter(m => {
            const expired = new Date(m.subscriptionEndDate);
            return expired >= from && expired <= to;
        })
        .map(m => ({
            id: m.id,
            nombre: m.nombre,
            apellido: m.apellido,
            telefono: m.telefono,
            planName: m.currentPlanName,
            fechaVencimiento: m.subscriptionEndDate
        }))
        .sort((a, b) => new Date(b.fechaVencimiento).getTime() - new Date(a.fechaVencimiento).getTime());
}

export interface NewMembersRow {
    monthStr: string; // YYYY-MM
    count: number;
}

export async function getNewMembersByMonth(months = 6): Promise<NewMembersRow[]> {
    const today = new Date();
    const startDate = new Date(today.getFullYear(), today.getMonth() - (months - 1), 1);

    const rows = await fetchAllRows<{ fecha_registro: string }>((from, to) =>
        supabase
            .from('members')
            .select('fecha_registro')
            .gte('fecha_registro', startDate.toISOString())
            .range(from, to)
    );

    const reportMap: Record<string, number> = {};
    for (let i = 0; i < months; i++) {
        const d = new Date(startDate.getFullYear(), startDate.getMonth() + i, 1);
        const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        reportMap[monthKey] = 0;
    }

    rows.forEach(r => {
        const d = new Date(r.fecha_registro);
        const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (reportMap[monthKey] !== undefined) reportMap[monthKey]++;
    });

    return Object.entries(reportMap)
        .map(([monthStr, count]) => ({ monthStr, count }))
        .sort((a, b) => a.monthStr.localeCompare(b.monthStr));
}

export interface PlanMemberCount {
    planName: string;
    count: number;
}

// Active members grouped by plan - same "active" definition as getActiveMemberCount
// (estatus='activa' AND fecha_vencimiento in the future), just broken out per plan.
export async function getActiveMembersByPlan(): Promise<PlanMemberCount[]> {
    const today = new Date().toISOString();

    // Supabase infers embedded to-one joins as arrays without generated schema types
    const rows = await fetchAllRows<{ plan: { nombre: string }[] | null }>((from, to) =>
        supabase
            .from('subscriptions')
            .select('plan:plans(nombre)')
            .eq('estatus', 'activa')
            .gt('fecha_vencimiento', today)
            .range(from, to)
    );

    const counts: Record<string, number> = {};
    rows.forEach(r => {
        const planName = r.plan?.[0]?.nombre || 'Sin plan';
        counts[planName] = (counts[planName] || 0) + 1;
    });

    return Object.entries(counts)
        .map(([planName, count]) => ({ planName, count }))
        .sort((a, b) => b.count - a.count);
}

export interface UnpaidAttendanceAlert {
    memberId: string;
    nombre: string;
    apellido: string;
    telefono?: string;
    subscriptionEndDate: string;
    visitDates: string[]; // attendance dates after the subscription had already expired
}

// Members who are currently 'vencida' and were let in (attendance.permitido = true) on a date
// AFTER their subscription had already expired. Pack/visit-plan members are excluded: the
// check-in flow legitimately grants them access via visitas_disponibles regardless of
// subscription status, so flagging them here would just be noise, not a real anomaly.
export async function getExpiredMembersWithUnpaidAttendance(): Promise<UnpaidAttendanceAlert[]> {
    const all = await getAllMembersWithStatus();

    const expired = all.filter((m): m is MemberWithStatus & { subscriptionEndDate: string } => {
        if (m.subscriptionStatus !== 'vencida' || !m.subscriptionEndDate) return false;
        const planName = (m.currentPlanName || '').toLowerCase();
        const isPackPlan = planName.includes('visita') || planName.includes('paquete');
        return !isPackPlan;
    });

    if (expired.length === 0) return [];

    const ids = expired.map(m => m.id);
    const attendance = await fetchAllRows<{ usuario_id: string; fecha_hora: string }>((from, to) =>
        supabase
            .from('attendance')
            .select('usuario_id, fecha_hora')
            .eq('permitido', true)
            .in('usuario_id', ids)
            .range(from, to)
    );

    const visitsByMember: Record<string, string[]> = {};
    attendance.forEach(a => {
        (visitsByMember[a.usuario_id] ||= []).push(a.fecha_hora);
    });

    return expired
        .map(m => ({
            memberId: m.id,
            nombre: m.nombre,
            apellido: m.apellido,
            telefono: m.telefono,
            subscriptionEndDate: m.subscriptionEndDate,
            visitDates: (visitsByMember[m.id] || [])
                .filter(v => new Date(v) > new Date(m.subscriptionEndDate))
                .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
        }))
        .filter(x => x.visitDates.length > 0)
        .sort((a, b) => b.visitDates.length - a.visitDates.length);
}
