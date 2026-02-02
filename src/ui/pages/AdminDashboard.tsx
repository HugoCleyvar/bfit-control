import { useState, useEffect } from 'react';
import { getActiveShifts, getWeeklyRevenue, getTodayIncome } from '../../logic/api/financeService';
import { getActiveMemberCount } from '../../logic/api/memberService';
import { getTodayAttendance, getAttendanceHeatmap } from '../../logic/api/attendanceService';
import { getExpiringMembers, type ExpiringMember } from '../../logic/api/gamificationService';
import { Users, TrendingUp, Calendar, Clock, AlertCircle, Loader2 } from 'lucide-react';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function AdminDashboard() {
    // Stats State
    const [totalMembers, setTotalMembers] = useState(0);
    const [todayIncome, setTodayIncome] = useState(0);
    const [todayAttendance, setTodayAttendance] = useState(0);
    const [loadingKPIs, setLoadingKPIs] = useState(true);

    // Chart Data State
    const [revenueData, setRevenueData] = useState<{ name: string; total: number }[]>([]);
    const [heatmapData, setHeatmapData] = useState<{ hour: number; count: number }[]>([]);
    const [loadingCharts, setLoadingCharts] = useState(true);

    useEffect(() => {
        // Phase 1: Fast KPIs
        const loadKPIs = async () => {
            const [activeCount, income, attendance] = await Promise.all([
                getActiveMemberCount(),
                getTodayIncome(),
                getTodayAttendance()
            ]);
            setTotalMembers(activeCount);
            setTodayIncome(income);
            setTodayAttendance(attendance.length);
            setLoadingKPIs(false);

            // Phase 2: Charts (Slow)
            loadCharts();
        };

        const loadCharts = async () => {
            const [revenue, heatmap] = await Promise.all([
                getWeeklyRevenue(),
                getAttendanceHeatmap()
            ]);

            // Format Chart Data
            const formattedRevenue = revenue.map(r => {
                const d = new Date(r.date + 'T12:00:00'); // avoiding timezone shift
                return {
                    name: d.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric' }),
                    total: r.total
                };
            });
            setRevenueData(formattedRevenue);
            setHeatmapData(heatmap);
            setLoadingCharts(false);
        };

        loadKPIs();
    }, []);

    // Non-blocking loading
    // if (loading) return ... (Removed)

    return (
        <div className="page-container">
            <h2>Panel de Control</h2>

            {/* Top Cards Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--spacing-lg)', marginTop: 'var(--spacing-lg)' }}>
                {loadingKPIs ? (
                    <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '20px' }}><Loader2 className="animate-spin" /> Cargando Métricas...</div>
                ) : (
                    <>
                        <KpiCard icon={<Users />} title="Miembros Activos" value={totalMembers} color="var(--color-primary)" />
                        <KpiCard icon={<TrendingUp />} title="Ingresos Hoy" value={`$${todayIncome.toLocaleString()}`} color="var(--color-success)" />
                        <KpiCard icon={<Calendar />} title="Asistencias Hoy" value={todayAttendance} color="var(--color-info)" />
                    </>
                )}
            </div>

            {/* Charts Section */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 'var(--spacing-xl)', marginTop: 'var(--spacing-xl)' }}>

                {/* Revenue Chart */}
                <div style={{ backgroundColor: 'var(--color-card)', padding: 'var(--spacing-xl)', borderRadius: 'var(--radius-lg)', minHeight: '300px' }}>
                    <h3 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <TrendingUp size={18} color="var(--color-success)" /> Tendencia de Ingresos (7 Días)
                    </h3>
                    <div style={{ height: '250px', width: '100%' }}>
                        {loadingCharts ? (
                            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Loader2 className="animate-spin" />
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={revenueData}>
                                    <defs>
                                        <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="var(--color-success)" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="var(--color-success)" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                                    <XAxis dataKey="name" stroke="var(--color-text-secondary)" fontSize={12} tickLine={false} axisLine={false} />
                                    <YAxis stroke="var(--color-text-secondary)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `$${val}`} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: 'var(--color-card)', borderColor: 'var(--color-border)', borderRadius: '8px' }}
                                        formatter={(val: number | string | undefined) => [`$${Number(val || 0).toLocaleString()}`, 'Ingreso']}
                                    />
                                    <Area type="monotone" dataKey="total" stroke="var(--color-success)" strokeWidth={3} fillOpacity={1} fill="url(#colorIncome)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>

                {/* Attendance Chart */}
                <div style={{ backgroundColor: 'var(--color-card)', padding: 'var(--spacing-xl)', borderRadius: 'var(--radius-lg)', minHeight: '300px' }}>
                    <h3 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Clock size={18} color="var(--color-info)" /> Horas Pico (Últimos 30 días)
                    </h3>
                    <div style={{ height: '250px', width: '100%' }}>
                        {loadingCharts ? (
                            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Loader2 className="animate-spin" />
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={heatmapData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                                    <XAxis
                                        dataKey="hour"
                                        stroke="var(--color-text-secondary)"
                                        fontSize={12}
                                        tickLine={false}
                                        axisLine={false}
                                        tickFormatter={(h) => `${h}:00`}
                                    />
                                    <Tooltip
                                        cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                        contentStyle={{ backgroundColor: 'var(--color-card)', borderColor: 'var(--color-border)', borderRadius: '8px' }}
                                        labelFormatter={(label) => `${label}:00 hrs`}
                                    />
                                    <Bar dataKey="count" name="Visitas" fill="var(--color-info)" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>

            </div>

            {/* Active Shifts Widget */}
            <div style={{ marginTop: 'var(--spacing-xl)' }}>
                <h3 style={{ marginBottom: 'var(--spacing-md)' }}>Supervisión de Turnos Activos</h3>
                <ActiveShiftsTable />
            </div>

            {/* Retention Alert Widget */}
            <div style={{ marginTop: 'var(--spacing-xl)' }}>
                <h3 style={{ marginBottom: 'var(--spacing-md)', color: 'var(--color-warning)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <AlertCircle /> Membresías por Vencer (5 días)
                </h3>
                <ExpiringMembersList />
            </div>
        </div>
    );
}

function ExpiringMembersList() {
    const [list, setList] = useState<ExpiringMember[]>([]);

    useEffect(() => {
        getExpiringMembers().then(setList);
    }, []);

    if (list.length === 0) return (
        <div style={{ padding: '20px', backgroundColor: 'var(--color-card)', borderRadius: '12px', color: 'var(--color-success)', border: '1px solid var(--color-success)' }}>
            ✅ Todo en orden. No hay membresías próximas a vencer.
        </div>
    );

    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '15px' }}>
            {list.map(item => (
                <div key={item.id} style={{
                    backgroundColor: 'var(--color-card)',
                    padding: '15px',
                    borderRadius: '10px',
                    borderLeft: '4px solid var(--color-warning)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <div>
                        <div style={{ fontWeight: 'bold', fontSize: '16px' }}>{item.profile?.nombre}</div>
                        <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                            {item.plan?.nombre} • Vence: {new Date(item.fecha_vencimiento).toLocaleDateString()}
                        </div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '20px', fontWeight: 'bold', color: 'var(--color-warning)' }}>{item.daysLeft}</div>
                        <div style={{ fontSize: '10px', textTransform: 'uppercase' }}>Días</div>
                    </div>
                    {/* Add WhatsApp Button later if needed here, or keep simple */}
                </div>
            ))}
        </div>
    );
}

function KpiCard({ icon, title, value, color }: { icon: React.ReactNode, title: string, value: string | number, color: string }) {
    return (
        <div style={{
            backgroundColor: 'var(--color-card)',
            padding: 'var(--spacing-xl)',
            borderRadius: 'var(--radius-lg)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            borderLeft: `4px solid ${color}`
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--color-text-secondary)', marginBottom: '10px' }}>
                {icon}
                <span style={{ fontSize: '14px' }}>{title}</span>
            </div>
            <div style={{ fontSize: '28px', fontWeight: 'bold' }}>
                {value}
            </div>
        </div>
    );
}

function ActiveShiftsTable() {
    const [shifts, setShifts] = useState<{ id: string; profiles?: { nombre: string }; hora_inicio: string; monto_inicial: number; total_efectivo: number; retiros: number }[]>([]);

    useEffect(() => {
        getActiveShifts().then(setShifts);
    }, []);

    if (shifts.length === 0) return <div style={{ color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>No hay turnos activos en este momento.</div>;

    return (
        <div style={{ overflowX: 'auto', backgroundColor: 'var(--color-card)', borderRadius: '12px', padding: '10px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '600px' }}>
                <thead>
                    <tr style={{ textAlign: 'left', color: 'var(--color-text-secondary)', borderBottom: '1px solid var(--color-border)' }}>
                        <th style={{ padding: '12px' }}>Colaborador</th>
                        <th style={{ padding: '12px' }}>Inicio</th>
                        <th style={{ padding: '12px' }}>Efec. Inicial</th>
                        <th style={{ padding: '12px' }}>En Caja (Teórico)</th>
                        <th style={{ padding: '12px' }}>Retiros</th>
                    </tr>
                </thead>
                <tbody>
                    {shifts.map(s => (
                        <tr key={s.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                            <td style={{ padding: '12px', fontWeight: 'bold' }}>{s.profiles?.nombre || 'Unknown'}</td>
                            <td style={{ padding: '12px' }}>{new Date(s.hora_inicio).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                            <td style={{ padding: '12px' }}>${s.monto_inicial}</td>
                            <td style={{ padding: '12px', color: 'var(--color-success)', fontWeight: 'bold' }}>${s.total_efectivo}</td>
                            <td style={{ padding: '12px', color: 'var(--color-danger)' }}>${s.retiros}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
