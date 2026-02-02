import { useState, useEffect, useCallback } from 'react';
import { getPlans, createPlan, togglePlanStatus, updatePlan, deletePlan, type Plan } from '../../logic/api/planService';
import { Plus, X, Clock, DollarSign } from 'lucide-react';

export default function Plans() {
    const [plans, setPlans] = useState<Plan[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);

    // Edit State
    const [editingId, setEditingId] = useState<string | null>(null);

    // Form inputs
    const [nombre, setNombre] = useState('');
    const [precio, setPrecio] = useState('');
    const [dias, setDias] = useState('');

    const loadPlans = useCallback(async () => {
        setLoading(true);
        const data = await getPlans();
        setPlans(data);
        setLoading(false);
    }, []);

    useEffect(() => {
        loadPlans();
    }, [loadPlans]);

    const handleEdit = (plan: Plan) => {
        setEditingId(plan.id);
        setNombre(plan.nombre);
        setPrecio(plan.precio.toString());
        setDias(plan.duracion_dias.toString());
        setShowForm(true);
    };

    const handleCancel = () => {
        setEditingId(null);
        setNombre(''); setPrecio(''); setDias('');
        setShowForm(false);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!nombre || !precio || !dias) return;

        setLoading(true);
        let success = false;

        if (editingId) {
            success = await updatePlan(editingId, {
                nombre,
                precio: Number(precio),
                duracion_dias: Number(dias)
            });
        } else {
            success = await createPlan({
                nombre,
                precio: Number(precio),
                duracion_dias: Number(dias)
            });
        }

        if (success) {
            handleCancel();
            loadPlans();
        } else {
            alert('Error al guardar el plan');
            setLoading(false);
        }
    };

    const handleToggle = async (plan: Plan) => {
        const success = await togglePlanStatus(plan.id, plan.activo);
        if (success) loadPlans();
    };

    const handleDelete = async (plan: Plan) => {
        if (confirm(`¿Estás seguro de ELIMINAR el plan "${plan.nombre}"? Esto podría fallar si hay suscripciones activas usándolo.`)) {
            const { success, error } = await deletePlan(plan.id);
            if (success) {
                loadPlans();
            } else {
                alert('No se puede eliminar: ' + (error?.details || 'Probablemente tiene suscripciones asociadas. Desactívalo en su lugar.'));
            }
        }
    };

    return (
        <div className="page-container">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-lg)' }}>
                <h2>Gestión de Planes y Membresías</h2>
                <button onClick={() => { if (showForm) handleCancel(); else setShowForm(true); }} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {showForm ? <X size={18} /> : <Plus size={18} />}
                    {showForm ? 'Cancelar' : 'Nuevo Plan'}
                </button>
            </div>

            {showForm && (
                <div style={{
                    backgroundColor: 'var(--color-card)', padding: 'var(--spacing-lg)', borderRadius: 'var(--radius-lg)',
                    marginBottom: 'var(--spacing-lg)', border: '1px solid var(--color-accent)'
                }}>
                    <h3 style={{ marginBottom: 'var(--spacing-md)' }}>{editingId ? 'Editar Plan' : 'Crear Nuevo Plan'}</h3>
                    <form onSubmit={handleSave} style={{ display: 'grid', gap: 'var(--spacing-md)', gridTemplateColumns: '1fr 1fr 1fr auto' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px' }}>Nombre</label>
                            <input
                                value={nombre} onChange={e => setNombre(e.target.value)}
                                placeholder="Ej. Anualidad" required
                                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'white' }}
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px' }}>Precio ($)</label>
                            <input
                                type="number" value={precio} onChange={e => setPrecio(e.target.value)}
                                placeholder="0.00" required
                                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'white' }}
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px' }}>Duración (Días)</label>
                            <input
                                type="number" value={dias} onChange={e => setDias(e.target.value)}
                                placeholder="30" required
                                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'white' }}
                            />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'end' }}>
                            <button type="submit" disabled={loading} style={{ height: '38px' }}>
                                {editingId ? 'Actualizar' : 'Guardar'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {loading && !showForm ? (
                <div>Cargando planes...</div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--spacing-lg)' }}>
                    {plans.map(plan => (
                        <div key={plan.id} style={{
                            backgroundColor: 'var(--color-card)',
                            padding: 'var(--spacing-lg)',
                            borderRadius: 'var(--radius-lg)',
                            position: 'relative',
                            opacity: plan.activo ? 1 : 0.6,
                            border: plan.activo ? '1px solid transparent' : '1px dashed var(--color-border)'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 'var(--spacing-md)' }}>
                                <h3 style={{ margin: 0 }}>{plan.nombre}</h3>
                                <span style={{
                                    fontSize: '11px', padding: '2px 6px', borderRadius: '4px',
                                    backgroundColor: plan.activo ? 'var(--color-success)' : 'var(--color-text-secondary)',
                                    color: 'white'
                                }}>
                                    {plan.activo ? 'ACTIVO' : 'INACTIVO'}
                                </span>
                            </div>

                            <div style={{ display: 'flex', gap: '20px', marginBottom: 'var(--spacing-lg)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-text-secondary)' }}>
                                    <Clock size={16} />
                                    <span>{plan.duracion_dias} días</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '18px', fontWeight: 'bold', color: 'var(--color-accent)' }}>
                                    <DollarSign size={16} />
                                    <span>${plan.precio}</span>
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                {/* Edit Button */}
                                <button
                                    onClick={() => handleEdit(plan)}
                                    style={{
                                        backgroundColor: 'var(--color-bg)', color: 'white',
                                        border: '1px solid var(--color-border)', padding: '6px', fontSize: '13px'
                                    }}
                                >
                                    Editar
                                </button>

                                {/* Toggle (Enable/Disable) */}
                                <button
                                    onClick={() => handleToggle(plan)}
                                    style={{
                                        backgroundColor: plan.activo ? 'rgba(255, 77, 77, 0.1)' : 'rgba(0, 204, 102, 0.1)',
                                        color: plan.activo ? 'var(--color-danger)' : 'var(--color-success)',
                                        border: 'none', padding: '6px', fontSize: '13px'
                                    }}
                                >
                                    {plan.activo ? 'Desactivar' : 'Activar'}
                                </button>
                            </div>

                            {/* Hard Delete Button (Small) */}
                            <div style={{ marginTop: '10px', textAlign: 'right' }}>
                                <button
                                    onClick={() => handleDelete(plan)}
                                    style={{
                                        background: 'transparent', border: 'none', color: '#666',
                                        fontSize: '11px', textDecoration: 'underline', cursor: 'pointer'
                                    }}
                                >
                                    Eliminar permanentemente
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
