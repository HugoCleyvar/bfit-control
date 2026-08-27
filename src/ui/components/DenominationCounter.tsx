import { useState, useEffect, useCallback } from 'react';
import { Banknote, Coins, Plus, Minus } from 'lucide-react';
import type { CashCount } from '../../domain/types';

interface Props {
    onChange: (total: number, counts: CashCount) => void;
    initialCounts?: CashCount;
}

const BILLS = [1000, 500, 200, 100, 50, 20];
const COINS = [20, 10, 5, 2, 1, 0.5];

export function DenominationCounter({ onChange, initialCounts }: Props) {
    const [counts, setCounts] = useState<CashCount>(() => initialCounts || {});

    const calculate = useCallback(() => {
        let total = 0;
        Object.entries(counts).forEach(([denom, qty]) => {
            total += Number(denom) * (qty || 0);
        });
        onChange(total, counts);
    }, [counts, onChange]);

    useEffect(() => {
        calculate();
    }, [calculate]);

    const handleChange = (denom: number, qty: string) => {
        const val = Math.max(0, parseInt(qty, 10) || 0);
        setCounts(prev => ({
            ...prev,
            [denom]: val
        }));
    };

    const handleStep = (denom: number, delta: number) => {
        setCounts(prev => {
            const current = prev[denom] || 0;
            const next = Math.max(0, current + delta);
            return { ...prev, [denom]: next };
        });
    };

    const getSubtotal = (denom: number) => {
        return (counts[denom] || 0) * denom;
    };

    const getTotal = () => {
        return Object.entries(counts).reduce((acc, [denom, qty]) => acc + Number(denom) * (qty || 0), 0);
    };

    return (
        <div className="denomination-counter" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
                {/* Bills Column */}
                <div style={{ padding: '16px', backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid var(--color-border)', borderRadius: '10px' }}>
                    <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', color: '#81C784', fontSize: '15px' }}>
                        <Banknote size={18} /> Billetes
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {BILLS.map(denom => (
                            <div key={denom} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', padding: '4px 0' }}>
                                <span style={{ minWidth: '55px', fontWeight: 'bold', fontSize: '15px', color: 'white' }}>${denom}</span>
                                
                                <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.3)', borderRadius: '6px', border: '1px solid var(--color-border)' }}>
                                    <button
                                        type="button"
                                        onClick={() => handleStep(denom, -1)}
                                        style={{ padding: '6px 8px', background: 'transparent', border: 'none', color: 'var(--color-text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                                        aria-label={`Restar billete de $${denom}`}
                                    >
                                        <Minus size={14} />
                                    </button>
                                    <input
                                        type="number"
                                        inputMode="numeric"
                                        pattern="[0-9]*"
                                        min="0"
                                        placeholder="0"
                                        value={counts[denom] || ''}
                                        onChange={(e) => handleChange(denom, e.target.value)}
                                        style={{
                                            width: '44px',
                                            padding: '4px 2px',
                                            textAlign: 'center',
                                            fontSize: '16px',
                                            fontWeight: 'bold',
                                            background: 'transparent',
                                            border: 'none',
                                            color: 'white',
                                            outline: 'none'
                                        }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => handleStep(denom, 1)}
                                        style={{ padding: '6px 8px', background: 'transparent', border: 'none', color: 'var(--color-text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                                        aria-label={`Sumar billete de $${denom}`}
                                    >
                                        <Plus size={14} />
                                    </button>
                                </div>

                                <span style={{ minWidth: '70px', textAlign: 'right', color: '#81C784', fontSize: '14px', fontWeight: '500' }}>
                                    ${getSubtotal(denom).toLocaleString()}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Coins Column */}
                <div style={{ padding: '16px', backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid var(--color-border)', borderRadius: '10px' }}>
                    <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', color: '#FFB74D', fontSize: '15px' }}>
                        <Coins size={18} /> Monedas
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {COINS.map(denom => (
                            <div key={denom} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', padding: '4px 0' }}>
                                <span style={{ minWidth: '55px', fontWeight: 'bold', fontSize: '15px', color: 'white' }}>${denom}</span>
                                
                                <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.3)', borderRadius: '6px', border: '1px solid var(--color-border)' }}>
                                    <button
                                        type="button"
                                        onClick={() => handleStep(denom, -1)}
                                        style={{ padding: '6px 8px', background: 'transparent', border: 'none', color: 'var(--color-text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                                        aria-label={`Restar moneda de $${denom}`}
                                    >
                                        <Minus size={14} />
                                    </button>
                                    <input
                                        type="number"
                                        inputMode="numeric"
                                        pattern="[0-9]*"
                                        min="0"
                                        placeholder="0"
                                        value={counts[denom] || ''}
                                        onChange={(e) => handleChange(denom, e.target.value)}
                                        style={{
                                            width: '44px',
                                            padding: '4px 2px',
                                            textAlign: 'center',
                                            fontSize: '16px',
                                            fontWeight: 'bold',
                                            background: 'transparent',
                                            border: 'none',
                                            color: 'white',
                                            outline: 'none'
                                        }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => handleStep(denom, 1)}
                                        style={{ padding: '6px 8px', background: 'transparent', border: 'none', color: 'var(--color-text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                                        aria-label={`Sumar moneda de $${denom}`}
                                    >
                                        <Plus size={14} />
                                    </button>
                                </div>

                                <span style={{ minWidth: '70px', textAlign: 'right', color: '#FFB74D', fontSize: '14px', fontWeight: '500' }}>
                                    ${getSubtotal(denom).toLocaleString()}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Total Footer Banner */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 16px',
                background: 'rgba(255,255,255,0.06)',
                borderRadius: '8px',
                border: '1px solid var(--color-border)'
            }}>
                <span style={{ fontWeight: '600', fontSize: '14px', color: 'var(--color-text-secondary)' }}>Total Efectivo Contado:</span>
                <span style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--color-success)' }}>
                    ${getTotal().toLocaleString()}
                </span>
            </div>
        </div>
    );
}
