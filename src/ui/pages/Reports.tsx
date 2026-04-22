import { useEffect, useState, useCallback } from 'react';
import { getPayments } from '../../logic/api/financeService';
import { getMembers } from '../../logic/api/memberService';
import type { Shift } from '../../domain/types';
import type { DailyReportRow, MonthlyReportRow } from '../../logic/api/financeService';

import { BarChart, PieChart, TrendingUp, Users } from 'lucide-react';
import { BarChart as RechartsBarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts';

export default function Reports() {
    const [loading, setLoading] = useState(true);
    const [totalIncome, setTotalIncome] = useState(0);
    const [paymentMethods, setPaymentMethods] = useState<Record<string, number>>({});
    const [activeMembers, setActiveMembers] = useState(0);

    const loadData = useCallback(async () => {
        setLoading(true);
        const [payments, members] = await Promise.all([
            getPayments(),
            getMembers()
        ]);

        // Calc Income
        const total = payments.reduce((sum, p) => sum + p.total, 0);
        setTotalIncome(total);

        // Calc Methods
        const methods = payments.reduce((acc, p) => {
            acc[p.metodo_pago] = (acc[p.metodo_pago] || 0) + p.total;
            return acc;
        }, {} as Record<string, number>);
        setPaymentMethods(methods);

        // Calc Members (Active Subscriptions)
        setActiveMembers(members.filter(m => m.subscriptionStatus === 'activa').length);

        setLoading(false);
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    if (loading) return <div className="page-container">Generando reportes...</div>;

    return (
        <div className="page-container">
            <h2>Reportes y Métricas</h2>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--spacing-lg)', marginTop: 'var(--spacing-lg)' }}>

                {/* Income Card */}
                <div style={{ backgroundColor: 'var(--color-card)', padding: 'var(--spacing-xl)', borderRadius: 'var(--radius-lg)' }}>
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: 'var(--spacing-lg)' }}>
                        <TrendingUp color="var(--color-success)" /> Ingresos Totales
                    </h3>
                    <div style={{ fontSize: '32px', fontWeight: 'bold' }}>
                        ${totalIncome.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                    </div>
                    <p style={{ color: 'var(--color-text-secondary)', marginTop: '8px' }}>
                        Histórico acumulado
                    </p>
                </div>

                {/* Methods Card */}
                <div style={{ backgroundColor: 'var(--color-card)', padding: 'var(--spacing-xl)', borderRadius: 'var(--radius-lg)' }}>
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: 'var(--spacing-lg)' }}>
                        <PieChart color="var(--color-accent)" /> Desglose por Método
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {Object.entries(paymentMethods).map(([method, amount]) => (
                            <div key={method} style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ textTransform: 'capitalize' }}>{method}</span>
                                <b>${amount.toLocaleString()}</b>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Members KPI */}
                <div style={{ backgroundColor: 'var(--color-card)', padding: 'var(--spacing-xl)', borderRadius: 'var(--radius-lg)' }}>
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: 'var(--spacing-lg)' }}>
                        <BarChart color="var(--color-warning)" /> Membresías
                    </h3>
                    <div style={{ fontSize: '32px', fontWeight: 'bold' }}>
                        {activeMembers}
                    </div>
                    <p style={{ color: 'var(--color-text-secondary)', marginTop: '8px' }}>
                        Miembros Activos
                    </p>
                </div>
            </div>

            {/* Accesos Section */}
            <div style={{ marginTop: 'var(--spacing-xl)' }}>
                <AttendanceShiftChart />
            </div>

            {/* Daily Summary Section */}
            <div style={{ marginTop: 'var(--spacing-xl)' }}>
                <h3>Resumen Diario (Ventas y Asistencia)</h3>
                <DailyReportTable />
            </div>

            {/* Monthly Summary Section */}
            <div style={{ marginTop: 'var(--spacing-xl)' }}>
                <h3>Resumen Mensual</h3>
                <MonthlyReportTable />
            </div>

            {/* Shift History Section */}
            <div style={{ marginTop: 'var(--spacing-xl)' }}>
                <h3>Historial de Cortes de Caja</h3>
                <ShiftHistoryTable />
            </div>
        </div>
    );
}

type ShiftHistoryItem = Shift & { profiles?: { nombre: string } };

function AttendanceShiftChart() {
    const [data, setData] = useState<{ date: string; matutino: number; vespertino: number }[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        import('../../logic/api/attendanceService').then(mod => {
            mod.getDailyAttendanceByShift(7).then(res => {
                setData(res);
                setLoading(false);
            });
        });
    }, []);

    if (loading) return <div>Cargando accesos...</div>;

    const formattedData = data.map(d => ({
        ...d,
        // force midday to avoid timezone issues when converting to date string
        displayDate: new Date(`${d.date}T12:00:00Z`).toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric' })
    }));

    return (
        <div style={{ backgroundColor: 'var(--color-card)', padding: 'var(--spacing-xl)', borderRadius: 'var(--radius-lg)', height: '400px' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: 'var(--spacing-lg)' }}>
                <Users color="var(--color-primary)" /> Accesos por Turno (Últimos 7 días)
            </h3>
            <ResponsiveContainer width="100%" height="85%">
                <RechartsBarChart data={formattedData}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                    <XAxis dataKey="displayDate" stroke="var(--color-text-secondary)" fontSize={12} />
                    <YAxis stroke="var(--color-text-secondary)" fontSize={12} />
                    <Tooltip 
                        contentStyle={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: '8px' }}
                        itemStyle={{ color: 'var(--color-text)' }}
                    />
                    <Legend />
                    <Bar dataKey="matutino" name="Matutino" fill="var(--color-warning)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="vespertino" name="Vespertino" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
                </RechartsBarChart>
            </ResponsiveContainer>
        </div>
    );
}

function ShiftHistoryTable() {
    const [history, setHistory] = useState<ShiftHistoryItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Dynamic import to avoid circular dep issues in some bundlers if logic grows, 
        // though here it's fine. keeping pattern consistent.
        import('../../logic/api/financeService').then(mod => {
            mod.getShiftHistory().then(data => {
                setHistory(data as ShiftHistoryItem[]);
                setLoading(false);
            });
        });
    }, []);

    if (loading) return <div>Cargando historial...</div>;
    if (history.length === 0) return <div style={{ fontStyle: 'italic', color: 'var(--color-text-secondary)' }}>No hay cortes registrados aún.</div>;

    return (
        <div style={{ overflowX: 'auto', backgroundColor: 'var(--color-card)', borderRadius: '12px', padding: '10px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '700px' }}>
                <thead>
                    <tr style={{ textAlign: 'left', color: 'var(--color-text-secondary)', borderBottom: '1px solid var(--color-border)' }}>
                        <th style={{ padding: '12px' }}>Fecha Cierre</th>
                        <th style={{ padding: '12px' }}>Colaborador</th>
                        <th style={{ padding: '12px' }}>Duración</th>
                        <th style={{ padding: '12px' }}>Efectivo Inicial</th>
                        <th style={{ padding: '12px' }}>Ventas +</th>
                        <th style={{ padding: '12px' }}>Retiros -</th>
                        <th style={{ padding: '12px' }}>Total Esperado</th>
                        <th style={{ padding: '12px' }}>Declarado</th>
                        <th style={{ padding: '12px' }}>Diferencia</th>
                    </tr>
                </thead>
                <tbody>
                    {history.map(shift => {
                        const start = new Date(shift.hora_inicio);
                        const end = shift.hora_cierre ? new Date(shift.hora_cierre) : new Date();
                        const durationHrs = ((end.getTime() - start.getTime()) / 3600000).toFixed(1);

                        // Expected (Total theoretical cash in drawer)
                        const expected = Number(shift.total_efectivo || 0);

                        // Calculate Sales
                        // Sales = Expected (Total Cash in Hand theoretical) - Initial Cash + Withdrawals
                        const sales = (expected) - Number(shift.monto_inicial || 0) + Number(shift.retiros || 0);

                        // Calculated declared from 'desglose_cierre'
                        let declared = 0;
                        if (shift.desglose_cierre) {
                            try {
                                const counts = typeof (shift.desglose_cierre as any) === 'string' ? JSON.parse((shift.desglose_cierre as any)) : shift.desglose_cierre;
                                declared = Object.entries(counts).reduce((acc, [denom, qty]) => acc + (Number(denom) * (qty as number)), 0);
                            } catch (e) {
                                console.error('Error parsing cash count', e);
                            }
                        }

                        const diff = declared - expected;
                        const diffColor = diff === 0 ? 'var(--color-text-secondary)' : diff < 0 ? 'var(--color-danger)' : 'var(--color-success)';

                        return (
                            <tr key={shift.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                <td style={{ padding: '12px' }}>
                                    {end.toLocaleDateString()} <small style={{ color: 'gray' }}>{end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small>
                                </td>
                                <td style={{ padding: '12px', fontWeight: 'bold' }}>{shift.profiles?.nombre || 'N/A'}</td>
                                <td style={{ padding: '12px' }}>{durationHrs} hrs</td>
                                <td style={{ padding: '12px' }}>${Number(shift.monto_inicial || 0).toLocaleString()}</td>
                                <td style={{ padding: '12px', color: 'var(--color-success)' }}>
                                    ${sales.toLocaleString()}
                                </td>
                                <td style={{ padding: '12px', color: 'var(--color-danger)' }}>${Number(shift.retiros || 0).toLocaleString()}</td>
                                <td style={{ padding: '12px', fontWeight: 'bold' }}>${expected.toLocaleString()}</td>
                                <td style={{ padding: '12px' }}>${declared.toLocaleString()}</td>
                                <td style={{ padding: '12px', color: diffColor, fontWeight: 'bold' }}>
                                    {diff > 0 ? '+' : ''}{diff.toLocaleString()}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

function DailyReportTable() {
    const [data, setData] = useState<DailyReportRow[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        import('../../logic/api/financeService').then(mod => {
            mod.getDailyPerformanceSummary(7).then(res => {
                setData(res);
                setLoading(false);
            });
        });
    }, []);

    if (loading) return <div>Cargando resumen diario...</div>;
    if (data.length === 0) return <div style={{ fontStyle: 'italic', color: 'var(--color-text-secondary)' }}>No hay datos disponibles.</div>;

    // Obtener todos los tipos de planes únicos para renderizar las columnas dinámicamente
    const allPlanNames = Array.from(new Set(data.flatMap(row => Object.keys(row.paymentsByPlan))));

    return (
        <div style={{ overflowX: 'auto', backgroundColor: 'var(--color-card)', borderRadius: '12px', padding: '10px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px', fontSize: '14px' }}>
                <thead>
                    <tr style={{ textAlign: 'left', color: 'var(--color-text-secondary)', borderBottom: '1px solid var(--color-border)', backgroundColor: 'rgba(255,255,255,0.02)' }}>
                        <th style={{ padding: '12px' }}>Día</th>
                        <th style={{ padding: '12px' }}>Turno Mat.</th>
                        <th style={{ padding: '12px' }}>Turno Vesp.</th>
                        <th style={{ padding: '12px', fontWeight: 'bold' }}>Total Asistentes</th>
                        {allPlanNames.map(planName => (
                            <th key={planName} style={{ padding: '12px', borderLeft: '1px solid rgba(255,255,255,0.05)' }}>
                                {planName}
                            </th>
                        ))}
                        <th style={{ padding: '12px', borderLeft: '1px solid rgba(255,255,255,0.05)' }}>Cortes Entregados</th>
                    </tr>
                </thead>
                <tbody>
                    {data.map(row => {
                        const displayDate = new Date(`${row.date}T12:00:00Z`).toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' });
                        return (
                            <tr key={row.date} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                <td style={{ padding: '12px', textTransform: 'capitalize' }}>{displayDate}</td>
                                <td style={{ padding: '12px' }}>{row.attendeesMorning}</td>
                                <td style={{ padding: '12px' }}>{row.attendeesEvening}</td>
                                <td style={{ padding: '12px', fontWeight: 'bold' }}>{row.totalAttendees}</td>
                                {allPlanNames.map(planName => (
                                    <td key={planName} style={{ padding: '12px', borderLeft: '1px solid rgba(255,255,255,0.05)' }}>
                                        {row.paymentsByPlan[planName] || 0}
                                    </td>
                                ))}
                                <td style={{ padding: '12px', borderLeft: '1px solid rgba(255,255,255,0.05)', color: 'var(--color-success)', fontWeight: 'bold' }}>
                                    ${row.totalShiftReturns.toLocaleString()}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

function MonthlyReportTable() {
    const [data, setData] = useState<MonthlyReportRow[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        import('../../logic/api/financeService').then(mod => {
            mod.getMonthlyPerformanceSummary(6).then(res => {
                setData(res);
                setLoading(false);
            });
        });
    }, []);

    if (loading) return <div>Cargando resumen mensual...</div>;
    if (data.length === 0) return <div style={{ fontStyle: 'italic', color: 'var(--color-text-secondary)' }}>No hay datos disponibles.</div>;

    // Obtener todos los tipos de planes únicos para renderizar las columnas dinámicamente
    const allPlanNames = Array.from(new Set(data.flatMap(row => Object.keys(row.paymentsByPlan))));

    return (
        <div style={{ overflowX: 'auto', backgroundColor: 'var(--color-card)', borderRadius: '12px', padding: '10px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px', fontSize: '14px' }}>
                <thead>
                    <tr style={{ textAlign: 'left', color: 'var(--color-text-secondary)', borderBottom: '1px solid var(--color-border)', backgroundColor: 'rgba(255,255,255,0.02)' }}>
                        <th style={{ padding: '12px' }}>Mes</th>
                        <th style={{ padding: '12px' }}>Turno Mat.</th>
                        <th style={{ padding: '12px' }}>Turno Vesp.</th>
                        <th style={{ padding: '12px', fontWeight: 'bold' }}>Total Asistentes</th>
                        {allPlanNames.map(planName => (
                            <th key={planName} style={{ padding: '12px', borderLeft: '1px solid rgba(255,255,255,0.05)' }}>
                                {planName}
                            </th>
                        ))}
                        <th style={{ padding: '12px', borderLeft: '1px solid rgba(255,255,255,0.05)' }}>Cortes Entregados</th>
                    </tr>
                </thead>
                <tbody>
                    {data.map(row => {
                        // row.monthStr is "YYYY-MM"
                        const [yyyy, mm] = row.monthStr.split('-');
                        const displayDate = new Date(Number(yyyy), Number(mm) - 1, 1).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
                        return (
                            <tr key={row.monthStr} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                <td style={{ padding: '12px', textTransform: 'capitalize' }}>{displayDate}</td>
                                <td style={{ padding: '12px' }}>{row.attendeesMorning}</td>
                                <td style={{ padding: '12px' }}>{row.attendeesEvening}</td>
                                <td style={{ padding: '12px', fontWeight: 'bold' }}>{row.totalAttendees}</td>
                                {allPlanNames.map(planName => (
                                    <td key={planName} style={{ padding: '12px', borderLeft: '1px solid rgba(255,255,255,0.05)' }}>
                                        {row.paymentsByPlan[planName] || 0}
                                    </td>
                                ))}
                                <td style={{ padding: '12px', borderLeft: '1px solid rgba(255,255,255,0.05)', color: 'var(--color-success)', fontWeight: 'bold' }}>
                                    ${row.totalShiftReturns.toLocaleString()}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
