import { supabase } from './supabase';
import type { Attendance } from '../../domain/types';
import { findMemberForCheckIn } from './memberService';

export interface CheckInResult {
    success: boolean;
    message: string;
    member?: { nombre: string; foto_url?: string };
}

export async function getTodayAttendance(): Promise<Attendance[]> {
    // For MVP, just get last 50 check-ins. Real app would filter by date(now())
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    // Using date filter for accuracy as per audit
    const { data, error } = await supabase
        .from('attendance')
        .select(`
            *,
            usuario:members (
                nombre,
                apellido,
                foto_url
            )
        `)
        .gte('fecha_hora', `${today}T00:00:00`)
        .order('fecha_hora', { ascending: false });

    if (error) {
        console.error('Error fetching attendance:', error);
        return [];
    }

    interface AttendanceRow {
        id: string;
        fecha_hora: string;
        permitido: boolean;
        usuario_id: string;
        usuario: { nombre: string; apellido: string; foto_url?: string } | null;
    }

    return (data as AttendanceRow[]).map((d) => ({
        ...d,
        usuario: d.usuario || undefined
    })) as Attendance[];
}

export async function registerCheckIn(memberIdOrName: string, colaboradorId?: string, turnoId?: string): Promise<CheckInResult> {
    // 1. Find Member Directly in DB (Audit Fix)
    const member = await findMemberForCheckIn(memberIdOrName);

    if (!member) {
        return { success: false, message: 'Usuario no encontrado' };
    }

    // 2. Validate Status
    const planName = member.currentPlanName?.toLowerCase() || '';
    const isPackPlan = planName.includes('visita') || planName.includes('paquete');

    // Normal access only if NOT a pack plan and status is active
    let canAccess = member.subscriptionStatus === 'activa' && !isPackPlan;
    let message = `Bienvenido, ${member.nombre}!`;

    // TICKET SYSTEM LOGIC
    // Force check for tickets if it's a pack plan OR if subscription is not active
    if ((isPackPlan || !canAccess) && (member.visitas_disponibles ?? 0) > 0) {
        canAccess = true;
        message = `Bienvenido, ${member.nombre}! (Visita prepagada)`;


        // Check 24h Cooldown (Same Day Reset)
        const lastVisit = member.ultima_visita ? new Date(member.ultima_visita) : null;
        const now = new Date();
        const isSameDay = lastVisit &&
            lastVisit.getDate() === now.getDate() &&
            lastVisit.getMonth() === now.getMonth() &&
            lastVisit.getFullYear() === now.getFullYear();

        if (!isSameDay) {
            // Decrement ticket
            const newCount = (member.visitas_disponibles ?? 0) - 1;

            // Update Member logic
            const { error: updateError } = await supabase
                .from('members')
                .update({
                    visitas_disponibles: newCount,
                    ultima_visita: now.toISOString()
                })
                .eq('id', member.id);

            if (updateError) {
                console.error('Error updating tickets', updateError);
                return { success: false, message: 'Error al procesar visita' };
            }
            message = `Bienvenido, ${member.nombre}! (Quedan: ${newCount} visitas)`;
        } else {
            // Just update time, don't deduct
            await supabase.from('members').update({ ultima_visita: now.toISOString() }).eq('id', member.id);
        }
    } else if (canAccess) {
        // Normal subscription access - just update last visit
        await supabase.from('members').update({ ultima_visita: new Date().toISOString() }).eq('id', member.id);
    }


    // 3. Record Attendance
    const { error } = await supabase
        .from('attendance')
        .insert({
            usuario_id: member.id,
            permitido: canAccess,
            fecha_hora: new Date().toISOString(),
            colaborador_id: colaboradorId,
            turno_id: turnoId
        });

    if (error) {
        console.error('Error recording attendance:', error);
        return { success: false, message: 'Error al registrar asistencia' };
    }

    if (canAccess) {
        return {
            success: true,
            message: message,
            member: { nombre: member.nombre, foto_url: member.foto_url }
        };
    } else {
        let reason = 'Acceso Denegado';
        if (member.subscriptionStatus === 'vencida') reason = 'Membresía Vencida';
        if (member.subscriptionStatus === 'sin_suscripcion') reason = 'Sin Membresía Activa';
        if (member.subscriptionStatus === 'cancelada') reason = 'Membresía Cancelada';

        // Add info about tickets if 0
        if ((member.visitas_disponibles ?? 0) <= 0) {
            reason += ' (Sin visitas disponibles)';
        }

        return {
            success: false,
            message: reason,
            member: { nombre: member.nombre, foto_url: member.foto_url }
        };
    }
}
// Chart Data: Peak Hours (Heatmap logic: Group by Hour 0-23)
export async function getAttendanceHeatmap(): Promise<{ hour: number; count: number }[]> {
    // Analyze last 30 days to get a good average pattern
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 30);
    const dateStr = thirtyDaysAgo.toISOString().split('T')[0];

    const { data, error } = await supabase
        .from('attendance')
        .select('fecha_hora')
        .gte('fecha_hora', `${dateStr}T00:00:00`);

    if (error) {
        console.error('Error fetching heatmap:', error);
        return [];
    }

    // Initialize hours 6am to 23pm (gym hours?) or just 0-23
    const hoursMap: Record<number, number> = {};
    for (let i = 6; i <= 22; i++) hoursMap[i] = 0; // Focus on 6 AM to 10 PM

    data.forEach((a: { fecha_hora: string }) => {
        const h = new Date(a.fecha_hora).getHours();
        if (hoursMap[h] !== undefined) {
            hoursMap[h]++;
        }
    });

    return Object.entries(hoursMap).map(([h, count]) => ({
        hour: Number(h),
        count
    })).sort((a, b) => a.hour - b.hour);
}
