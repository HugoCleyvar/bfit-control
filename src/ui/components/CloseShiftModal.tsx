import { useState, useEffect } from 'react';
import type { CashCount } from '../../domain/types';
import { DenominationCounter } from './DenominationCounter';
import { InventoryCounter, type InventoryItemCount } from './InventoryCounter';
import { getProducts, type Product } from '../../logic/api/productService';
import { X, ShieldCheck, AlertCircle } from 'lucide-react';

export interface CloseShiftResult {
    success: boolean;
    difference?: number;
    message?: string;
}

interface CloseShiftModalProps {
    title: string;
    shift: { total_efectivo: number; monto_inicial: number; retiros: number };
    onCancel: () => void;
    onConfirm: (
        cashCount: CashCount,
        countedCash: number,
        nextFundCashCount: CashCount,
        nextFundTotal: number,
        inventarioCierre?: Record<string, InventoryItemCount>
    ) => Promise<CloseShiftResult>;
    onClosed: (difference: number) => void;
}

export function CloseShiftModal({ title, shift, onCancel, onConfirm, onClosed }: CloseShiftModalProps) {
    const [countedCash, setCountedCash] = useState(0);
    const [denominations, setDenominations] = useState<CashCount>({});
    const [nextFundTotal, setNextFundTotal] = useState(0);
    const [nextFundDenominations, setNextFundDenominations] = useState<CashCount>({});
    const [products, setProducts] = useState<Product[]>([]);
    const [inventoryCounts, setInventoryCounts] = useState<Record<string, InventoryItemCount>>({});
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        getProducts().then(setProducts).catch(err => console.error('Error loading products for shift close:', err));
    }, []);

    const handleConfirm = async () => {
        setSubmitting(true);
        const result = await onConfirm(denominations, countedCash, nextFundDenominations, nextFundTotal, inventoryCounts);
        setSubmitting(false);

        if (result.success) {
            onClosed(result.difference ?? 0);
        } else {
            alert('Error al cerrar turno' + (result.message ? `: ${result.message}` : ''));
        }
    };

    const difference = countedCash - shift.total_efectivo;
    const deliverToAdmin = Math.max(0, countedCash - nextFundTotal);
    const cashSales = shift.total_efectivo - shift.monto_inicial + shift.retiros;

    // Check inventory differences
    const inventoryDiscrepancies = Object.values(inventoryCounts).filter(i => i.diff !== 0);

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.85)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '12px',
            zIndex: 100
        }}>
            <div style={{
                background: 'var(--color-card)',
                width: '100%',
                maxWidth: '640px',
                maxHeight: '94vh',
                display: 'flex',
                flexDirection: 'column',
                borderRadius: '16px',
                border: '1px solid var(--color-border)',
                boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
                overflow: 'hidden'
            }}>
                {/* Header */}
                <div style={{
                    padding: '16px 20px',
                    borderBottom: '1px solid var(--color-border)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: 'rgba(255,255,255,0.02)'
                }}>
                    <h2 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <ShieldCheck size={20} color="var(--color-accent)" /> {title}
                    </h2>
                    <button
                        onClick={onCancel}
                        disabled={submitting}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--color-text-secondary)',
                            cursor: 'pointer',
                            padding: '6px',
                            display: 'flex',
                            borderRadius: '50%'
                        }}
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Body (Scrollable) */}
                <div style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '24px'
                }}>
                    {/* Step 1: Cash in Drawer */}
                    <div style={{
                        background: 'rgba(255,255,255,0.02)',
                        border: '1px solid var(--color-border)',
                        borderRadius: '12px',
                        padding: '16px'
                    }}>
                        <h3 style={{
                            fontSize: '16px',
                            fontWeight: '600',
                            marginBottom: '12px',
                            color: '#81C784',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                        }}>
                            <span style={{
                                width: '24px',
                                height: '24px',
                                borderRadius: '50%',
                                background: '#81C784',
                                color: 'black',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '13px',
                                fontWeight: 'bold'
                            }}>1</span>
                            Efectivo Total en Caja
                        </h3>
                        <DenominationCounter onChange={(total, counts) => {
                            setCountedCash(total);
                            setDenominations(counts);
                        }} />
                    </div>

                    {/* Step 2: Next Shift Fund */}
                    <div style={{
                        background: 'rgba(255,255,255,0.02)',
                        border: '1px solid var(--color-border)',
                        borderRadius: '12px',
                        padding: '16px'
                    }}>
                        <h3 style={{
                            fontSize: '16px',
                            fontWeight: '600',
                            marginBottom: '6px',
                            color: '#FFB74D',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                        }}>
                            <span style={{
                                width: '24px',
                                height: '24px',
                                borderRadius: '50%',
                                background: '#FFB74D',
                                color: 'black',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '13px',
                                fontWeight: 'bold'
                            }}>2</span>
                            Fondo para el Siguiente Turno
                        </h3>
                        <p style={{ color: 'var(--color-text-secondary)', fontSize: '13px', marginBottom: '14px' }}>
                            Cuenta el dinero que se dejará como fondo inicial para el siguiente turno.
                        </p>
                        <DenominationCounter onChange={(total, counts) => {
                            setNextFundTotal(total);
                            setNextFundDenominations(counts);
                        }} />
                    </div>

                    {/* Step 3: Physical Inventory Count */}
                    {products.length > 0 && (
                        <div style={{
                            background: 'rgba(255,255,255,0.02)',
                            border: '1px solid var(--color-border)',
                            borderRadius: '12px',
                            padding: '16px'
                        }}>
                            <h3 style={{
                                fontSize: '16px',
                                fontWeight: '600',
                                marginBottom: '12px',
                                color: 'var(--color-accent)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                            }}>
                                <span style={{
                                    width: '24px',
                                    height: '24px',
                                    borderRadius: '50%',
                                    background: 'var(--color-accent)',
                                    color: 'black',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '13px',
                                    fontWeight: 'bold'
                                }}>3</span>
                                Arqueo de Inventario Físico
                            </h3>
                            <InventoryCounter products={products} onChange={setInventoryCounts} />
                        </div>
                    )}

                    {/* Step 4: Summary */}
                    <div style={{
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid var(--color-border)',
                        borderRadius: '12px',
                        padding: '18px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px'
                    }}>
                        <div style={{ fontWeight: 'bold', fontSize: '15px', borderBottom: '1px solid var(--color-border)', paddingBottom: '8px' }}>
                            Resumen de Cierre
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: 'var(--color-text-secondary)' }}>
                            <span>Fondo Inicial:</span>
                            <span>${shift.monto_inicial.toLocaleString()}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: 'var(--color-text-secondary)' }}>
                            <span>Ventas del Turno:</span>
                            <span style={{ color: 'var(--color-success)', fontWeight: '500' }}>+${cashSales.toLocaleString()}</span>
                        </div>
                        {shift.retiros > 0 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: 'var(--color-text-secondary)' }}>
                                <span>Gastos / Retiros:</span>
                                <span style={{ color: 'var(--color-danger)', fontWeight: '500' }}>-${shift.retiros.toLocaleString()}</span>
                            </div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', borderTop: '1px dashed var(--color-border)', paddingTop: '8px' }}>
                            <span>Efectivo Esperado en Sistema:</span>
                            <span style={{ fontWeight: 'bold' }}>${shift.total_efectivo.toLocaleString()}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '15px' }}>
                            <span>Efectivo Real Contado:</span>
                            <span style={{ fontWeight: 'bold', color: 'white' }}>${countedCash.toLocaleString()}</span>
                        </div>

                        {/* Difference Alert */}
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '10px 14px',
                            borderRadius: '8px',
                            background: difference === 0 ? 'rgba(76, 175, 80, 0.15)' : (difference < 0 ? 'rgba(244, 67, 54, 0.15)' : 'rgba(255, 183, 77, 0.15)'),
                            border: `1px solid ${difference === 0 ? 'var(--color-success)' : (difference < 0 ? 'var(--color-danger)' : 'var(--color-warning)')}`,
                            fontSize: '15px'
                        }}>
                            <span style={{ fontWeight: '600' }}>Diferencia de Efectivo:</span>
                            <span style={{
                                fontWeight: 'bold',
                                color: difference === 0 ? 'var(--color-success)' : (difference < 0 ? 'var(--color-danger)' : 'var(--color-warning)')
                            }}>
                                {difference === 0 ? '✓ Cuadrado' : `${difference > 0 ? '+' : ''}$${difference.toLocaleString()}`}
                            </span>
                        </div>

                        {/* Next fund & delivery */}
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '12px 14px',
                            borderRadius: '8px',
                            background: 'rgba(0,0,0,0.3)',
                            border: '1px solid var(--color-border)',
                            fontSize: '15px'
                        }}>
                            <span style={{ color: '#FFB74D', fontWeight: '500' }}>Fondo que se queda:</span>
                            <span style={{ color: '#FFB74D', fontWeight: 'bold' }}>${nextFundTotal.toLocaleString()}</span>
                        </div>

                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '14px',
                            borderRadius: '10px',
                            background: 'rgba(245, 158, 11, 0.12)',
                            border: '1px solid rgba(245, 158, 11, 0.4)',
                            fontSize: '16px'
                        }}>
                            <span style={{ fontWeight: 'bold', color: 'var(--color-accent)' }}>ENTREGAR AL ADMIN:</span>
                            <span style={{ fontSize: '20px', fontWeight: 'bold', color: 'var(--color-accent)' }}>
                                ${deliverToAdmin.toLocaleString()}
                            </span>
                        </div>

                        {/* Inventory Difference Summary if any */}
                        {inventoryDiscrepancies.length > 0 && (
                            <div style={{
                                marginTop: '6px',
                                padding: '10px 14px',
                                borderRadius: '8px',
                                background: 'rgba(239, 68, 68, 0.1)',
                                border: '1px solid rgba(239, 68, 68, 0.3)',
                                fontSize: '13px'
                            }}>
                                <div style={{ fontWeight: 'bold', color: 'var(--color-danger)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <AlertCircle size={15} /> Diferencias en Inventario Detectadas:
                                </div>
                                {inventoryDiscrepancies.map(item => (
                                    <div key={item.nombre} style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-text-secondary)', padding: '2px 0' }}>
                                        <span>{item.nombre} (Físico: {item.fisico}, Sist: {item.sistema})</span>
                                        <span style={{ fontWeight: 'bold', color: item.diff < 0 ? 'var(--color-danger)' : 'var(--color-warning)' }}>
                                            {item.diff > 0 ? `+${item.diff}` : item.diff}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer Actions (Sticky) */}
                <div style={{
                    padding: '16px 20px',
                    borderTop: '1px solid var(--color-border)',
                    display: 'flex',
                    gap: '12px',
                    background: 'rgba(255,255,255,0.02)'
                }}>
                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={submitting}
                        style={{
                            flex: 1,
                            padding: '12px',
                            fontSize: '15px',
                            background: 'transparent',
                            border: '1px solid var(--color-border)',
                            borderRadius: '8px',
                            color: 'var(--color-text-secondary)',
                            cursor: 'pointer'
                        }}
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        onClick={handleConfirm}
                        disabled={submitting}
                        style={{
                            flex: 2,
                            padding: '12px',
                            fontSize: '15px',
                            fontWeight: 'bold',
                            background: 'var(--color-primary)',
                            border: 'none',
                            borderRadius: '8px',
                            color: 'white',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px'
                        }}
                    >
                        {submitting ? 'Cerrando Turno...' : 'Confirmar Cierre de Caja'}
                    </button>
                </div>
            </div>
        </div>
    );
}
