import { useState, useEffect } from 'react';
import type { Product } from '../../logic/api/productService';

interface InventoryCounterProps {
    products: Product[];
    onChange: (counts: Record<string, number>) => void;
}

export function InventoryCounter({ products, onChange }: InventoryCounterProps) {
    const [counts, setCounts] = useState<Record<string, number>>({});

    // Initialize counts to 0 for all products if not set
    useEffect(() => {
        if (products.length > 0 && Object.keys(counts).length === 0) {
            const initial: Record<string, number> = {};
            products.forEach(p => initial[p.id] = 0);
            setCounts(initial);
            onChange(initial);
        }
    }, [products, counts, onChange]);

    const handleCountChange = (productId: string, value: string) => {
        const numValue = value === '' ? 0 : parseInt(value, 10);
        if (isNaN(numValue) || numValue < 0) return;

        const newCounts = { ...counts, [productId]: numValue };
        setCounts(newCounts);
        onChange(newCounts);
    };

    if (products.length === 0) {
        return <p style={{ color: 'var(--color-text-secondary)', fontStyle: 'italic', fontSize: '14px' }}>No hay productos activos en el inventario.</p>;
    }

    return (
        <div style={{ display: 'grid', gap: '10px' }}>
            {products.map(product => (
                <div key={product.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '20px' }}>{product.emoji || '📦'}</span>
                        <div>
                            <div style={{ fontWeight: 'bold' }}>{product.name}</div>
                            <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>En sistema: {product.stock}</div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <label style={{ fontSize: '14px', color: 'var(--color-text-secondary)' }}>Físico:</label>
                        <input
                            type="number"
                            min="0"
                            value={counts[product.id] === undefined ? '' : counts[product.id]}
                            onChange={(e) => handleCountChange(product.id, e.target.value)}
                            style={{
                                width: '70px',
                                padding: '8px',
                                background: 'var(--color-bg)',
                                border: '1px solid var(--color-border)',
                                borderRadius: '6px',
                                color: 'white',
                                textAlign: 'right'
                            }}
                        />
                    </div>
                </div>
            ))}
        </div>
    );
}
