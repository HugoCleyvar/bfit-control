import { useState, useEffect, useCallback, useMemo } from 'react';
import { getProducts, createProduct, updateProduct, deleteProduct, type Product } from '../../logic/api/productService';
import { DataTable, type Column } from '../components/DataTable';
import { PlusCircle, AlertTriangle, Edit, Trash2 } from 'lucide-react';
import { useAuth } from '../../logic/authContext';

interface ProductFormData {
    name: string;
    price: number;
    stock: number;
    min_stock: number;
    category: string;
    emoji: string;
}

export default function ProductsPage() {
    const { isAdmin } = useAuth();
    const [products, setProducts] = useState<Product[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | undefined>(undefined);

    const loadProducts = useCallback(async () => {
        const data = await getProducts();
        setProducts(data);
    }, []);

    useEffect(() => {
        loadProducts();
    }, [loadProducts]);

    const columns: Column<Product>[] = [
        {
            header: 'Producto',
            accessor: (p) => (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ fontSize: '24px' }}>{p.emoji}</div>
                    <div>
                        <div style={{ fontWeight: 'bold' }}>{p.name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>{p.category}</div>
                    </div>
                </div>
            )
        },
        {
            header: 'Precio',
            accessor: (p) => `$${p.price.toFixed(2)}`
        },
        {
            header: 'Stock',
            accessor: (p) => {
                const isLow = p.stock <= p.min_stock;
                return (
                    <div style={{
                        color: isLow ? 'var(--color-danger)' : 'var(--color-success)',
                        fontWeight: 'bold',
                        display: 'flex', alignItems: 'center', gap: '6px'
                    }}>
                        {isLow && <AlertTriangle size={14} />}
                        {p.stock}
                    </div>
                );
            }
        }
    ];

    const handleDelete = async (id: string) => {
        if (confirm('¿Eliminar producto?')) {
            await deleteProduct(id);
            loadProducts();
        }
    };

    const handleSave = async (data: ProductFormData) => {
        if (editingProduct) {
            await updateProduct(editingProduct.id, data);
        } else {
            await createProduct(data);
        }
        setIsModalOpen(false);
        loadProducts();
    };

    return (
        <div className="page-container">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-lg)' }}>
                <h2>Inventario</h2>
                {isAdmin && (
                    <button
                        onClick={() => { setEditingProduct(undefined); setIsModalOpen(true); }}
                        style={{ display: 'flex', gap: '8px', alignItems: 'center' }}
                    >
                        <PlusCircle size={18} /> Nuevo Producto
                    </button>
                )}
            </div>

            <DataTable
                columns={columns}
                data={products}
                keyExtractor={p => p.id}
                actions={isAdmin ? [
                    { icon: Edit, onClick: (p) => { setEditingProduct(p); setIsModalOpen(true); } },
                    { icon: Trash2, onClick: (p) => handleDelete(p.id), className: 'text-danger' }
                ] : undefined}
            />

            {isModalOpen && (
                <ProductForm
                    initialData={editingProduct}
                    onClose={() => setIsModalOpen(false)}
                    onSave={handleSave}
                />
            )}
        </div>
    );
}

function ProductForm({ initialData, onClose, onSave }: { initialData?: Product, onClose: () => void, onSave: (d: ProductFormData) => void }) {
    const initialFormData = useMemo(() => ({
        name: initialData?.name || '',
        price: initialData?.price?.toString() || '',
        stock: initialData?.stock?.toString() || '',
        min_stock: initialData?.min_stock?.toString() || '5',
        category: initialData?.category || 'General',
        emoji: initialData?.emoji || '📦'
    }), [initialData]);

    const [formData, setFormData] = useState(initialFormData);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({
            ...formData,
            price: Number(formData.price),
            stock: Number(formData.stock),
            min_stock: Number(formData.min_stock)
        });
    };

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
            <div style={{
                backgroundColor: 'var(--color-card)', padding: '30px', borderRadius: '12px',
                width: '100%', maxWidth: '400px', border: '1px solid var(--color-border)'
            }}>
                <h3 style={{ marginTop: 0 }}>{initialData ? 'Editar Producto' : 'Nuevo Producto'}</h3>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    <div>
                        <label>Nombre</label>
                        <input required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })}
                            style={{ width: '100%', padding: '8px', background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'white', borderRadius: '6px' }} />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        <div>
                            <label>Precio</label>
                            <input type="number" required value={formData.price} onChange={e => setFormData({ ...formData, price: e.target.value })}
                                style={{ width: '100%', padding: '8px', background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'white', borderRadius: '6px' }} />
                        </div>
                        <div>
                            <label>Stock</label>
                            <input type="number" required value={formData.stock} onChange={e => setFormData({ ...formData, stock: e.target.value })}
                                style={{ width: '100%', padding: '8px', background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'white', borderRadius: '6px' }} />
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        <div>
                            <label>Categoría</label>
                            <select value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })}
                                style={{ width: '100%', padding: '8px', background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'white', borderRadius: '6px' }}>
                                <option>Bebidas</option>
                                <option>Suplementos</option>
                                <option>Snacks</option>
                                <option>Ropa</option>
                                <option>Servicios</option>
                                <option>General</option>
                            </select>
                        </div>
                        <div>
                            <label>Icono (Emoji)</label>
                            <input type="text" maxLength={2} value={formData.emoji} onChange={e => setFormData({ ...formData, emoji: e.target.value })}
                                style={{ width: '100%', padding: '8px', background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'white', borderRadius: '6px' }} />
                        </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                        <button type="button" onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'gray', cursor: 'pointer' }}>Cancelar</button>
                        <button type="submit" style={{ background: 'var(--color-primary)', border: 'none', padding: '8px 16px', borderRadius: '6px', color: 'white', cursor: 'pointer' }}>Guardar</button>
                    </div>
                </form>
            </div>
        </div>
    );
}
