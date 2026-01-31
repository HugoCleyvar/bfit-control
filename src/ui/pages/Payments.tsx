import { useState, useEffect } from 'react';
import { getPayments, registerPayment } from '../../logic/api/financeService';
import { getMembers, type MemberWithStatus } from '../../logic/api/memberService';
import { getPlans, type Plan } from '../../logic/api/planService';
import { useAuth } from '../../logic/authContext';
import type { Payment } from '../../domain/types';
import { DataTable } from '../components/DataTable';
import type { Column } from '../components/DataTable';
import { MemberSearch } from '../components/MemberSearch';
import { CreditCard, Banknote, DollarSign, PlusCircle } from 'lucide-react';

export default function PaymentsPage() {
    const [payments, setPayments] = useState<Payment[]>([]);
    const [loading, setLoading] = useState(true);

    // Data needed for form
    const [members, setMembers] = useState<MemberWithStatus[]>([]);
    const [plans, setPlans] = useState<Plan[]>([]);

    // Form State
    const [mode, setMode] = useState<'quick' | 'membership'>('membership'); // Default to membership as requested
    const [amount, setAmount] = useState('');
    const [method, setMethod] = useState<'efectivo' | 'tarjeta'>('efectivo');

    // Membership specific
    const [selectedMemberId, setSelectedMemberId] = useState('');
    const [selectedPlanId, setSelectedPlanId] = useState('');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        const [pData, mData, plData] = await Promise.all([
            getPayments(),
            getMembers(),
            getPlans()
        ]);
        setPayments(pData);
        setMembers(mData);
        setPlans(plData);
        setLoading(false);
    };

    const { user } = useAuth(); // Get current user (colaborador)

    const handlePayment = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validation
        if (!user) return;
        if (mode === 'quick' && !amount) return;
        if (mode === 'membership' && (!selectedMemberId || !selectedPlanId)) return;

        const total = Number(amount);

        const success = await registerPayment({
            total,
            metodo_pago: method,
            fecha_pago: new Date().toISOString(),
            colaborador_id: user.id,
            usuario_id: mode === 'membership' ? selectedMemberId : undefined,
            plan_id: mode === 'membership' ? selectedPlanId : undefined
        });

        if (success) {
            alert('Pago registrado correctamente');
            setAmount('');
            setSelectedMemberId('');
            setSelectedPlanId('');
            loadData();
        } else {
            alert('Error al registrar pago');
        }
    };

    // Auto-set price when plan changes
    const handlePlanChange = (planId: string) => {
        setSelectedPlanId(planId);
        const plan = plans.find(p => p.id === planId);
        if (plan) {
            setAmount(plan.precio.toString());
        }
    };

    const columns: Column<Payment>[] = [
        { header: 'Fecha', accessor: (p) => new Date(p.fecha_pago).toLocaleDateString() + ' ' + new Date(p.fecha_pago).toLocaleTimeString() },
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
        { header: 'Usuario', accessor: () => 'Miembro (Mock)' }, // Simplified for MVP
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
                            onClick={() => setMode('membership')}
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
                            onClick={() => setMode('quick')}
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
                                        members={members}
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

                        <div>
                            <label style={{ display: 'block', marginBottom: '8px', fontSize: 'var(--font-size-sm)' }}>Monto Total</label>
                            <input
                                type="number"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                placeholder="0.00"
                                readOnly={mode === 'membership'} // Auto-filled by plan
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
