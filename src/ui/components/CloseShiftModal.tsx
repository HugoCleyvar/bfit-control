import { useState } from 'react';
import type { CashCount } from '../../domain/types';
import { DenominationCounter } from './DenominationCounter';

export interface CloseShiftResult {
    success: boolean;
    difference?: number;
    message?: string;
}

interface CloseShiftModalProps {
    title: string;
    shift: { total_efectivo: number; monto_inicial: number; retiros: number };
    onCancel: () => void;
    onConfirm: (cashCount: CashCount, countedCash: number, nextFundCashCount: CashCount, nextFundTotal: number) => Promise<CloseShiftResult>;
    onClosed: (difference: number) => void;
}

// Shared "Arqueo de Caja" flow: counts the drawer, splits off next shift's fund, and confirms
// the close. Used both for a collaborator closing their own shift and for an admin closing a
// collaborator's shift on their behalf (e.g. they had to leave early) - only how onConfirm
// persists the close differs between those two cases.
export function CloseShiftModal({ title, shift, onCancel, onConfirm, onClosed }: CloseShiftModalProps) {
    const [countedCash, setCountedCash] = useState(0);
    const [denominations, setDenominations] = useState<CashCount>({});
    const [nextFundTotal, setNextFundTotal] = useState(0);
    const [nextFundDenominations, setNextFundDenominations] = useState<CashCount>({});
    const [submitting, setSubmitting] = useState(false);

    const handleConfirm = async () => {
        setSubmitting(true);
        const result = await onConfirm(denominations, countedCash, nextFundDenominations, nextFundTotal);
        setSubmitting(false);

        if (result.success) {
            onClosed(result.difference ?? 0);
        } else {
            alert('Error al cerrar turno' + (result.message ? `: ${result.message}` : ''));
        }
    };

    const difference = countedCash - shift.total_efectivo;

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', display: 'flex', justifyContent: 'center', alignItems: 'start', overflowY: 'auto', paddingTop: '50px', zIndex: 100 }}>
            <div style={{ background: 'var(--color-card)', padding: '30px', borderRadius: '12px', width: '600px', marginBottom: '50px' }}>
                <h2 style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: '15px', marginBottom: '20px' }}>{title}</h2>

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
                        <span style={{ color: difference >= 0 ? 'var(--color-success)' : 'var(--color-warning)' }}>
                            {difference === 0 ? '✓ Cuadrado' : difference.toLocaleString()}
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
                    <button onClick={onCancel} disabled={submitting} style={{ flex: 1, background: 'transparent', border: '1px solid var(--color-border)' }}>Cancelar</button>
                    <button onClick={handleConfirm} disabled={submitting} style={{ flex: 1 }}>{submitting ? 'Cerrando...' : 'Confirmar Cierre'}</button>
                </div>
            </div>
        </div>
    );
}
