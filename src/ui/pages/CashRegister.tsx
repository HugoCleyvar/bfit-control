import { useState, useEffect, useCallback } from 'react';
import { registerExpense, getShiftExpenses } from '../../logic/api/financeService';
import { useAuth } from '../../logic/authContext';
import { useShift } from '../../logic/shiftContext';
import type { Expense, CashCount } from '../../domain/types';
import { DenominationCounter } from '../components/DenominationCounter';
import { CloseShiftModal } from '../components/CloseShiftModal';
import { InventoryCounter, type InventoryItemCount } from '../components/InventoryCounter';
import { getProducts, type Product } from '../../logic/api/productService';
import { Lock, Unlock, DollarSign, PlusCircle, MinusCircle, History, Package, X } from 'lucide-react';

export default function CashRegister() {
    const { user } = useAuth();
    const { currentShift: shift, openShift, closeShift, isLoadingShift: shiftLoading } = useShift();

    // Local state only for expenses and UI forms
    const [expenses, setExpenses] = useState<Expense[]>([]);

    // Initial Fund State
    const [openCashTotal, setOpenCashTotal] = useState(0);
    const [openCashCount, setOpenCashCount] = useState<CashCount>({});

    // Opening Inventory State
    const [products, setProducts] = useState<Product[]>([]);
    const [openInventoryCounts, setOpenInventoryCounts] = useState<Record<string, InventoryItemCount>>({});

    // Expense State
    const [showExpenseModal, setShowExpenseModal] = useState(false);
    const [expenseAmount, setExpenseAmount] = useState('');
    const [expenseReason, setExpenseReason] = useState('');

    const [showCloseModal, setShowCloseModal] = useState(false);
    const [closeResult, setCloseResult] = useState<{ success: boolean; difference: number } | null>(null);

    const loadData = useCallback(async () => {
        try {
            const prods = await getProducts();
            setProducts(prods);
        } catch (e) {
            console.error('Error loading products:', e);
        }

        if (shift) {
            try {
                const exp = await getShiftExpenses(shift.id);
                setExpenses(exp);
            } catch (e) {
                console.error('Error loading expenses:', e);
            }
        }
    }, [shift]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleOpenShift = async () => {
        if (openCashTotal < 0) return;

        const result = await openShift(openCashTotal, openCashCount, openInventoryCounts);
        if (!result.success) {
            const errObj = result.error as any;
            const msg = errObj?.message || (result.error instanceof Error ? result.error.message : 'Error al abrir turno');
            alert('Error al abrir turno: ' + msg);
        } else {
            setOpenCashTotal(0);
            setOpenCashCount({});
            setOpenInventoryCounts({});
        }
    };

    const handleRegisterExpense = async () => {
        if (!shift || !user || !expenseAmount || !expenseReason) return;

        const success = await registerExpense(shift.id, Number(expenseAmount), expenseReason, user.id);
        if (success) {
            setShowExpenseModal(false);
            setExpenseAmount('');
            setExpenseReason('');
            await loadData();
        } else {
            alert('Error al registrar gasto');
        }
    };

    if (shiftLoading) return <div className="page-container" style={{ textAlign: 'center', padding: '40px' }}>Cargando Caja...</div>;

    // --- VIEW: SHIFT CLOSED ---
    if (!shift) {
        return (
            <div className="page-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '70vh', padding: '16px' }}>
                <div style={{
                    maxWidth: '560px',
                    width: '100%',
                    padding: 'clamp(20px, 4vw, 32px)',
                    backgroundColor: 'var(--color-card)',
                    borderRadius: '16px',
                    border: '1px solid var(--color-border)',
                    boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
                    textAlign: 'center'
                }}>
                    <div style={{
                        width: '64px',
                        height: '64px',
                        borderRadius: '50%',
                        background: 'rgba(255,255,255,0.05)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 16px'
                    }}>
                        <Lock size={32} color="var(--color-accent)" />
                    </div>
                    <h2 style={{ marginBottom: '8px', fontSize: '22px' }}>Apertura de Caja</h2>
                    <p style={{ color: 'var(--color-text-secondary)', marginBottom: '24px', fontSize: '14px' }}>
                        Cuenta el efectivo del fondo inicial e inventario para iniciar tu turno.
                    </p>

                    {/* Step 1: Cash Fund */}
                    <div style={{ textAlign: 'left', marginBottom: '20px' }}>
                        <h4 style={{ color: 'var(--color-accent)', marginBottom: '10px', fontSize: '15px', fontWeight: '600' }}>
                            1. Fondo Inicial en Efectivo
                        </h4>
                        <DenominationCounter onChange={(total, counts) => {
                            setOpenCashTotal(total);
                            setOpenCashCount(counts);
                        }} />
                    </div>

                    {/* Step 2: Inventory Check */}
                    {products.length > 0 && (
                        <div style={{ textAlign: 'left', marginBottom: '24px', paddingTop: '16px', borderTop: '1px solid var(--color-border)' }}>
                            <h4 style={{ color: 'var(--color-accent)', marginBottom: '10px', fontSize: '15px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Package size={18} /> 2. Conteo de Inventario Inicial
                            </h4>
                            <InventoryCounter products={products} onChange={setOpenInventoryCounts} />
                        </div>
                    )}

                    <div style={{
                        marginBottom: '20px',
                        padding: '14px',
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid var(--color-border)',
                        borderRadius: '10px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: '16px'
                    }}>
                        <span style={{ color: 'var(--color-text-secondary)' }}>Fondo Total Contado:</span>
                        <span style={{ fontWeight: 'bold', fontSize: '20px', color: 'var(--color-success)' }}>
                            ${openCashTotal.toLocaleString()}
                        </span>
                    </div>

                    <button
                        onClick={handleOpenShift}
                        style={{
                            width: '100%',
                            padding: '14px',
                            fontSize: '16px',
                            fontWeight: 'bold',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            borderRadius: '10px',
                            background: 'var(--color-primary)',
                            border: 'none',
                            color: 'white',
                            cursor: 'pointer'
                        }}
                    >
                        <Unlock size={18} /> Iniciar Turno con ${openCashTotal.toLocaleString()}
                    </button>

                    {closeResult && (
                        <div style={{ marginTop: '20px', padding: '12px', background: 'rgba(255,255,255,0.04)', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
                            <p style={{ margin: 0, fontSize: '14px', color: 'var(--color-text-secondary)' }}>
                                Último cierre: Diferencia ${closeResult.difference.toFixed(2)}
                            </p>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // --- VIEW: SHIFT OPEN ---
    const cashSales = (shift.total_efectivo - shift.monto_inicial + shift.retiros);

    return (
        <div className="page-container" style={{ padding: 'clamp(12px, 3vw, 24px)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '20px' }}>
                <h2 style={{ margin: 0, fontSize: '22px' }}>Control de Caja</h2>
                <span style={{
                    fontSize: '13px',
                    fontWeight: 'bold',
                    padding: '6px 14px',
                    background: 'var(--color-success)',
                    borderRadius: '20px',
                    color: 'black',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                }}>
                    TURNO {shift.horario.toUpperCase()} (ABIERTO)
                </span>
            </div>

            {/* KPI Cards (Responsive Grid) */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                gap: '12px',
                marginTop: '16px'
            }}>
                <div style={{ background: 'var(--color-card)', padding: '16px', borderRadius: '12px', border: '1px solid var(--color-border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', color: 'var(--color-text-secondary)', fontSize: '13px' }}>
                        <History size={16} /> Fondo Inicial
                    </div>
                    <div style={{ fontSize: '20px', fontWeight: 'bold' }}>${shift.monto_inicial.toLocaleString()}</div>
                </div>

                <div style={{ background: 'var(--color-card)', padding: '16px', borderRadius: '12px', border: '1px solid var(--color-border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', color: 'var(--color-success)', fontSize: '13px' }}>
                        <PlusCircle size={16} /> Ventas Efectivo
                    </div>
                    <div style={{ fontSize: '20px', fontWeight: 'bold', color: 'var(--color-success)' }}>${cashSales.toLocaleString()}</div>
                </div>

                <div style={{ background: 'var(--color-card)', padding: '16px', borderRadius: '12px', border: '1px solid var(--color-border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', color: 'var(--color-danger)', fontSize: '13px' }}>
                        <MinusCircle size={16} /> Gastos / Retiros
                    </div>
                    <div style={{ fontSize: '20px', fontWeight: 'bold', color: 'var(--color-danger)' }}>${shift.retiros.toLocaleString()}</div>
                </div>

                <div style={{ background: 'var(--color-accent)', padding: '16px', borderRadius: '12px', color: 'black' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', opacity: 0.85, fontSize: '13px', fontWeight: '600' }}>
                        <DollarSign size={16} /> En Caja (Teórico)
                    </div>
                    <div style={{ fontSize: '22px', fontWeight: 'bold' }}>${shift.total_efectivo.toLocaleString()}</div>
                </div>
            </div>

            {/* Content & Actions Grid */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: '20px',
                marginTop: '24px'
            }}>
                {/* Expenses List */}
                <div style={{ background: 'var(--color-card)', padding: '20px', borderRadius: '12px', border: '1px solid var(--color-border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                        <h3 style={{ margin: 0, fontSize: '17px' }}>Movimientos de Salida</h3>
                        <button
                            onClick={() => setShowExpenseModal(true)}
                            style={{
                                padding: '8px 14px',
                                background: 'rgba(255,255,255,0.08)',
                                border: '1px solid var(--color-border)',
                                borderRadius: '8px',
                                fontSize: '13px',
                                color: 'var(--color-text-primary)',
                                cursor: 'pointer'
                            }}
                        >
                            + Registrar Gasto
                        </button>
                    </div>

                    {expenses.length === 0 ? (
                        <p style={{ color: 'var(--color-text-secondary)', fontStyle: 'italic', fontSize: '14px', margin: '20px 0' }}>
                            No hay gastos registrados en este turno.
                        </p>
                    ) : (
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', fontSize: '14px' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
                                        <th style={{ padding: '8px 6px' }}>Hora</th>
                                        <th style={{ padding: '8px 6px' }}>Concepto</th>
                                        <th style={{ padding: '8px 6px', textAlign: 'right' }}>Monto</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {expenses.map(exp => (
                                        <tr key={exp.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                            <td style={{ padding: '10px 6px', color: 'var(--color-text-secondary)' }}>
                                                {new Date(exp.fecha_hora).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </td>
                                            <td style={{ padding: '10px 6px' }}>{exp.concepto}</td>
                                            <td style={{ padding: '10px 6px', textAlign: 'right', color: 'var(--color-danger)', fontWeight: '600' }}>
                                                -${exp.monto.toFixed(2)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Shift Actions Card */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div style={{ background: 'var(--color-card)', padding: '20px', borderRadius: '12px', border: '1px solid var(--color-border)' }}>
                        <h3 style={{ margin: '0 0 8px 0', fontSize: '17px' }}>Cierre y Arqueo de Turno</h3>
                        <p style={{ color: 'var(--color-text-secondary)', marginBottom: '20px', fontSize: '14px', lineHeight: '1.4' }}>
                            Al finalizar tu jornada laboral, realiza el arqueo completo con conteo de dinero e inventario.
                        </p>
                        <button
                            onClick={() => setShowCloseModal(true)}
                            style={{
                                width: '100%',
                                background: 'var(--color-danger)',
                                border: 'none',
                                color: 'white',
                                padding: '14px',
                                borderRadius: '10px',
                                fontSize: '16px',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px'
                            }}
                        >
                            Cerrar Turno (Arqueo de Caja)
                        </button>
                    </div>
                </div>
            </div>

            {/* EXPENSE MODAL */}
            {showExpenseModal && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'rgba(0,0,0,0.85)',
                    backdropFilter: 'blur(4px)',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    padding: '16px',
                    zIndex: 100
                }}>
                    <div style={{
                        background: 'var(--color-card)',
                        padding: '24px',
                        borderRadius: '16px',
                        width: '100%',
                        maxWidth: '420px',
                        border: '1px solid var(--color-border)',
                        boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <h3 style={{ margin: 0, fontSize: '18px' }}>Registrar Gasto de Caja</h3>
                            <button
                                onClick={() => setShowExpenseModal(false)}
                                style={{ background: 'transparent', border: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer', padding: '4px' }}
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--color-text-secondary)' }}>Monto a retirar ($)</label>
                            <input
                                type="number"
                                inputMode="decimal"
                                placeholder="0.00"
                                value={expenseAmount}
                                onChange={e => setExpenseAmount(e.target.value)}
                                autoFocus
                                style={{ width: '100%', padding: '12px', fontSize: '18px', fontWeight: 'bold', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--color-border)', borderRadius: '8px', color: 'white' }}
                            />
                        </div>

                        <div style={{ marginBottom: '24px' }}>
                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--color-text-secondary)' }}>Motivo / Concepto</label>
                            <input
                                type="text"
                                value={expenseReason}
                                onChange={e => setExpenseReason(e.target.value)}
                                placeholder="Ej. Compra de papel higiénico, limpieza..."
                                style={{ width: '100%', padding: '12px', fontSize: '14px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--color-border)', borderRadius: '8px', color: 'white' }}
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button
                                onClick={() => setShowExpenseModal(false)}
                                style={{ flex: 1, padding: '12px', background: 'transparent', border: '1px solid var(--color-border)', borderRadius: '8px', color: 'var(--color-text-secondary)', cursor: 'pointer' }}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleRegisterExpense}
                                style={{ flex: 1, padding: '12px', background: 'var(--color-danger)', border: 'none', borderRadius: '8px', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}
                            >
                                Registrar Salida
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* CLOSE SHIFT MODAL */}
            {showCloseModal && (
                <CloseShiftModal
                    title="Arqueo de Caja"
                    shift={{ total_efectivo: shift.total_efectivo, monto_inicial: shift.monto_inicial, retiros: shift.retiros }}
                    onCancel={() => setShowCloseModal(false)}
                    onConfirm={(cashCount, countedCash, nextFundCashCount, nextFundTotal, inventarioCierre) =>
                        closeShift(cashCount, countedCash, nextFundCashCount, nextFundTotal, inventarioCierre)
                    }
                    onClosed={(difference) => {
                        setCloseResult({ success: true, difference });
                        setShowCloseModal(false);
                    }}
                />
            )}
        </div>
    );
}
