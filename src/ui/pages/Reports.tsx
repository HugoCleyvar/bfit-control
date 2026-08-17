import { useEffect, useState, useCallback } from 'react';
import type { CSSProperties } from 'react';
import { getIncomeSummary, getShiftHistory, getDailyPerformanceSummary, getMonthlyPerformanceSummary } from '../../logic/api/financeService';
import { getActiveMemberCount } from '../../logic/api/memberService';
import { getDailyAttendanceByShift } from '../../logic/api/attendanceService';
import { startOfLocalDay, endOfLocalDay } from '../../domain/dateUtils';
import type { DailyReportRow, MonthlyReportRow, ShiftHistoryRow } from '../../logic/api/financeService';

import { BarChart, PieChart, TrendingUp, Users } from 'lucide-react';
import { BarChart as RechartsBarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts';

function formatMoney(amount: number): string {
    return amount.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface DateRange {
    from: Date;
    to: Date;
}

type RangePreset = '7d' | '30d' | 'month' | 'custom';

function quickPresetRange(preset: '7d' | '30d'): DateRange {
    const today = new Date();
    const to = endOfLocalDay(today);
    const daysBack = preset === '7d' ? 6 : 29;
    return { from: startOfLocalDay(new Date(today.getFullYear(), today.getMonth(), today.getDate() - daysBack)), to };
}

// Full calendar month (1st to last day). If the picked month is still in progress, "to" is
// capped at today instead of running past it.
function monthRange(monthValue: string): DateRange {
    const [y, m] = monthValue.split('-').map(Number);
    const from = new Date(y, m - 1, 1);
    const lastDayOfMonth = new Date(y, m, 0); // day 0 of next month = last day of this one
    const today = new Date();
    const to = lastDayOfMonth < today ? endOfLocalDay(lastDayOfMonth) : endOfLocalDay(today);
    return { from: startOfLocalDay(from), to };
}

// YYYY-MM-DD using local date parts, for <input type="date"> - toISOString() would shift
// the date across timezone boundaries and desync the picker from what's selected.
function toDateInputValue(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function parseDateInputValue(value: string): Date {
    const [y, m, d] = value.split('-').map(Number);
    return new Date(y, m - 1, d);
}

// YYYY-MM using local date parts, for <input type="month">
function toMonthInputValue(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
}

function pickerButtonStyle(active: boolean): CSSProperties {
    return {
        padding: '8px 16px',
        borderRadius: '20px',
        border: '1px solid var(--color-border)',
        background: active ? 'var(--color-primary)' : 'transparent',
        color: active ? 'black' : 'var(--color-text)',
        cursor: 'pointer',
        fontSize: '13px'
    };
}

const pickerInputStyle: CSSProperties = {
    padding: '7px 10px',
    borderRadius: '8px',
    border: '1px solid var(--color-border)',
    backgroundColor: 'var(--color-bg)',
    color: 'var(--color-text)',
    fontSize: '13px'
};

const QUICK_PRESETS: { key: '7d' | '30d'; label: string }[] = [
    { key: '7d', label: 'Últimos 7 días' },
    { key: '30d', label: 'Últimos 30 días' }
];

function DateRangePicker({ range, onChange }: { range: DateRange; onChange: (range: DateRange) => void }) {
    const [preset, setPreset] = useState<RangePreset>('7d');
    const [monthValue, setMonthValue] = useState(() => toMonthInputValue(new Date()));
    const todayInputValue = toDateInputValue(new Date());

    const applyQuickPreset = (p: '7d' | '30d') => {
        setPreset(p);
        onChange(quickPresetRange(p));
    };

    const selectMonthMode = () => {
        setPreset('month');
        onChange(monthRange(monthValue));
    };

    const handleMonthChange = (value: string) => {
        if (!value) return;
        setMonthValue(value);
        onChange(monthRange(value));
    };

    const handleCustomChange = (field: 'from' | 'to', value: string) => {
        if (!value) return;
        const picked = parseDateInputValue(value);

        if (field === 'from') {
            const from = startOfLocalDay(picked);
            onChange({ from, to: from > range.to ? endOfLocalDay(picked) : range.to });
        } else {
            const to = endOfLocalDay(picked);
            onChange({ from: to < range.from ? startOfLocalDay(picked) : range.from, to });
        }
    };

    return (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
            {QUICK_PRESETS.map(({ key, label }) => (
                <button key={key} onClick={() => applyQuickPreset(key)} style={pickerButtonStyle(preset === key)}>
                    {label}
                </button>
            ))}

            <button onClick={selectMonthMode} style={pickerButtonStyle(preset === 'month')}>
                Por mes
            </button>
            {preset === 'month' && (
                <input
                    type="month"
                    value={monthValue}
                    max={toMonthInputValue(new Date())}
                    onChange={e => handleMonthChange(e.target.value)}
                    style={pickerInputStyle}
                />
            )}

            <button onClick={() => setPreset('custom')} style={pickerButtonStyle(preset === 'custom')}>
                Personalizado
            </button>
            {preset === 'custom' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                        type="date"
                        value={toDateInputValue(range.from)}
                        max={toDateInputValue(range.to)}
                        onChange={e => handleCustomChange('from', e.target.value)}
                        style={pickerInputStyle}
                    />
                    <span style={{ color: 'var(--color-text-secondary)' }}>–</span>
                    <input
                        type="date"
                        value={toDateInputValue(range.to)}
                        min={toDateInputValue(range.from)}
                        max={todayInputValue}
                        onChange={e => handleCustomChange('to', e.target.value)}
                        style={pickerInputStyle}
                    />
                </div>
            )}
        </div>
    );
}

export default function Reports() {
    const [loading, setLoading] = useState(true);
    const [totalIncome, setTotalIncome] = useState(0);
    const [paymentMethods, setPaymentMethods] = useState<Record<string, number>>({});
    const [activeMembers, setActiveMembers] = useState(0);

    const loadData = useCallback(async () => {
        setLoading(true);
        const [incomeSummary, activeCount] = await Promise.all([
            getIncomeSummary(),
            getActiveMemberCount()
        ]);

        setTotalIncome(incomeSummary.total);
        setPaymentMethods(incomeSummary.byMethod);
        setActiveMembers(activeCount);

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
                        ${formatMoney(totalIncome)}
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
                                <b>${formatMoney(amount)}</b>
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

            {/* Accesos Section - has its own independent date range picker */}
            <div style={{ marginTop: 'var(--spacing-xl)' }}>
                <AttendanceShiftChart />
            </div>

            {/* Daily Summary Section - has its own independent date range picker */}
            <div style={{ marginTop: 'var(--spacing-xl)' }}>
                <DailyReportTable />
            </div>

            {/* Monthly Summary Section - independent rolling 6-month trend */}
            <div style={{ marginTop: 'var(--spacing-xl)' }}>
                <h3>Resumen Mensual (Últimos 6 Meses)</h3>
                <MonthlyReportTable />
            </div>

            {/* Shift History Section - independent audit log of the last closed shifts */}
            <div style={{ marginTop: 'var(--spacing-xl)' }}>
                <h3>Historial de Cortes de Caja (Últimos 20)</h3>
                <ShiftHistoryTable />
            </div>
        </div>
    );
}

function AttendanceShiftChart() {
    const [range, setRange] = useState<DateRange>(() => quickPresetRange('7d'));
    const [data, setData] = useState<{ date: string; matutino: number; vespertino: number }[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        getDailyAttendanceByShift(range.from, range.to).then(res => {
            setData(res);
            setLoading(false);
        });
    }, [range]);

    const formattedData = data.map(d => ({
        ...d,
        // force midday to avoid timezone issues when converting to date string
        displayDate: new Date(`${d.date}T12:00:00Z`).toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric' })
    }));

    return (
        <div style={{ backgroundColor: 'var(--color-card)', padding: 'var(--spacing-xl)', borderRadius: 'var(--radius-lg)', minHeight: '440px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: 'var(--spacing-lg)' }}>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
                    <Users color="var(--color-primary)" /> Accesos por Turno
                </h3>
                <DateRangePicker range={range} onChange={setRange} />
            </div>
            {loading ? (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-secondary)' }}>
                    Cargando accesos...
                </div>
            ) : (
                <div style={{ flex: 1, minHeight: 0 }}>
                    <ResponsiveContainer width="100%" height="100%">
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
            )}
        </div>
    );
}

function ShiftHistoryTable() {
    const [history, setHistory] = useState<ShiftHistoryRow[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        getShiftHistory().then(data => {
            setHistory(data);
            setLoading(false);
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

                        // Expected (Total theoretical cash in drawer, rebuilt from payments/expenses -
                        // shift.total_efectivo itself gets overwritten with the counted amount on close)
                        const expected = shift.total_teorico;

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
                                <td style={{ padding: '12px' }}>${formatMoney(Number(shift.monto_inicial || 0))}</td>
                                <td style={{ padding: '12px', color: 'var(--color-success)' }}>
                                    ${formatMoney(sales)}
                                </td>
                                <td style={{ padding: '12px', color: 'var(--color-danger)' }}>${formatMoney(Number(shift.retiros || 0))}</td>
                                <td style={{ padding: '12px', fontWeight: 'bold' }}>${formatMoney(expected)}</td>
                                <td style={{ padding: '12px' }}>${formatMoney(declared)}</td>
                                <td style={{ padding: '12px', color: diffColor, fontWeight: 'bold' }}>
                                    {diff > 0 ? '+' : ''}${formatMoney(diff)}
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
    const [range, setRange] = useState<DateRange>(() => quickPresetRange('7d'));
    const [data, setData] = useState<DailyReportRow[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        getDailyPerformanceSummary(range.from, range.to).then(res => {
            setData(res);
            setLoading(false);
        });
    }, [range]);

    // Obtener todos los tipos de planes únicos para renderizar las columnas dinámicamente
    const allPlanNames = Array.from(new Set(data.flatMap(row => Object.keys(row.paymentsByPlan))));

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: 'var(--spacing-md)' }}>
                <h3 style={{ margin: 0 }}>Resumen Diario (Ventas y Asistencia)</h3>
                <DateRangePicker range={range} onChange={setRange} />
            </div>

            {loading ? (
                <div style={{ padding: '20px', color: 'var(--color-text-secondary)' }}>Cargando resumen diario...</div>
            ) : data.length === 0 ? (
                <div style={{ padding: '20px', fontStyle: 'italic', color: 'var(--color-text-secondary)' }}>No hay datos disponibles.</div>
            ) : (
                <div style={{ overflowX: 'auto', backgroundColor: 'var(--color-card)', borderRadius: '12px', padding: '10px' }}>
                    <p style={{ padding: '0 12px', margin: '4px 0 10px', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                        Las columnas de plan muestran <b>número de pagos</b>, no montos — solo "Cortes Entregados" es dinero.
                    </p>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px', fontSize: '14px' }}>
                        <thead>
                            <tr style={{ textAlign: 'left', color: 'var(--color-text-secondary)', borderBottom: '1px solid var(--color-border)', backgroundColor: 'rgba(255,255,255,0.02)' }}>
                                <th style={{ padding: '12px' }}>Día</th>
                                <th style={{ padding: '12px' }}>Turno Mat.</th>
                                <th style={{ padding: '12px' }}>Turno Vesp.</th>
                                <th style={{ padding: '12px', fontWeight: 'bold' }}>Total Asistentes</th>
                                {allPlanNames.map(planName => (
                                    <th key={planName} style={{ padding: '12px', borderLeft: '1px solid rgba(255,255,255,0.05)' }}>
                                        {planName} (pagos)
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
                                            ${formatMoney(row.totalShiftReturns)}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

function MonthlyReportTable() {
    const [data, setData] = useState<MonthlyReportRow[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        getMonthlyPerformanceSummary(6).then(res => {
            setData(res);
            setLoading(false);
        });
    }, []);

    if (loading) return <div>Cargando resumen mensual...</div>;
    if (data.length === 0) return <div style={{ fontStyle: 'italic', color: 'var(--color-text-secondary)' }}>No hay datos disponibles.</div>;

    // Obtener todos los tipos de planes únicos para renderizar las columnas dinámicamente
    const allPlanNames = Array.from(new Set(data.flatMap(row => Object.keys(row.paymentsByPlan))));

    return (
        <div style={{ overflowX: 'auto', backgroundColor: 'var(--color-card)', borderRadius: '12px', padding: '10px' }}>
            <p style={{ padding: '0 12px', margin: '4px 0 10px', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                Las columnas de plan muestran <b>número de pagos</b>, no montos — solo "Cortes Entregados" es dinero.
            </p>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px', fontSize: '14px' }}>
                <thead>
                    <tr style={{ textAlign: 'left', color: 'var(--color-text-secondary)', borderBottom: '1px solid var(--color-border)', backgroundColor: 'rgba(255,255,255,0.02)' }}>
                        <th style={{ padding: '12px' }}>Mes</th>
                        <th style={{ padding: '12px' }}>Turno Mat.</th>
                        <th style={{ padding: '12px' }}>Turno Vesp.</th>
                        <th style={{ padding: '12px', fontWeight: 'bold' }}>Total Asistentes</th>
                        {allPlanNames.map(planName => (
                            <th key={planName} style={{ padding: '12px', borderLeft: '1px solid rgba(255,255,255,0.05)' }}>
                                {planName} (pagos)
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
                                    ${formatMoney(row.totalShiftReturns)}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
