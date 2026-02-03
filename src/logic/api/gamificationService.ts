import { supabase } from './supabase';


export interface ExpiringMember {
    id: string; // Subscription ID
    usuario_id: string;
    fecha_vencimiento: string;
    profile: {
        nombre: string;
        apellido: string;
        telefono: string;
        foto_url?: string;
    };
    plan: {
        nombre: string;
    };
    daysLeft: number;
}

export async function getExpiringMembers(daysThreshold = 5): Promise<ExpiringMember[]> {
    const today = new Date();
    const futureDate = new Date();
    futureDate.setDate(today.getDate() + daysThreshold);

    const todayStr = today.toISOString().split('T')[0];
    const futureStr = futureDate.toISOString().split('T')[0];

    // Query Subscriptions expiring soon
    // We join with profiles and plans
    const { data, error } = await supabase
        .from('subscriptions')
        .select(`
            id,
            usuario_id,
            fecha_vencimiento,
            plan_id,
            profiles:usuario_id (nombre, apellido, telefono, foto_url),
            plans:plan_id (nombre)
        `)
        .eq('estatus', 'activa')
        .gte('fecha_vencimiento', todayStr)
        .lte('fecha_vencimiento', futureStr)
        .order('fecha_vencimiento', { ascending: true });

    if (error) {
        console.error('Error fetching expiring members:', error);
        return [];
    }

    interface SubscriptionRow {
        id: string;
        usuario_id: string;
        fecha_vencimiento: string;
        profiles: { nombre: string; apellido: string; telefono: string; foto_url?: string }[] | { nombre: string; apellido: string; telefono: string; foto_url?: string };
        plans: { nombre: string }[] | { nombre: string };
    }

    return (data as unknown as SubscriptionRow[]).map((sub) => {
        const expiry = new Date(sub.fecha_vencimiento);
        const diffTime = Math.abs(expiry.getTime() - today.getTime());
        const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        // Supabase puede retornar array o objeto según la relación
        const profile = Array.isArray(sub.profiles) ? sub.profiles[0] : sub.profiles;
        const plan = Array.isArray(sub.plans) ? sub.plans[0] : sub.plans;

        return {
            id: sub.id,
            usuario_id: sub.usuario_id,
            fecha_vencimiento: sub.fecha_vencimiento,
            profile,
            plan,
            daysLeft: daysLeft
        };
    }).filter((m) => m.profile);
}

export async function getMemberStats(userId: string): Promise<{ totalVisits: number; thisMonth: number; streak: number }> {
    // 1. Total Visits
    const { count: total } = await supabase
        .from('attendance')
        .select('*', { count: 'exact', head: true })
        .eq('usuario_id', userId);

    // 2. This Month
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const { count: monthCount } = await supabase
        .from('attendance')
        .select('*', { count: 'exact', head: true })
        .eq('usuario_id', userId)
        .gte('fecha_hora', startOfMonth);

    // 3. Streak (Simplified: Consecutive Weeks with at least 1 visit)
    // This is hard to do purely in SQL without complex window functions.
    // We will fetch last 10 visits and calc in JS for MVP speed.
    const { data: visits } = await supabase
        .from('attendance')
        .select('fecha_hora')
        .eq('usuario_id', userId)
        .order('fecha_hora', { ascending: false })
        .limit(20);

    let streak = 0;
    if (visits && visits.length > 0) {
        // Simple algorithm: Check if attended this week, then last week...
        // Actually, usually "Streak" in apps means "Consecutive Days" or "Weeks".
        // Let's do Consecutive Weeks.
        const weeksVisited = new Set<string>();
        visits.forEach((v: { fecha_hora: string }) => {
            const d = new Date(v.fecha_hora);
            const weekNum = getWeekNumber(d);
            weeksVisited.add(`${d.getFullYear()}-W${weekNum}`);
        });

        // Check backwards from current week
        const currentWeek = getWeekNumber(new Date());
        let checkWeek = currentWeek;
        const checkYear = new Date().getFullYear(); // Simplified year transition logic for MVP

        while (weeksVisited.has(`${checkYear}-W${checkWeek}`)) {
            streak++;
            checkWeek--;
            if (checkWeek <= 0) break; // MVP limit
        }
    }

    return {
        totalVisits: total || 0,
        thisMonth: monthCount || 0,
        streak: streak
    };
}

// Helper for week 1-52
function getWeekNumber(d: Date): number {
    const onejan = new Date(d.getFullYear(), 0, 1);
    const millis = d.getTime() - onejan.getTime();
    return Math.ceil((((millis / 86400000) + onejan.getDay() + 1) / 7));
}
