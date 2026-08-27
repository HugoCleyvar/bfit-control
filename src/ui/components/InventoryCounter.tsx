import { useState, useEffect, useCallback } from 'react';
import { Check, AlertTriangle, Plus, Minus, RotateCcw } from 'lucide-react';
import type { Product } from '../../logic/api/productService';

export interface InventoryItemCount {
    fisico: number;
    sistema: number;
    diff: number;
    nombre: string;
}

interface InventoryCounterProps {
    products: Product[];
    initialCounts?: Record<string, number>;
    onChange: (counts: Record<string, InventoryItemCount>) => void;
}

export function InventoryCounter({ products, initialCounts, onChange }: InventoryCounterProps) {
    const [physicalCounts, setPhysicalCounts] = useState<Record<string, number>>(() => {
        if (initialCounts) return { ...initialCounts };
        const initial: Record<string, number> = {};
        products.forEach(p => {
            initial[p.id] = p.stock ?? 0;
        });
        return initial;
    });

    const notifyChange = useCallback((counts: Record<string, number>) => {
        const enriched: Record<string, InventoryItemCount> = {};
        products.forEach(p => {
            const fisico = counts[p.id] !== undefined ? counts[p.id] : (p.stock ?? 0);
            const sistema = p.stock ?? 0;
            enriched[p.id] = {
                fisico,
                sistema,
                diff: fisico - sistema,
                nombre: p.name
            };
        });
        onChange(enriched);
    }, [products, onChange]);

    // Initial notification on mount or products load
    useEffect(() => {
        if (products.length > 0) {
            setPhysicalCounts(prev => {
                const next = { ...prev };
                let hasNew = false;
                products.forEach(p => {
                    if (next[p.id] === undefined) {
                        next[p.id] = p.stock ?? 0;
                        hasNew = true;
                    }
                });
                if (hasNew) {
                    notifyChange(next);
                }
                return next;
            });
        }
    }, [products, notifyChange]);

    const handleCountChange = (productId: string, value: number) => {
        const safeVal = Math.max(0, Math.floor(isNaN(value) ? 0 : value));
        setPhysicalCounts(prev => {
            const next = { ...prev, [productId]: safeVal };
            notifyChange(next);
            return next;
        });
    };

    const handleIncrement = (productId: string) => {
        const current = physicalCounts[productId] ?? products.find(p => p.id === productId)?.stock ?? 0;
        handleCountChange(productId, current + 1);
    };

    const handleDecrement = (productId: string) => {
        const current = physicalCounts[productId] ?? products.find(p => p.id === productId)?.stock ?? 0;
        handleCountChange(productId, Math.max(0, current - 1));
    };

    const handleResetAllToSystem = () => {
        const reset: Record<string, number> = {};
        products.forEach(p => {
            reset[p.id] = p.stock ?? 0;
        });
        setPhysicalCounts(reset);
        notifyChange(reset);
    };

    if (products.length === 0) {
        return (
            <div style={{ padding: '16px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                No hay productos activos en inventario.
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Quick Action Button for Mobile */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                    Verifica la cantidad física de cada producto:
                </span>
                <button
                    type="button"
                    onClick={handleResetAllToSystem}
                    style={{
                        padding: '6px 12px',
                        fontSize: '12px',
                        background: 'rgba(255,255,255,0.08)',
                        border: '1px solid var(--color-border)',
                        borderRadius: '6px',
                        color: 'var(--color-text-primary)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        cursor: 'pointer'
                    }}
                >
                    <RotateCcw size={14} /> Prellenar con Sistema (Cuadrado)
                </button>
            </div>

            {/* Products List - Mobile Optimized */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {products.map(p => {
                    const count = physicalCounts[p.id] !== undefined ? physicalCounts[p.id] : (p.stock ?? 0);
                    const diff = count - (p.stock ?? 0);
                    const isOk = diff === 0;
                    const isShort = diff < 0;

                    return (
                        <div
                            key={p.id}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                flexWrap: 'wrap',
                                gap: '10px',
                                padding: '12px',
                                background: isOk ? 'rgba(255,255,255,0.03)' : (isShort ? 'rgba(239, 68, 68, 0.08)' : 'rgba(245, 158, 11, 0.08)'),
                                border: `1px solid ${isOk ? 'var(--color-border)' : (isShort ? 'rgba(239, 68, 68, 0.3)' : 'rgba(245, 158, 11, 0.3)')}`,
                                borderRadius: '10px'
                            }}
                        >
                            {/* Product Info */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: '140px', flex: '1 1 auto' }}>
                                <span style={{ fontSize: '24px' }}>{p.emoji || '📦'}</span>
                                <div>
                                    <div style={{ fontWeight: '600', fontSize: '15px', color: 'var(--color-text-primary)' }}>{p.name}</div>
                                    <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                                        Sistema: <strong style={{ color: 'white' }}>{p.stock ?? 0}</strong>
                                    </div>
                                </div>
                            </div>

                            {/* Stepper Controls & Difference Badge */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'nowrap' }}>
                                <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
                                    <button
                                        type="button"
                                        onClick={() => handleDecrement(p.id)}
                                        style={{
                                            padding: '8px 12px',
                                            background: 'transparent',
                                            border: 'none',
                                            color: 'var(--color-text-primary)',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            minWidth: '36px',
                                            minHeight: '36px'
                                        }}
                                        aria-label="Disminuir"
                                    >
                                        <Minus size={16} />
                                    </button>

                                    <input
                                        type="number"
                                        inputMode="numeric"
                                        pattern="[0-9]*"
                                        min="0"
                                        value={count}
                                        onChange={(e) => handleCountChange(p.id, parseInt(e.target.value, 10))}
                                        style={{
                                            width: '50px',
                                            padding: '6px 2px',
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
                                        onClick={() => handleIncrement(p.id)}
                                        style={{
                                            padding: '8px 12px',
                                            background: 'transparent',
                                            border: 'none',
                                            color: 'var(--color-text-primary)',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            minWidth: '36px',
                                            minHeight: '36px'
                                        }}
                                        aria-label="Aumentar"
                                    >
                                        <Plus size={16} />
                                    </button>
                                </div>

                                {/* Status Badge */}
                                <div
                                    style={{
                                        minWidth: '85px',
                                        textAlign: 'right',
                                        fontSize: '12px',
                                        fontWeight: '600',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'flex-end',
                                        gap: '4px',
                                        color: isOk ? 'var(--color-success)' : (isShort ? 'var(--color-danger)' : 'var(--color-warning)')
                                    }}
                                >
                                    {isOk ? (
                                        <>
                                            <Check size={14} /> Cuadrado
                                        </>
                                    ) : (
                                        <>
                                            <AlertTriangle size={14} /> {diff > 0 ? `+${diff}` : `${diff}`}
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
