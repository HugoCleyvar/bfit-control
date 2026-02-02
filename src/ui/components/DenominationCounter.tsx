import { useState, useEffect, useCallback } from 'react';
import { Banknote, Coins } from 'lucide-react';
import type { CashCount } from '../../domain/types';

interface Props {
    onChange: (total: number, counts: CashCount) => void;
}

const BILLS = [1000, 500, 200, 100, 50, 20];
const COINS = [20, 10, 5, 2, 1, 0.5];

export function DenominationCounter({ onChange }: Props) {
    const [counts, setCounts] = useState<CashCount>({});

    const calculate = useCallback(() => {
        let total = 0;
        Object.entries(counts).forEach(([denom, qty]) => {
            total += Number(denom) * qty;
        });
        onChange(total, counts);
    }, [counts, onChange]);

    useEffect(() => {
        calculate();
    }, [calculate]);

    const handleChange = (denom: number, qty: string) => {
        const val = parseInt(qty) || 0;
        setCounts(prev => ({
            ...prev,
            [denom]: val
        }));
    };

    const getSubtotal = (denom: number) => {
        return (counts[denom] || 0) * denom;
    };

    const getTotal = () => {
        return Object.entries(counts).reduce((acc, [denom, qty]) => acc + Number(denom) * qty, 0);
    };

    return (
        <div className="denomination-counter" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            {/* Bills Column */}
            <div style={{ padding: '15px', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '15px', color: '#81C784' }}>
                    <Banknote size={18} /> Billetes
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {BILLS.map(denom => (
                        <div key={denom} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ minWidth: '60px', fontWeight: 'bold' }}>${denom}</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <span style={{ fontSize: '12px', color: '#888' }}>x</span>
                                <input
                                    type="number"
                                    min="0"
                                    placeholder="0"
                                    value={counts[denom] || ''}
                                    onChange={(e) => handleChange(denom, e.target.value)}
                                    style={{
                                        width: '60px', padding: '5px', textAlign: 'center',
                                        background: 'rgba(0,0,0,0.2)', border: '1px solid #444', color: 'white', borderRadius: '4px'
                                    }}
                                />
                                <span style={{ minWidth: '70px', textAlign: 'right', color: '#AAA' }}>
                                    = ${getSubtotal(denom).toLocaleString()}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Coins Column */}
            <div style={{ padding: '15px', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '15px', color: '#FFB74D' }}>
                    <Coins size={18} /> Monedas
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {COINS.map(denom => (
                        <div key={denom} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ minWidth: '60px', fontWeight: 'bold' }}>${denom}</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <span style={{ fontSize: '12px', color: '#888' }}>x</span>
                                <input
                                    type="number"
                                    min="0"
                                    placeholder="0"
                                    value={counts[denom] || ''}
                                    onChange={(e) => handleChange(denom, e.target.value)}
                                    style={{
                                        width: '60px', padding: '5px', textAlign: 'center',
                                        background: 'rgba(0,0,0,0.2)', border: '1px solid #444', color: 'white', borderRadius: '4px'
                                    }}
                                />
                                <span style={{ minWidth: '70px', textAlign: 'right', color: '#AAA' }}>
                                    = ${getSubtotal(denom).toLocaleString()}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Total Footer */}
            <div style={{ gridColumn: 'span 2', textAlign: 'right', marginTop: '10px', padding: '15px', background: '#333', borderRadius: '8px' }}>
                <span style={{ marginRight: '15px', color: '#CCC' }}>Total Contado:</span>
                <span style={{ fontSize: '24px', fontWeight: 'bold', color: '#4CAF50' }}>
                    ${getTotal().toLocaleString()}
                </span>
            </div>
        </div>
    );
}
