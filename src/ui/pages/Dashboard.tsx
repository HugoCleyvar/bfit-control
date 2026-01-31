import { useEffect, useState } from 'react';
import { DollarSign, Users, Activity, TrendingUp } from 'lucide-react';
import { getPayments } from '../../logic/api/financeService';
import { getMembers } from '../../logic/api/memberService';
import { getTodayAttendance } from '../../logic/api/attendanceService';

const STATS_INIT = [
    { label: 'Total Ingresos', value: '$0', change: '+0%', icon: DollarSign, color: 'success' },
    { label: 'Total Gastos', value: '$2,400', change: '+5%', icon: TrendingUp, color: 'danger' },
    { label: 'Miembros Activos', value: '0', change: '+0%', icon: Users, color: 'warning' },
    { label: 'Visitas Hoy', value: '0', change: '+0%', icon: Activity, color: 'accent' },
];

function StatCard({ stat }: { stat: typeof STATS_INIT[0] }) {
    const colorMap: Record<string, string> = {
        success: 'var(--color-success)',
        danger: 'var(--color-danger)',
        warning: 'var(--color-warning)',
        accent: 'var(--color-accent)',
    };

    return (
        <div className="stat-card" style={{
            backgroundColor: 'var(--color-card)',
            padding: 'var(--spacing-lg)',
            borderRadius: 'var(--radius-lg)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--spacing-sm)'
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>{stat.label}</span>
                <stat.icon size={20} color={colorMap[stat.color]} />
            </div>
            <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'bold' }}>{stat.value}</div>
            <div style={{ fontSize: 'var(--font-size-sm)', color: colorMap[stat.color] }}>
                {stat.change} <span style={{ color: 'var(--color-text-secondary)' }}>vs mes anterior</span>
            </div>
        </div>
    );
}

export default function Dashboard() {
    const [stats, setStats] = useState(STATS_INIT);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadDashboardData();
    }, []);

    const loadDashboardData = async () => {
        setLoading(true);

        // Parallel fetching
        const [payments, members, attendance] = await Promise.all([
            getPayments(),
            getMembers(),
            getTodayAttendance()
        ]);

        // Calculate Stats
        const totalIncome = payments.reduce((sum, p) => sum + p.total, 0);
        const activeMembers = members.filter(m => m.estatus === 'activo').length;
        const todayVisits = attendance.length;

        setStats([
            { ...STATS_INIT[0], value: `$${totalIncome.toLocaleString()}` },
            { ...STATS_INIT[1], value: '$2,400' }, // Expense Logic not implemented in MVP
            { ...STATS_INIT[2], value: activeMembers.toString() },
            { ...STATS_INIT[3], value: todayVisits.toString() },
        ]);

        setLoading(false);
    };

    return (
        <div className="dashboard-page">
            <h2 style={{ marginBottom: 'var(--spacing-lg)' }}>Dashboard</h2>

            {loading ? <div>Cargando estadísticas...</div> : (
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                    gap: 'var(--spacing-lg)'
                }}>
                    {stats.map((stat) => (
                        <StatCard key={stat.label} stat={stat} />
                    ))}
                </div>
            )}

            {/* Placeholders for Charts */}
            <div style={{
                marginTop: 'var(--spacing-xl)',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                gap: 'var(--spacing-lg)',
                minHeight: '300px'
            }}>
                <div style={{ backgroundColor: 'var(--color-card)', borderRadius: 'var(--radius-lg)', padding: 'var(--spacing-lg)' }}>
                    <h3>Objetivo Membresías</h3>
                    <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-secondary)' }}>
                        Gráfico Radial Placeholder
                    </div>
                </div>
                <div style={{ backgroundColor: 'var(--color-card)', borderRadius: 'var(--radius-lg)', padding: 'var(--spacing-lg)' }}>
                    <h3>Reporte de Estatus</h3>
                    <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-secondary)' }}>
                        Gráfico de Líneas Placeholder
                    </div>
                </div>
            </div>
        </div>
    );
}
