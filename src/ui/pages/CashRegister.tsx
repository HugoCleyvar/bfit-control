import { useState, useEffect, useCallback } from 'react';
import { registerExpense, getShiftExpenses } from '../../logic/api/financeService';
import { useAuth } from '../../logic/authContext';
import { useShift } from '../../logic/shiftContext';
import type { Expense, CashCount } from '../../domain/types';
import { DenominationCounter } from '../components/DenominationCounter';
import { Lock, Unlock, DollarSign, PlusCircle, MinusCircle, History } from 'lucide-react';

export default function CashRegister() {
    const { user } = useAuth();
    const { currentShift: shift, openShift, closeShift, isLoadingShift: shiftLoading } = useShift();

    // Local state only for expenses and UI forms
    const [expenses, setExpenses] = useState<Expense[]>([]);

    // Initial Fund State
    const [openCashTotal, setOpenCashTotal] = useState(0);
    const [openCashCount, setOpenCashCount] = useState<CashCount>({});

    // Expense State
    const [showExpenseModal, setShowExpenseModal] = useState(false);
    const [expenseAmount, setExpenseAmount] = useState('');
    const [expenseReason, setExpenseReason] = useState('');

    const [showCloseModal, setShowCloseModal] = useState(false);
    const [countedCash, setCountedCash] = useState(0);
    const [denominations, setDenominations] = useState<CashCount>({});
    const [nextFundTotal, setNextFundTotal] = useState(0);
    const [nextFundDenominations, setNextFundDenominations] = useState<CashCount>({});
    const [closeResult, setCloseResult] = useState<{ success: boolean; difference: number } | null>(null);

    const loadExpenses = useCallback(async () => {
        if (!shift) return;
        const exp = await getShiftExpenses(shift.id);
        setExpenses(exp);
    }, [shift]);

    useEffect(() => {
        if (shift) {
            loadExpenses();
        }
    }, [shift, loadExpenses]);

    const handleOpenShift = async () => {
        if (openCashTotal < 0) return;
        const result = await openShift(openCashTotal, openCashCount);
        if (!result.success) {
            alert('Error al abrir turno');
        } else {
            setOpenCashTotal(0);
            setOpenCashCount({});
        }
    };

    const handleRegisterExpense = async () => {
        if (!shift || !user || !expenseAmount || !expenseReason) return;

        const success = await registerExpense(shift.id, Number(expenseAmount), expenseReason, user.id);
        if (success) {
            setShowExpenseModal(false);
            setExpenseAmount('');
            setExpenseReason('');
            await loadExpenses();
        } else {
            alert('Error al registrar gasto');
        }
    };

    const handleCloseShift = async () => {
        if (!shift) return;
        const result = await closeShift(denominations, countedCash, nextFundDenominations, nextFundTotal);

        if (result && result.success) {
            setCloseResult({ success: true, difference: result.difference ?? 0 });
            setShowCloseModal(false);
        } else {
            alert('Error al cerrar turno');
        }
    };

    if (shiftLoading) return <div className="page-container">Cargando Caja...</div>;

    // --- VIEW: SHIFT CLOSED ---
    if (!shift) {
        return (
            <div className="page-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
                <div style={{ maxWidth: '400px', width: '100%', padding: '30px', backgroundColor: 'var(--color-card)', borderRadius: '12px', textAlign: 'center' }}>
                    <Lock size={48} color="var(--color-text-secondary)" style={{ marginBottom: '20px' }} />
                    <h2 style={{ marginBottom: '10px' }}>Caja Cerrada</h2>
                    <p style={{ color: 'var(--color-text-secondary)', marginBottom: '30px' }}>
                        Inicia un nuevo turno estableciendo el fondo inicial de caja.
                    </p>

                    <div style={{ textAlign: 'left', marginBottom: '20px' }}>
                        <DenominationCounter onChange={(total, counts) => {
                            setOpenCashTotal(total);
                            setOpenCashCount(counts);
                        }} />
                    </div>

                    <div style={{ marginBottom: '20px', padding: '10px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', fontSize: '18px' }}>
                        <span>Total Contado:</span>
                        <span style={{ fontWeight: 'bold' }}>${openCashTotal.toLocaleString()}</span>
                    </div>

                    <button
                        onClick={handleOpenShift}
                        style={{ width: '100%', padding: '12px', fontSize: '16px', display: 'flex', justifyContent: 'center', gap: '8px' }}
                    >
                        <Unlock size={18} /> Abrir Caja con ${openCashTotal.toLocaleString()}
                    </button>

                    {closeResult && (
                        <div style={{ marginTop: '20px', padding: '10px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                            <p style={{ margin: 0, fontSize: '14px' }}>Último cierre: Diferencia ${closeResult.difference.toFixed(2)}</p>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // --- VIEW: SHIFT OPEN ---
    // Calculations
    const cashSales = (shift.total_efectivo - shift.monto_inicial + shift.retiros);

    return (
        <div className="page-container">
            <h2 style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Control de Caja</span>
                <span style={{ fontSize: '14px', fontWeight: 'normal', padding: '5px 12px', background: 'var(--color-success)', borderRadius: '20px', color: 'black' }}>
                    TURNO {shift.horario.toUpperCase()}
                </span>
            </h2>

            {/* KPI Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginTop: '30px' }}>
                <div style={{ background: 'var(--color-card)', padding: '20px', borderRadius: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px', color: 'var(--color-text-secondary)' }}>
                        <History size={18} /> Fondo Inicial
                    </div>
                    <div style={{ fontSize: '24px', fontWeight: 'bold' }}>${shift.monto_inicial.toLocaleString()}</div>
                </div>

                <div style={{ background: 'var(--color-card)', padding: '20px', borderRadius: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px', color: 'var(--color-success)' }}>
                        <PlusCircle size={18} /> Ventas Efec.
                    </div>
                    <div style={{ fontSize: '24px', fontWeight: 'bold' }}>${cashSales.toLocaleString()}</div>
                </div>

                <div style={{ background: 'var(--color-card)', padding: '20px', borderRadius: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px', color: 'var(--color-danger)' }}>
                        <MinusCircle size={18} /> Retiros/Gastos
                    </div>
                    <div style={{ fontSize: '24px', fontWeight: 'bold' }}>${shift.retiros.toLocaleString()}</div>
                </div>

                <div style={{ background: 'var(--color-accent)', padding: '20px', borderRadius: '12px', color: 'black' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px', opacity: 0.8 }}>
                        <DollarSign size={18} /> En Caja (Teórico)
                    </div>
                    <div style={{ fontSize: '28px', fontWeight: 'bold' }}>${shift.total_efectivo.toLocaleString()}</div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '30px', marginTop: '30px' }}>

                {/* Expenses List */}
                <div style={{ background: 'var(--color-card)', padding: '20px', borderRadius: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                        <h3>Movimientos de Salida</h3>
                        <button
                            onClick={() => setShowExpenseModal(true)}
                            style={{ padding: '8px 16px', background: 'rgba(255,255,255,0.1)', fontSize: '14px' }}
                        >
                            + Registrar Gasto
                        </button>
                    </div>

                    {expenses.length === 0 ? (
                        <p style={{ color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>No hay gastos registrados en este turno.</p>
                    ) : (
                        <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
                                    <th style={{ padding: '10px' }}>Hora</th>
                                    <th style={{ padding: '10px' }}>Concepto</th>
                                    <th style={{ padding: '10px', textAlign: 'right' }}>Monto</th>
                                </tr>
                            </thead>
                            <tbody>
                                {expenses.map(exp => (
                                    <tr key={exp.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                        <td style={{ padding: '10px' }}>{new Date(exp.fecha_hora).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                                        <td style={{ padding: '10px' }}>{exp.concepto}</td>
                                        <td style={{ padding: '10px', textAlign: 'right', color: 'var(--color-danger)' }}>- ${exp.monto.toFixed(2)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div style={{ background: 'var(--color-card)', padding: '20px', borderRadius: '12px' }}>
                        <h3>Acciones de Turno</h3>
                        <p style={{ color: 'var(--color-text-secondary)', marginBottom: '20px', fontSize: '14px' }}>
                            Al finalizar el turno, realiza el arqueo contando detalladamente las denominaciones.
                        </p>
                        <button
                            onClick={() => setShowCloseModal(true)}
                            style={{ width: '100%', background: 'var(--color-danger)', padding: '15px' }}
                        >
                            Cerrar Turno (Arqueo)
                        </button>
                    </div>
                </div>
            </div>

            {/* EXPENSE MODAL */}
            {showExpenseModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 100 }}>
                    <div style={{ background: 'var(--color-card)', padding: '30px', borderRadius: '12px', width: '400px' }}>
                        <h3>Registrar Gasto</h3>

                        <div style={{ margin: '20px 0' }}>
                            <label style={{ display: 'block', marginBottom: '8px' }}>Monto a retirar</label>
                            <input
                                type="number"
                                value={expenseAmount}
                                onChange={e => setExpenseAmount(e.target.value)}
                                autoFocus
                                style={{ width: '100%', padding: '10px', fontSize: '18px', background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'white' }}
                            />
                        </div>

                        <div style={{ margin: '20px 0' }}>
                            <label style={{ display: 'block', marginBottom: '8px' }}>Motivo / Concepto</label>
                            <input
                                type="text"
                                value={expenseReason}
                                onChange={e => setExpenseReason(e.target.value)}
                                placeholder="Ej. Compra de papel higiénico"
                                style={{ width: '100%', padding: '10px', background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'white' }}
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '10px', marginTop: '30px' }}>
                            <button onClick={() => setShowExpenseModal(false)} style={{ flex: 1, background: 'transparent', border: '1px solid var(--color-border)' }}>Cancelar</button>
                            <button onClick={handleRegisterExpense} style={{ flex: 1, background: 'var(--color-danger)' }}>Registrar Salida</button>
                        </div>
                    </div>
                </div>
            )}

            {/* CLOSE SHIFT MODAL */}
            {showCloseModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', display: 'flex', justifyContent: 'center', alignItems: 'start', overflowY: 'auto', paddingTop: '50px', zIndex: 100 }}>
                    <div style={{ background: 'var(--color-card)', padding: '30px', borderRadius: '12px', width: '600px', marginBottom: '50px' }}>
                        <h2 style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: '15px', marginBottom: '20px' }}>Arqueo de Caja</h2>

                        <div style={{ marginBottom: '20px' }}>
                            <h3 style={{ marginBottom: '10px', color: 'var(--color-accent)' }}>Paso 1: Dinero total en caja</h3>
                            <DenominationCounter onChange={(total, counts) => {
                                setCountedCash(total);
                                setDenominations(counts);
                            }} />
                        </div>

                        <div style={{ marginBottom: '20px', paddingBottom: '20px', borderBottom: '1px solid var(--color-border)' }}>
                            <h3 style={{ marginBottom: '10px', color: 'var(--color-warning)' }}>Paso 2: Fondo para el siguiente turno</h3>
                            <p style={{ color: 'var(--color-text-secondary)', fontSize: '12px', marginBottom: '10px' }}>
                                Cuenta el efectivo que SE QUEDARÁ en la caja (este monto se restará para calcular lo que entregas al administrador).
                            </p>
                            <DenominationCounter onChange={(total, counts) => {
                                setNextFundTotal(total);
                                setNextFundDenominations(counts);
                            }} />
                        </div>

                        <div style={{ marginTop: '20px', padding: '15px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', paddingBottom: '10px', borderBottom: '1px solid #444' }}>
                                <span style={{ fontWeight: 'bold' }}>Resumen de Cierre:</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                                <span>Total Ventas Sistema:</span>
                                <span>${(shift.total_efectivo - shift.monto_inicial + shift.retiros).toLocaleString()}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
                                <span>Efectivo Total Esperado:</span>
                                <span>${shift.total_efectivo.toLocaleString()}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px', paddingTop: '10px', borderTop: '1px solid #444' }}>
                                <span>Contado Real Total:</span>
                                <span style={{ fontWeight: 'bold' }}>${countedCash.toLocaleString()}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', fontSize: '18px' }}>
                                <span>Diferencia del Turno:</span>
                                <span style={{ color: (countedCash - shift.total_efectivo) >= 0 ? 'var(--color-success)' : 'var(--color-warning)' }}>
                                    {(countedCash - shift.total_efectivo) === 0 ? '✓ Cuadrado' : (countedCash - shift.total_efectivo).toLocaleString()}
                                </span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px', paddingTop: '10px', borderTop: '1px solid #444', fontSize: '18px' }}>
                                <span>Fondo que se queda (Siguiente):</span>
                                <span style={{ color: 'var(--color-warning)', fontWeight: 'bold' }}>${nextFundTotal.toLocaleString()}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', fontSize: '20px', color: 'var(--color-accent)' }}>
                                <span>ENTREGAR AL ADMINISTRADOR:</span>
                                <span style={{ fontWeight: 'bold' }}>${Math.max(0, countedCash - nextFundTotal).toLocaleString()}</span>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '10px', marginTop: '30px' }}>
                            <button onClick={() => setShowCloseModal(false)} style={{ flex: 1, background: 'transparent', border: '1px solid var(--color-border)' }}>Cancelar</button>
                            <button onClick={handleCloseShift} style={{ flex: 1 }}>Confirmar Cierre</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
