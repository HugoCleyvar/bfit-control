import { supabase } from './supabase';
import type { Attendance, UUID } from '../../domain/types';
import { getMembers } from './memberService';

export interface CheckInResult {
    success: boolean;
    message: string;
    member?: { nombre: string; foto_url?: string };
}

export async function getTodayAttendance(): Promise<Attendance[]> {
    // For MVP, just get last 50 check-ins. Real app would filter by date(now())
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
        .order('fecha_hora', { ascending: false })
        .limit(50);

    if (error) {
        console.error('Error fetching attendance:', error);
        return [];
    }

    return data.map((d: any) => ({
        ...d,
        usuario: d.usuario // flatten logic if needed, but Supabase returns object which matches interface
    }));
}

export async function registerCheckIn(memberIdOrName: string): Promise<CheckInResult> {
    // 1. Find Member (Reuse getMembers to get status logic for free, 
    // although inefficient for single lookup, it ensures consistent business logic)
    const allMembers = await getMembers();

    // Search
    const member = allMembers.find(m =>
        m.id === memberIdOrName ||
        (m.nombre + ' ' + m.apellido).toLowerCase().includes(memberIdOrName.toLowerCase())
    );

    if (!member) {
        return { success: false, message: 'Usuario no encontrado' };
    }

    // 2. Validate Status
    const canAccess = member.subscriptionStatus === 'activa';

    // 3. Record Attendance
    const { error } = await supabase
        .from('attendance')
        .insert({
            usuario_id: member.id,
            permitido: canAccess,
            fecha_hora: new Date().toISOString()
        });

    if (error) {
        console.error('Error recording attendance:', error);
        return { success: false, message: 'Error al registrar asistencia' };
    }

    if (canAccess) {
        return {
            success: true,
            message: `Bienvenido, ${member.nombre}!`,
            member: { nombre: member.nombre, foto_url: member.foto_url }
        };
    } else {
        let reason = 'Acceso Denegado';
        if (member.subscriptionStatus === 'vencida') reason = 'Membresía Vencida';
        if (member.subscriptionStatus === 'sin_suscripcion') reason = 'Sin Membresía Activa';
        if (member.subscriptionStatus === 'cancelada') reason = 'Membresía Cancelada';

        return {
            success: false,
            message: reason,
            member: { nombre: member.nombre, foto_url: member.foto_url }
        };
    }
}
