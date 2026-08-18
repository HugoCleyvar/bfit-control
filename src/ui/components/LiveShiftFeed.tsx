import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../logic/api/supabase';
import { getActiveShifts, getRecentShiftMovements, type ShiftMovement } from '../../logic/api/financeService';
import type { Shift, Payment } from '../../domain/types';
import { ArrowUpCircle, ArrowDownCircle, Loader2 } from 'lucide-react';

interface OpenShiftInfo {
    colaboradorId: string;
    horario: Shift['horario'];
    horaInicio: string;
    totalEfectivo: number;
}

interface FeedItem extends ShiftMovement {
    isNew?: boolean;
}

const MAX_ITEMS = 30;
const HIGHLIGHT_MS = 4000;

export default function LiveShiftFeed() {
    const [openShifts, setOpenShifts] = useState<Record<string, OpenShiftInfo>>({});
    const [profileNames, setProfileNames] = useState<Record<string, string>>({});
    const [items, setItems] = useState<FeedItem[]>([]);
    const [loading, setLoading] = useState(true);

    const highlightTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
    const memberNameCache = useRef<Map<string, string>>(new Map());

    const clearHighlight = useCallback((id: string) => {
        setItems((prev) => prev.map((item) => (item.id === id ? { ...item, isNew: false } : item)));
        delete highlightTimers.current[id];
    }, []);

    const pushItem = useCallback((item: ShiftMovement) => {
        setItems((prev) => {
            if (prev.some((existing) => existing.id === item.id)) return prev;
            return [{ ...item, isNew: true }, ...prev].slice(0, MAX_ITEMS);
        });
        highlightTimers.current[item.id] = setTimeout(() => clearHighlight(item.id), HIGHLIGHT_MS);
    }, [clearHighlight]);

    const resolveMemberName = useCallback(async (usuarioId?: string): Promise<string | null> => {
        if (!usuarioId) return null;
        const cached = memberNameCache.current.get(usuarioId);
        if (cached) return cached;
        const { data } = await supabase.from('members').select('nombre, apellido').eq('id', usuarioId).single();
        if (!data) return null;
        const name = `${data.nombre} ${data.apellido}`;
        memberNameCache.current.set(usuarioId, name);
        return name;
    }, []);

    // Initial snapshot: open shifts + staff names + their most recent movements
    useEffect(() => {
        let cancelled = false;

        (async () => {
            const [shifts, { data: profiles }] = await Promise.all([
                getActiveShifts(),
                supabase.from('profiles').select('id, nombre')
            ]);
            if (cancelled) return;

            const shiftsMap: Record<string, OpenShiftInfo> = {};
            shifts.forEach((s) => {
                shiftsMap[s.id] = {
                    colaboradorId: s.colaborador_id,
                    horario: s.horario,
                    horaInicio: s.hora_inicio,
                    totalEfectivo: s.total_efectivo
                };
            });
            setOpenShifts(shiftsMap);

            const namesMap: Record<string, string> = {};
            (profiles || []).forEach((p: { id: string; nombre: string }) => {
                namesMap[p.id] = p.nombre;
            });
            setProfileNames(namesMap);

            const recent = await getRecentShiftMovements(Object.keys(shiftsMap));
            if (!cancelled) setItems(recent);
            setLoading(false);
        })();

        return () => { cancelled = true; };
    }, []);

    // Live updates: new payments/expenses on any shift, plus shifts opening/closing
    useEffect(() => {
        const channel = supabase
            .channel('admin-live-shift-feed')
            .on<{ id: string; colaborador_id: string; horario: Shift['horario']; hora_inicio: string; total_efectivo: number; estatus: string }>(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'shifts' },
                (payload) => {
                    const row = payload.new;
                    if (row.estatus !== 'abierto') return;
                    setOpenShifts((prev) => ({
                        ...prev,
                        [row.id]: {
                            colaboradorId: row.colaborador_id,
                            horario: row.horario,
                            horaInicio: row.hora_inicio,
                            totalEfectivo: row.total_efectivo
                        }
                    }));
                }
            )
            .on<{ id: string; estatus: string; total_efectivo: number }>(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'shifts' },
                (payload) => {
                    const row = payload.new;
                    setOpenShifts((prev) => {
                        if (row.estatus !== 'abierto') {
                            if (!(row.id in prev)) return prev;
                            const next = { ...prev };
                            delete next[row.id];
                            return next;
                        }
                        if (!prev[row.id]) return prev;
                        return { ...prev, [row.id]: { ...prev[row.id], totalEfectivo: row.total_efectivo } };
                    });
                }
            )
            .on<{ id: string; total: number; metodo_pago: Payment['metodo_pago']; fecha_pago: string; concepto?: string; turno_id: string | null; usuario_id?: string }>(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'payments' },
                (payload) => {
                    const row = payload.new;
                    if (!row.turno_id) return;
                    resolveMemberName(row.usuario_id).then((memberName) => {
                        pushItem({
                            id: `pago-${row.id}`,
                            type: 'pago',
                            turnoId: row.turno_id,
                            monto: row.total,
                            metodoPago: row.metodo_pago,
                            detalle: memberName || row.concepto || 'Venta de producto',
                            fecha: row.fecha_pago
                        });
                    });
                }
            )
            .on<{ id: string; monto: number; concepto: string; fecha_hora: string; turno_id: string | null }>(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'expenses' },
                (payload) => {
                    const row = payload.new;
                    if (!row.turno_id) return;
                    pushItem({
                        id: `retiro-${row.id}`,
                        type: 'retiro',
                        turnoId: row.turno_id,
                        monto: row.monto,
                        detalle: row.concepto,
                        fecha: row.fecha_hora
                    });
                }
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [pushItem, resolveMemberName]);

    // Stop pending highlight timers on unmount
    useEffect(() => {
        const timers = highlightTimers.current;
        return () => { Object.values(timers).forEach(clearTimeout); };
    }, []);

    const shiftEntries = Object.entries(openShifts);

    return (
        <div style={{ backgroundColor: 'var(--color-card)', borderRadius: 'var(--radius-lg)', padding: 'var(--spacing-lg)' }}>
            {shiftEntries.length === 0 ? (
                <div style={{ color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>No hay turnos activos en este momento.</div>
            ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: 'var(--spacing-lg)' }}>
                    {shiftEntries.map(([shiftId, s]) => (
                        <div key={shiftId} style={{
                            display: 'flex', alignItems: 'center', gap: '10px',
                            padding: '10px 16px', borderRadius: 'var(--radius-md)',
                            backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)'
                        }}>
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--color-success)', display: 'inline-block' }} />
                            <div>
                                <div style={{ fontWeight: 'bold' }}>{profileNames[s.colaboradorId] || 'Colaborador'}</div>
                                <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                                    Desde {new Date(s.horaInicio).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {s.horario}
                                </div>
                            </div>
                            <div style={{ marginLeft: '10px', fontSize: '18px', fontWeight: 'bold', color: 'var(--color-success)' }}>
                                ${s.totalEfectivo.toLocaleString()}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {loading ? (
                <div style={{ textAlign: 'center', padding: '20px' }}><Loader2 className="animate-spin" /></div>
            ) : items.length === 0 ? (
                <p style={{ color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>Aún no hay movimientos registrados en los turnos abiertos.</p>
            ) : (
                <div style={{ maxHeight: '360px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {items.map((item) => {
                        const shift = item.turnoId ? openShifts[item.turnoId] : undefined;
                        const colaborador = shift ? (profileNames[shift.colaboradorId] || 'Colaborador') : 'Colaborador';
                        const isPago = item.type === 'pago';
                        return (
                            <div key={item.id} style={{
                                display: 'flex', alignItems: 'center', gap: '12px',
                                padding: '10px 12px', borderRadius: 'var(--radius-md)',
                                backgroundColor: item.isNew ? 'rgba(0, 204, 102, 0.12)' : 'var(--color-bg)',
                                border: '1px solid var(--color-border)',
                                transition: 'background-color 2s ease'
                            }}>
                                {isPago
                                    ? <ArrowUpCircle size={20} color="var(--color-success)" style={{ flexShrink: 0 }} />
                                    : <ArrowDownCircle size={20} color="var(--color-danger)" style={{ flexShrink: 0 }} />}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontWeight: 500 }}>{item.detalle}</div>
                                    <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                                        {colaborador} · {isPago ? item.metodoPago : 'retiro'} · {new Date(item.fecha).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                </div>
                                <div style={{ fontWeight: 'bold', color: isPago ? 'var(--color-success)' : 'var(--color-danger)', flexShrink: 0 }}>
                                    {isPago ? '+' : '-'} ${item.monto.toLocaleString()}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
