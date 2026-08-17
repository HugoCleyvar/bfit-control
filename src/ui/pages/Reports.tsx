import { useEffect, useState, useCallback } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { getIncomeSummary, getShiftHistory, getDailyPerformanceSummary, getMonthlyPerformanceSummary, getRevenueByShiftType } from '../../logic/api/financeService';
import { getActiveMemberCount, getActiveMembersByPlan, getNewMembersByMonth, getChurnedMembers, getExpiredMembersWithUnpaidAttendance } from '../../logic/api/memberService';
import { getDailyAttendanceByShift } from '../../logic/api/attendanceService';
import { getExpiringMembers } from '../../logic/api/gamificationService';
import { startOfLocalDay, endOfLocalDay } from '../../domain/dateUtils';
import type { DailyReportRow, MonthlyReportRow, ShiftHistoryRow, ShiftTypeRevenue } from '../../logic/api/financeService';
import type { PlanMemberCount, NewMembersRow, ChurnedMember, UnpaidAttendanceAlert } from '../../logic/api/memberService';
import type { ExpiringMember } from '../../logic/api/gamificationService';

import { TrendingUp, Users, Clock, Tag, UserPlus, UserMinus, AlertTriangle, CalendarClock } from 'lucide-react';
import { BarChart as RechartsBarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts';

function formatMoney(amount: number): string {
    return amount.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ---------------------------------------------------------------------------
// Shared date range picker (used by the "diario" sub-sections and by Membresías)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Small shared UI bits
// ---------------------------------------------------------------------------

function sectionCardStyle(): CSSProperties {
    return { backgroundColor: 'var(--color-card)', padding: 'var(--spacing-xl)', borderRadius: 'var(--radius-lg)' };
}

function monthLabel(monthStr: string): string {
    const [yyyy, mm] = monthStr.split('-');
    return new Date(Number(yyyy), Number(mm) - 1, 1).toLocaleDateString('es-MX', { month: 'short', year: '2-digit' });
}

// ---------------------------------------------------------------------------
// Main page: KPI strip + tabs
// ---------------------------------------------------------------------------

type ReportTab = 'resumen' | 'cortes' | 'membresias';

const TABS: { key: ReportTab; label: string }[] = [
    { key: 'resumen', label: 'Resumen' },
    { key: 'cortes', label: 'Cortes de Caja' },
    { key: 'membresias', label: 'Membresías' }
];

export default function Reports() {
    const [loading, setLoading] = useState(true);
    const [totalIncome, setTotalIncome] = useState(0);
    const [activeMembers, setActiveMembers] = useState(0);
    const [activeTab, setActiveTab] = useState<ReportTab>('resumen');

    const loadData = useCallback(async () => {
        setLoading(true);
        const [incomeSummary, activeCount] = await Promise.all([
            getIncomeSummary(),
            getActiveMemberCount()
        ]);

        setTotalIncome(incomeSummary.total);
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

            {/* Always-visible KPI strip */}
            <div style={{ display: 'flex', gap: 'var(--spacing-lg)', marginTop: 'var(--spacing-lg)', flexWrap: 'wrap' }}>
                <div style={{ ...sectionCardStyle(), flex: '1 1 220px', display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <TrendingUp color="var(--color-success)" size={28} />
                    <div>
                        <div style={{ fontSize: '24px', fontWeight: 'bold' }}>${formatMoney(totalIncome)}</div>
                        <div style={{ color: 'var(--color-text-secondary)', fontSize: '13px' }}>Ingresos históricos totales</div>
                    </div>
                </div>
                <div style={{ ...sectionCardStyle(), flex: '1 1 220px', display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <Users color="var(--color-primary)" size={28} />
                    <div>
                        <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{activeMembers}</div>
                        <div style={{ color: 'var(--color-text-secondary)', fontSize: '13px' }}>Miembros activos</div>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: '4px', marginTop: 'var(--spacing-xl)', borderBottom: '1px solid var(--color-border)' }}>
                {TABS.map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        style={{
                            padding: '12px 20px',
                            background: 'transparent',
                            border: 'none',
                            borderBottom: activeTab === tab.key ? '2px solid var(--color-primary)' : '2px solid transparent',
                            color: activeTab === tab.key ? 'var(--color-text)' : 'var(--color-text-secondary)',
                            fontWeight: activeTab === tab.key ? 'bold' : 'normal',
                            cursor: 'pointer',
                            fontSize: '15px'
                        }}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            <div style={{ marginTop: 'var(--spacing-xl)' }}>
                {activeTab === 'resumen' && <ResumenTab />}
                {activeTab === 'cortes' && <CortesTab />}
                {activeTab === 'membresias' && <MembresiasTab />}
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Tab: Resumen - Asistencia / Ingresos / Por Turno / Por Membresía
// ---------------------------------------------------------------------------

function ResumenTab() {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xl)' }}>
            <AttendanceSection />
            <IncomeSection />
            <ShiftTypeSection />
            <MembershipTypeSection />
        </div>
    );
}

function sectionHeading(icon: ReactNode, title: string) {
    return (
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: 'var(--spacing-md)' }}>
            {icon} {title}
        </h3>
    );
}

function AttendanceSection() {
    const [range, setRange] = useState<DateRange>(() => quickPresetRange('7d'));
    const [daily, setDaily] = useState<{ date: string; matutino: number; vespertino: number }[]>([]);
    const [monthly, setMonthly] = useState<MonthlyReportRow[]>([]);
    const [loadingDaily, setLoadingDaily] = useState(true);
    const [loadingMonthly, setLoadingMonthly] = useState(true);

    useEffect(() => {
        setLoadingDaily(true);
        getDailyAttendanceByShift(range.from, range.to).then(res => {
            setDaily(res);
            setLoadingDaily(false);
        });
    }, [range]);

    useEffect(() => {
        getMonthlyPerformanceSummary(12).then(res => {
            setMonthly([...res].reverse());
            setLoadingMonthly(false);
        });
    }, []);

    const dailyFormatted = daily.map(d => ({
        ...d,
        displayDate: new Date(`${d.date}T12:00:00Z`).toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric' })
    }));

    const monthlyFormatted = monthly.map(row => ({ displayDate: monthLabel(row.monthStr), total: row.totalAttendees }));

    return (
        <section>
            {sectionHeading(<Users color="var(--color-primary)" />, 'Asistencia')}

            <div style={{ ...sectionCardStyle(), marginBottom: 'var(--spacing-md)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: 'var(--spacing-md)' }}>
                    <h4 style={{ margin: 0, color: 'var(--color-text-secondary)', fontWeight: 'normal' }}>Diario</h4>
                    <DateRangePicker range={range} onChange={setRange} />
                </div>
                {loadingDaily ? (
                    <div style={{ padding: '30px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>Cargando...</div>
                ) : (
                    <div style={{ height: '300px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <RechartsBarChart data={dailyFormatted}>
                                <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                                <XAxis dataKey="displayDate" stroke="var(--color-text-secondary)" fontSize={12} />
                                <YAxis stroke="var(--color-text-secondary)" fontSize={12} allowDecimals={false} />
                                <Tooltip contentStyle={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: '8px' }} itemStyle={{ color: 'var(--color-text)' }} />
                                <Legend />
                                <Bar dataKey="matutino" name="Matutino" fill="var(--color-warning)" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="vespertino" name="Vespertino" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
                            </RechartsBarChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </div>

            <div style={sectionCardStyle()}>
                <h4 style={{ margin: '0 0 var(--spacing-md)', color: 'var(--color-text-secondary)', fontWeight: 'normal' }}>
                    Mensual (últimos 12 meses - compara entre meses y, cuando haya suficiente historial, entre años)
                </h4>
                {loadingMonthly ? (
                    <div style={{ padding: '30px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>Cargando...</div>
                ) : (
                    <div style={{ height: '280px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <RechartsBarChart data={monthlyFormatted}>
                                <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                                <XAxis dataKey="displayDate" stroke="var(--color-text-secondary)" fontSize={12} />
                                <YAxis stroke="var(--color-text-secondary)" fontSize={12} allowDecimals={false} />
                                <Tooltip contentStyle={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: '8px' }} itemStyle={{ color: 'var(--color-text)' }} />
                                <Bar dataKey="total" name="Asistentes" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
                            </RechartsBarChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </div>
        </section>
    );
}

function IncomeSection() {
    const [range, setRange] = useState<DateRange>(() => quickPresetRange('7d'));
    const [daily, setDaily] = useState<DailyReportRow[]>([]);
    const [monthly, setMonthly] = useState<MonthlyReportRow[]>([]);
    const [methods, setMethods] = useState<Record<string, number>>({});
    const [loadingDaily, setLoadingDaily] = useState(true);
    const [loadingMonthly, setLoadingMonthly] = useState(true);

    useEffect(() => {
        setLoadingDaily(true);
        getDailyPerformanceSummary(range.from, range.to).then(res => {
            setDaily(res);
            setLoadingDaily(false);
        });
    }, [range]);

    useEffect(() => {
        getMonthlyPerformanceSummary(12).then(res => {
            setMonthly([...res].reverse());
            setLoadingMonthly(false);
        });
    }, []);

    useEffect(() => {
        getIncomeSummary().then(res => setMethods(res.byMethod));
    }, []);

    const dailyFormatted = daily.map(d => ({
        displayDate: new Date(`${d.date}T12:00:00Z`).toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric' }),
        total: d.totalRevenue
    }));

    const monthlyFormatted = monthly.map(row => ({ displayDate: monthLabel(row.monthStr), total: row.totalRevenue }));

    return (
        <section>
            {sectionHeading(<TrendingUp color="var(--color-success)" />, 'Ingresos')}

            <div style={{ ...sectionCardStyle(), marginBottom: 'var(--spacing-md)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: 'var(--spacing-md)' }}>
                    <h4 style={{ margin: 0, color: 'var(--color-text-secondary)', fontWeight: 'normal' }}>Diario</h4>
                    <DateRangePicker range={range} onChange={setRange} />
                </div>
                {loadingDaily ? (
                    <div style={{ padding: '30px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>Cargando...</div>
                ) : (
                    <div style={{ height: '300px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <RechartsBarChart data={dailyFormatted}>
                                <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                                <XAxis dataKey="displayDate" stroke="var(--color-text-secondary)" fontSize={12} />
                                <YAxis stroke="var(--color-text-secondary)" fontSize={12} tickFormatter={v => `$${v}`} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: '8px' }}
                                    itemStyle={{ color: 'var(--color-text)' }}
                                    formatter={(v: number | string | undefined) => [`$${formatMoney(Number(v || 0))}`, 'Ingresos']}
                                />
                                <Bar dataKey="total" name="Ingresos" fill="var(--color-success)" radius={[4, 4, 0, 0]} />
                            </RechartsBarChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 'var(--spacing-md)' }}>
                <div style={sectionCardStyle()}>
                    <h4 style={{ margin: '0 0 var(--spacing-md)', color: 'var(--color-text-secondary)', fontWeight: 'normal' }}>
                        Mensual (últimos 12 meses)
                    </h4>
                    {loadingMonthly ? (
                        <div style={{ padding: '30px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>Cargando...</div>
                    ) : (
                        <div style={{ height: '260px' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <RechartsBarChart data={monthlyFormatted}>
                                    <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                                    <XAxis dataKey="displayDate" stroke="var(--color-text-secondary)" fontSize={12} />
                                    <YAxis stroke="var(--color-text-secondary)" fontSize={12} tickFormatter={v => `$${v}`} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: '8px' }}
                                        itemStyle={{ color: 'var(--color-text)' }}
                                        formatter={(v: number | string | undefined) => [`$${formatMoney(Number(v || 0))}`, 'Ingresos']}
                                    />
                                    <Bar dataKey="total" name="Ingresos" fill="var(--color-success)" radius={[4, 4, 0, 0]} />
                                </RechartsBarChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </div>

                <div style={sectionCardStyle()}>
                    <h4 style={{ margin: '0 0 var(--spacing-md)', color: 'var(--color-text-secondary)', fontWeight: 'normal' }}>
                        Desglose por método (histórico)
                    </h4>
                    {Object.keys(methods).length === 0 ? (
                        <p style={{ color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>Sin pagos registrados.</p>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {Object.entries(methods).map(([method, amount]) => (
                                <div key={method} style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ textTransform: 'capitalize' }}>{method}</span>
                                    <b>${formatMoney(amount)}</b>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
}

function ShiftTypeSection() {
    const [range, setRange] = useState<DateRange>(() => quickPresetRange('30d'));
    const [revenue, setRevenue] = useState<ShiftTypeRevenue>({ matutino: 0, vespertino: 0 });
    const [attendance, setAttendance] = useState<{ matutino: number; vespertino: number }>({ matutino: 0, vespertino: 0 });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        Promise.all([
            getRevenueByShiftType(range.from, range.to),
            getDailyAttendanceByShift(range.from, range.to)
        ]).then(([rev, byDay]) => {
            setRevenue(rev);
            setAttendance({
                matutino: byDay.reduce((sum, d) => sum + d.matutino, 0),
                vespertino: byDay.reduce((sum, d) => sum + d.vespertino, 0)
            });
            setLoading(false);
        });
    }, [range]);

    return (
        <section>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: 'var(--spacing-md)' }}>
                {sectionHeading(<Clock color="var(--color-warning)" />, 'Por Turno')}
                <DateRangePicker range={range} onChange={setRange} />
            </div>
            {loading ? (
                <div style={{ padding: '30px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>Cargando...</div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 'var(--spacing-md)' }}>
                    <div style={{ ...sectionCardStyle(), borderLeft: '4px solid var(--color-warning)' }}>
                        <h4 style={{ margin: '0 0 var(--spacing-md)' }}>Matutino</h4>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <span style={{ color: 'var(--color-text-secondary)' }}>Asistencias</span>
                            <b>{attendance.matutino}</b>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--color-text-secondary)' }}>Ingresos</span>
                            <b style={{ color: 'var(--color-success)' }}>${formatMoney(revenue.matutino)}</b>
                        </div>
                    </div>
                    <div style={{ ...sectionCardStyle(), borderLeft: '4px solid var(--color-primary)' }}>
                        <h4 style={{ margin: '0 0 var(--spacing-md)' }}>Vespertino</h4>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <span style={{ color: 'var(--color-text-secondary)' }}>Asistencias</span>
                            <b>{attendance.vespertino}</b>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--color-text-secondary)' }}>Ingresos</span>
                            <b style={{ color: 'var(--color-success)' }}>${formatMoney(revenue.vespertino)}</b>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}

function MembershipTypeSection() {
    const [planCounts, setPlanCounts] = useState<PlanMemberCount[]>([]);
    const [monthly, setMonthly] = useState<MonthlyReportRow[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        Promise.all([
            getActiveMembersByPlan(),
            getMonthlyPerformanceSummary(12)
        ]).then(([plans, months]) => {
            setPlanCounts(plans);
            setMonthly(months);
            setLoading(false);
        });
    }, []);

    const allPlanNames = Array.from(new Set(monthly.flatMap(row => Object.keys(row.revenueByPlan))));

    return (
        <section>
            {sectionHeading(<Tag color="var(--color-accent)" />, 'Por Tipo de Membresía')}
            {loading ? (
                <div style={{ padding: '30px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>Cargando...</div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 1fr) 2fr', gap: 'var(--spacing-md)', alignItems: 'start' }}>
                    <div style={sectionCardStyle()}>
                        <h4 style={{ margin: '0 0 var(--spacing-md)', color: 'var(--color-text-secondary)', fontWeight: 'normal' }}>Miembros activos</h4>
                        {planCounts.length === 0 ? (
                            <p style={{ color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>Sin miembros activos.</p>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {planCounts.map(({ planName, count }) => (
                                    <div key={planName} style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span>{planName}</span>
                                        <b>{count}</b>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div style={{ overflowX: 'auto', backgroundColor: 'var(--color-card)', borderRadius: '12px', padding: '10px' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '600px', fontSize: '14px' }}>
                            <thead>
                                <tr style={{ textAlign: 'left', color: 'var(--color-text-secondary)', borderBottom: '1px solid var(--color-border)' }}>
                                    <th style={{ padding: '12px' }}>Mes</th>
                                    <th style={{ padding: '12px', fontWeight: 'bold' }}>Total</th>
                                    {allPlanNames.map(planName => (
                                        <th key={planName} style={{ padding: '12px', borderLeft: '1px solid rgba(255,255,255,0.05)' }}>{planName}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {monthly.map(row => (
                                    <tr key={row.monthStr} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                        <td style={{ padding: '12px', textTransform: 'capitalize' }}>{monthLabel(row.monthStr)}</td>
                                        <td style={{ padding: '12px', fontWeight: 'bold', color: 'var(--color-success)' }}>${formatMoney(row.totalRevenue)}</td>
                                        {allPlanNames.map(planName => (
                                            <td key={planName} style={{ padding: '12px', borderLeft: '1px solid rgba(255,255,255,0.05)' }}>
                                                ${formatMoney(row.revenueByPlan[planName] || 0)}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </section>
    );
}

// ---------------------------------------------------------------------------
// Tab: Cortes de Caja
// ---------------------------------------------------------------------------

function CortesTab() {
    return (
        <div>
            <h3 style={{ marginBottom: 'var(--spacing-md)' }}>Historial de Cortes de Caja (Últimos 20)</h3>
            <ShiftHistoryTable />
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

                        // Sales = Expected (Total Cash in Hand theoretical) - Initial Cash + Withdrawals
                        const sales = (expected) - Number(shift.monto_inicial || 0) + Number(shift.retiros || 0);

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
                                <td style={{ padding: '12px', color: 'var(--color-success)' }}>${formatMoney(sales)}</td>
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

// ---------------------------------------------------------------------------
// Tab: Membresías - alerta, por vencer, vencidos, nuevos
// ---------------------------------------------------------------------------

function MembresiasTab() {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xl)' }}>
            <UnpaidAttendanceAlertSection />
            <ExpiringMembersSection />
            <ChurnedMembersSection />
            <NewMembersSection />
        </div>
    );
}

function UnpaidAttendanceAlertSection() {
    const [alerts, setAlerts] = useState<UnpaidAttendanceAlert[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        getExpiredMembersWithUnpaidAttendance().then(res => {
            setAlerts(res);
            setLoading(false);
        });
    }, []);

    if (loading) return <div>Cargando alertas...</div>;
    if (alerts.length === 0) return null; // No alert to show - stay out of the way

    return (
        <section>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: 'var(--spacing-md)', color: 'var(--color-danger)' }}>
                <AlertTriangle /> Alerta: Accesos de Socios Vencidos
            </h3>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '13px', marginBottom: 'var(--spacing-md)' }}>
                Socios cuya membresía ya venció, pero que registran entradas permitidas después de esa fecha (excluye paquetes/visitas, que acceden con boletos aparte).
            </p>
            <div style={{ overflowX: 'auto', backgroundColor: 'var(--color-card)', borderRadius: '12px', padding: '10px', borderLeft: '4px solid var(--color-danger)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '600px', fontSize: '14px' }}>
                    <thead>
                        <tr style={{ textAlign: 'left', color: 'var(--color-text-secondary)', borderBottom: '1px solid var(--color-border)' }}>
                            <th style={{ padding: '12px' }}>Socio</th>
                            <th style={{ padding: '12px' }}>Teléfono</th>
                            <th style={{ padding: '12px' }}>Venció</th>
                            <th style={{ padding: '12px' }}>Entradas después de vencer</th>
                        </tr>
                    </thead>
                    <tbody>
                        {alerts.map(a => (
                            <tr key={a.memberId} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                <td style={{ padding: '12px', fontWeight: 'bold' }}>{a.nombre} {a.apellido}</td>
                                <td style={{ padding: '12px' }}>{a.telefono || '—'}</td>
                                <td style={{ padding: '12px' }}>{new Date(a.subscriptionEndDate).toLocaleDateString('es-MX')}</td>
                                <td style={{ padding: '12px', color: 'var(--color-danger)', fontWeight: 'bold' }}>
                                    {a.visitDates.length} ({a.visitDates.slice(0, 3).map(d => new Date(d).toLocaleDateString('es-MX')).join(', ')}{a.visitDates.length > 3 ? '...' : ''})
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </section>
    );
}

function ExpiringMembersSection() {
    const [threshold, setThreshold] = useState(7);
    const [members, setMembers] = useState<ExpiringMember[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        getExpiringMembers(threshold).then(res => {
            setMembers(res);
            setLoading(false);
        });
    }, [threshold]);

    return (
        <section>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: 'var(--spacing-md)' }}>
                {sectionHeading(<CalendarClock color="var(--color-warning)" />, 'Por Vencer')}
                <div style={{ display: 'flex', gap: '8px' }}>
                    {[7, 15, 30].map(days => (
                        <button
                            key={days}
                            onClick={() => setThreshold(days)}
                            style={pickerButtonStyle(threshold === days)}
                        >
                            {days} días
                        </button>
                    ))}
                </div>
            </div>
            {loading ? (
                <div style={{ padding: '20px', color: 'var(--color-text-secondary)' }}>Cargando...</div>
            ) : members.length === 0 ? (
                <div style={{ padding: '20px', fontStyle: 'italic', color: 'var(--color-success)' }}>Nadie vence en los próximos {threshold} días.</div>
            ) : (
                <div style={{ overflowX: 'auto', backgroundColor: 'var(--color-card)', borderRadius: '12px', padding: '10px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '600px', fontSize: '14px' }}>
                        <thead>
                            <tr style={{ textAlign: 'left', color: 'var(--color-text-secondary)', borderBottom: '1px solid var(--color-border)' }}>
                                <th style={{ padding: '12px' }}>Socio</th>
                                <th style={{ padding: '12px' }}>Teléfono</th>
                                <th style={{ padding: '12px' }}>Plan</th>
                                <th style={{ padding: '12px' }}>Vence</th>
                                <th style={{ padding: '12px' }}>Días</th>
                            </tr>
                        </thead>
                        <tbody>
                            {members.map(m => (
                                <tr key={m.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                    <td style={{ padding: '12px', fontWeight: 'bold' }}>{m.profile?.nombre} {m.profile?.apellido}</td>
                                    <td style={{ padding: '12px' }}>{m.profile?.telefono || '—'}</td>
                                    <td style={{ padding: '12px' }}>{m.plan?.nombre || '—'}</td>
                                    <td style={{ padding: '12px' }}>{new Date(m.fecha_vencimiento).toLocaleDateString('es-MX')}</td>
                                    <td style={{ padding: '12px', color: 'var(--color-warning)', fontWeight: 'bold' }}>{m.daysLeft}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </section>
    );
}

function ChurnedMembersSection() {
    const [range, setRange] = useState<DateRange>(() => quickPresetRange('30d'));
    const [data, setData] = useState<ChurnedMember[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        getChurnedMembers(range.from, range.to).then(res => {
            setData(res);
            setLoading(false);
        });
    }, [range]);

    return (
        <section>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: 'var(--spacing-md)' }}>
                {sectionHeading(<UserMinus color="var(--color-danger)" />, 'Vencidos / No Renovaciones')}
                <DateRangePicker range={range} onChange={setRange} />
            </div>
            {loading ? (
                <div style={{ padding: '20px', color: 'var(--color-text-secondary)' }}>Cargando...</div>
            ) : data.length === 0 ? (
                <div style={{ padding: '20px', fontStyle: 'italic', color: 'var(--color-success)' }}>Nadie venció sin renovar en este periodo.</div>
            ) : (
                <div style={{ overflowX: 'auto', backgroundColor: 'var(--color-card)', borderRadius: '12px', padding: '10px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '600px', fontSize: '14px' }}>
                        <thead>
                            <tr style={{ textAlign: 'left', color: 'var(--color-text-secondary)', borderBottom: '1px solid var(--color-border)' }}>
                                <th style={{ padding: '12px' }}>Socio</th>
                                <th style={{ padding: '12px' }}>Teléfono</th>
                                <th style={{ padding: '12px' }}>Plan</th>
                                <th style={{ padding: '12px' }}>Venció</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.map(m => (
                                <tr key={m.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                    <td style={{ padding: '12px', fontWeight: 'bold' }}>{m.nombre} {m.apellido}</td>
                                    <td style={{ padding: '12px' }}>{m.telefono || '—'}</td>
                                    <td style={{ padding: '12px' }}>{m.planName || '—'}</td>
                                    <td style={{ padding: '12px', color: 'var(--color-danger)' }}>{new Date(m.fechaVencimiento).toLocaleDateString('es-MX')}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </section>
    );
}

function NewMembersSection() {
    const [data, setData] = useState<NewMembersRow[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        getNewMembersByMonth(12).then(res => {
            setData(res);
            setLoading(false);
        });
    }, []);

    if (loading) return <div>Cargando altas...</div>;

    const formatted = data.map(row => ({ displayDate: monthLabel(row.monthStr), count: row.count }));
    const thisMonth = data[data.length - 1];

    return (
        <section>
            {sectionHeading(<UserPlus color="var(--color-success)" />, 'Altas Nuevas')}
            {thisMonth && (
                <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-md)' }}>
                    Este mes: <b style={{ color: 'var(--color-text)' }}>{thisMonth.count}</b> socios nuevos.
                </p>
            )}
            <div style={{ ...sectionCardStyle(), height: '300px' }}>
                <ResponsiveContainer width="100%" height="100%">
                    <RechartsBarChart data={formatted}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                        <XAxis dataKey="displayDate" stroke="var(--color-text-secondary)" fontSize={12} />
                        <YAxis stroke="var(--color-text-secondary)" fontSize={12} allowDecimals={false} />
                        <Tooltip contentStyle={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: '8px' }} itemStyle={{ color: 'var(--color-text)' }} />
                        <Bar dataKey="count" name="Socios Nuevos" fill="var(--color-success)" radius={[4, 4, 0, 0]} />
                    </RechartsBarChart>
                </ResponsiveContainer>
            </div>
        </section>
    );
}
