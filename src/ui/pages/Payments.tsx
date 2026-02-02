import { useState, useEffect, useCallback } from 'react';
import { getPayments, registerPayment } from '../../logic/api/financeService';
import { getPlans, type Plan } from '../../logic/api/planService';
import { getProducts, processSaleDeduction, type Product } from '../../logic/api/productService'; // New Import
import { useAuth } from '../../logic/authContext';
import { useShift } from '../../logic/shiftContext';
import type { Payment } from '../../domain/types';
import { DataTable } from '../components/DataTable';
import type { Column } from '../components/DataTable';
import { MemberSearch } from '../components/MemberSearch';
import { CreditCard, Banknote, DollarSign, PlusCircle } from 'lucide-react';

export default function PaymentsPage() {
    const [payments, setPayments] = useState<Payment[]>([]);
    const [loading, setLoading] = useState(true);

    // Form State
    const [mode, setMode] = useState<'quick' | 'membership'>('membership');
    const [amount, setAmount] = useState('');
    const [concept, setConcept] = useState('');
    const [method, setMethod] = useState<'efectivo' | 'tarjeta'>('efectivo');

    // Membership specific
    const [selectedMemberId, setSelectedMemberId] = useState('');
    const [selectedPlanId, setSelectedPlanId] = useState('');

    // Data
    const [plans, setPlans] = useState<Plan[]>([]);
    const [products, setProducts] = useState<Product[]>([]); // New State
    const [selectedProductId, setSelectedProductId] = useState<string>(''); // For Inventory tracking

    const loadInitialData = useCallback(async () => {
        setLoading(true);
        try {
            const [pData, plData, prData] = await Promise.all([
                getPayments(50),
                getPlans(),
                getProducts() // Fetch Products
            ]);
            setPayments(pData);
            setPlans(plData);
            setProducts(prData);
        } catch (e) {
            console.error(e);
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        loadInitialData();
    }, [loadInitialData]);

    const { user, isAdmin } = useAuth();
    const { currentShift } = useShift();

    const handlePayment = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validation
        if (!user) return;

        if (!isAdmin && !currentShift) {
            alert('Debes abrir un turno para registrar pagos.');
            return;
        }

        if (mode === 'quick' && (!amount || !concept)) {
            alert('Por favor completa monto y concepto');
            return;
        }
        if (mode === 'membership' && (!selectedMemberId || !selectedPlanId)) return;

        // INVENTORY LOGIC
        if (mode === 'quick' && selectedProductId) {
            const stockResult = await processSaleDeduction(selectedProductId, 1); // Deduct 1 item
            if (!stockResult.success) {
                alert('Error de Inventario: ' + stockResult.message);
                return; // Stop sale
            }
        }

        const total = Number(amount);

        const result = await registerPayment({
            total,
            concepto: mode === 'quick' ? concept : undefined,
            metodo_pago: method,
            fecha_pago: new Date().toISOString(),
            colaborador_id: user.id,
            turno_id: currentShift?.id,
            usuario_id: mode === 'membership' ? selectedMemberId : undefined,
            plan_id: mode === 'membership' ? selectedPlanId : undefined
        });

        if (result.success) {
            if (result.message) {
                alert('ATENCIÓN: ' + result.message);
            } else {
                alert('Pago registrado correctamente');
            }

            setAmount('');
            setConcept('');
            setSelectedMemberId('');
            setSelectedPlanId('');
            setSelectedProductId('');
            loadInitialData();
        } else {
            alert('Error: ' + (result.message || 'No se pudo registrar el pago'));
        }
    };

    const handlePlanChange = (planId: string) => {
        setSelectedPlanId(planId);
        const plan = plans.find(p => p.id === planId);
        if (plan) {
            setAmount(plan.precio.toString());
        }
    };

    const columns: Column<Payment>[] = [
        { header: 'Fecha', accessor: (p) => new Date(p.fecha_pago).toLocaleDateString() + ' ' + new Date(p.fecha_pago).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
        {
            header: 'Concepto / Miembro',
            accessor: (p) => p.concepto ? p.concepto : (p.usuario_id ? 'Membresía' : 'Venta General')
        },
        {
            header: 'Monto',
            accessor: (p) => <span style={{ fontWeight: 'bold', color: 'var(--color-success)' }}>${p.total.toFixed(2)}</span>
        },
        {
            header: 'Método',
            accessor: (p) => (
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px', textTransform: 'capitalize' }}>
                    {p.metodo_pago === 'efectivo' ? <Banknote size={16} /> : <CreditCard size={16} />}
                    {p.metodo_pago}
                </span>
            )
        },
    ];

    return (
        <div className="page-container">
            <h2>Registro de Pagos</h2>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 'var(--spacing-xl)', marginTop: 'var(--spacing-lg)' }}>

                {/* New Payment Form */}
                <div style={{ backgroundColor: 'var(--color-card)', padding: 'var(--spacing-xl)', borderRadius: 'var(--radius-lg)', height: 'fit-content' }}>
                    <h3 style={{ marginBottom: 'var(--spacing-md)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <DollarSign size={20} color="var(--color-accent)" />
                        Nuevo Pago
                    </h3>

                    <div style={{ display: 'flex', gap: '10px', marginBottom: 'var(--spacing-md)' }}>
                        <button
                            type="button"
                            onClick={() => { setMode('membership'); setAmount(''); setSelectedProductId(''); }}
                            style={{
                                flex: 1, padding: '8px', borderRadius: '6px',
                                backgroundColor: mode === 'membership' ? 'var(--color-primary)' : 'var(--color-bg)',
                                color: mode === 'membership' ? 'white' : 'var(--color-text-secondary)',
                                border: '1px solid var(--color-border)'
                            }}
                        >
                            Membresía
                        </button>
                        <button
                            type="button"
                            onClick={() => { setMode('quick'); setAmount(''); }}
                            style={{
                                flex: 1, padding: '8px', borderRadius: '6px',
                                backgroundColor: mode === 'quick' ? 'var(--color-primary)' : 'var(--color-bg)',
                                color: mode === 'quick' ? 'white' : 'var(--color-text-secondary)',
                                border: '1px solid var(--color-border)'
                            }}
                        >
                            Venta General
                        </button>
                    </div>

                    <form onSubmit={handlePayment} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>

                        {mode === 'membership' && (
                            <>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '8px', fontSize: 'var(--font-size-sm)' }}>Usuario</label>
                                    <MemberSearch
                                        onSelect={(id) => setSelectedMemberId(id)}
                                    />
                                </div>

                                <div>
                                    <label style={{ display: 'block', marginBottom: '8px', fontSize: 'var(--font-size-sm)' }}>Plan</label>
                                    <select
                                        value={selectedPlanId}
                                        onChange={e => handlePlanChange(e.target.value)}
                                        required
                                        style={{
                                            width: '100%', padding: '10px',
                                            borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)',
                                            backgroundColor: 'var(--color-bg)', color: 'var(--color-text-primary)'
                                        }}
                                    >
                                        <option value="">Seleccione Plan...</option>
                                        {plans.filter(p => p.activo).map(p => (
                                            <option key={p.id} value={p.id}>{p.nombre} - ${p.precio} ({p.duracion_dias} días)</option>
                                        ))}
                                    </select>
                                </div>
                            </>
                        )}

                        {mode === 'quick' && (
                            <div>
                                <label style={{ display: 'block', marginBottom: '8px', fontSize: 'var(--font-size-sm)' }}>Concepto de Venta</label>

                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '15px', maxHeight: '200px', overflowY: 'auto' }}>
                                    {products.map(item => (
                                        <button
                                            key={item.id}
                                            type="button"
                                            onClick={() => {
                                                setConcept(item.name);
                                                setAmount(item.price.toString());
                                                setSelectedProductId(item.id);
                                            }}
                                            style={{
                                                backgroundColor: selectedProductId === item.id ? 'var(--color-primary)' : 'rgba(255,255,255,0.05)',
                                                border: '1px solid var(--color-border)',
                                                borderRadius: '8px',
                                                padding: '10px',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                alignItems: 'center',
                                                gap: '5px',
                                                transition: 'background 0.2s',
                                                color: 'white',
                                                opacity: item.stock <= 0 ? 0.5 : 1
                                            }}
                                            disabled={item.stock <= 0}
                                        >
                                            <span style={{ fontSize: '20px' }}>{item.emoji}</span>
                                            <span style={{ fontSize: '11px', textAlign: 'center', lineHeight: '1.2' }}>{item.name}</span>
                                            <span style={{ fontSize: '12px', color: 'var(--color-success)', fontWeight: 'bold' }}>${item.price}</span>
                                            {item.stock <= 0 && <span style={{ fontSize: '10px', color: 'red' }}>AGOTADO</span>}
                                        </button>
                                    ))}
                                    {products.length === 0 && <p style={{ gridColumn: '1/-1', fontSize: '12px', color: 'gray', textAlign: 'center' }}>No hay productos definidos.</p>}
                                </div>

                                <input
                                    type="text"
                                    value={concept}
                                    onChange={(e) => {
                                        setConcept(e.target.value);
                                        setSelectedProductId(''); // Clear selected product if typing manually
                                    }}
                                    placeholder="O escribe concepto manual..."
                                    required
                                    style={{
                                        width: '100%', padding: '10px',
                                        borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)',
                                        backgroundColor: 'var(--color-bg)', color: 'var(--color-text-primary)'
                                    }}
                                />
                            </div>
                        )}

                        <div>
                            <label style={{ display: 'block', marginBottom: '8px', fontSize: 'var(--font-size-sm)' }}>Monto Total</label>
                            <input
                                type="number"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                placeholder="0.00"
                                readOnly={mode === 'membership'}
                                style={{
                                    width: '100%', padding: '10px',
                                    borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)',
                                    backgroundColor: mode === 'membership' ? 'rgba(255,255,255,0.05)' : 'var(--color-bg)',
                                    color: 'var(--color-text-primary)',
                                    fontSize: 'var(--font-size-lg)',
                                    fontWeight: 'bold'
                                }}
                            />
                        </div>

                        <div>
                            <label style={{ display: 'block', marginBottom: '8px', fontSize: 'var(--font-size-sm)' }}>Método de Pago</label>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button
                                    type="button"
                                    onClick={() => setMethod('efectivo')}
                                    style={{
                                        flex: 1, padding: '10px', borderRadius: '6px',
                                        backgroundColor: method === 'efectivo' ? 'var(--color-success)' : 'var(--color-bg)',
                                        color: method === 'efectivo' ? 'black' : 'var(--color-text-secondary)',
                                        border: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
                                    }}
                                >
                                    <Banknote size={16} /> Efectivo
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setMethod('tarjeta')}
                                    style={{
                                        flex: 1, padding: '10px', borderRadius: '6px',
                                        backgroundColor: method === 'tarjeta' ? 'var(--color-info)' : 'var(--color-bg)',
                                        color: method === 'tarjeta' ? 'white' : 'var(--color-text-secondary)',
                                        border: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
                                    }}
                                >
                                    <CreditCard size={16} /> Tarjeta
                                </button>
                            </div>
                        </div>

                        <button type="submit" style={{ marginTop: 'var(--spacing-sm)', display: 'flex', justifyContent: 'center', gap: '8px', padding: '12px', fontSize: '16px' }}>
                            <PlusCircle size={20} /> Confirmar Pago
                        </button>
                    </form>
                </div>

                {/* History */}
                <div>
                    <h3 style={{ marginBottom: 'var(--spacing-lg)' }}>Historial Reciente</h3>
                    {loading ? <p>Cargando...</p> : (
                        <DataTable
                            columns={columns}
                            data={payments}
                            keyExtractor={(p) => p.id}
                        />
                    )}
                </div>

            </div>
        </div>
    );
}
