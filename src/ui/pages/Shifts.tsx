import { useState, useEffect } from 'react';
import { getCurrentShift, closeShift, openShift } from '../../logic/api/financeService';
import { useAuth } from '../../logic/authContext';
import type { Shift } from '../../logic/api/financeService';
import { Lock, CheckCircle, AlertTriangle } from 'lucide-react';

export default function ShiftsPage() {
    const { user } = useAuth();
    const [currentShift, setCurrentShift] = useState<Shift | null>(null);
    const [loading, setLoading] = useState(true);

    const [declaredCash, setDeclaredCash] = useState('');
    const [initialCash, setInitialCash] = useState('0');
    const [corteResult, setCorteResult] = useState<{ success: boolean; difference: number } | null>(null);

    useEffect(() => {
        loadShift();
    }, []);

    const loadShift = async () => {
        setLoading(true);
        const shift = await getCurrentShift();
        setCurrentShift(shift);
        setLoading(false);
    };

    const handleCloseShift = async () => {
        if (!currentShift || !declaredCash) return;

        // Simulate close
        const result = await closeShift(currentShift.id, Number(declaredCash));
        setCorteResult(result);
    };

    const handleOpenShift = async () => {
        if (!user) return;
        setLoading(true);
        const success = await openShift(user.id, Number(initialCash));
        if (success) {
            await loadShift();
        } else {
            alert('Error al abrir turno');
            setLoading(false);
        }
    };

    if (loading) return <div className="page-container">Cargando...</div>;

    return (
        <div className="page-container">
            <h2>Turnos y Caja</h2>

            <div style={{ marginTop: 'var(--spacing-lg)' }}>
                {!currentShift ? (
                    <div style={{
                        padding: 'var(--spacing-xl)',
                        backgroundColor: 'var(--color-card)',
                        borderRadius: 'var(--radius-lg)',
                        textAlign: 'center'
                    }}>
                        <Lock size={48} color="var(--color-text-secondary)" style={{ marginBottom: 'var(--spacing-md)' }} />
                        <h3>No hay turno abierto</h3>
                        <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-lg)' }}>
                            Debes iniciar un turno para registrar cobros y acceder al sistema.
                        </p>

                        <div style={{ maxWidth: '300px', margin: '0 auto 20px auto', textAlign: 'left' }}>
                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>Fondo Inicial en Caja</label>
                            <input
                                type="number"
                                value={initialCash}
                                onChange={(e) => setInitialCash(e.target.value)}
                                style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'white' }}
                            />
                        </div>

                        <button onClick={handleOpenShift}>Abrir Nuevo Turno</button>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gap: 'var(--spacing-lg)' }}>
                        {/* Active Shift Card */}
                        <div style={{
                            backgroundColor: 'var(--color-card)',
                            padding: 'var(--spacing-lg)',
                            borderRadius: 'var(--radius-lg)',
                            borderLeft: '4px solid var(--color-accent)'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <h3 style={{ marginBottom: 'var(--spacing-xs)' }}>Turno Activo: {currentShift.horario.toUpperCase()}</h3>
                                    <p style={{ color: 'var(--color-text-secondary)' }}>
                                        Iniciado por: <strong>{currentShift.colaborador_nombre}</strong> a las {new Date(currentShift.hora_inicio).toLocaleTimeString()}
                                    </p>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>Total Efectivo en Sistema</div>
                                    <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'bold' }}>${currentShift.total_efectivo.toFixed(2)}</div>
                                </div>
                            </div>
                        </div>

                        {/* Action: Close Shift */}
                        {!corteResult ? (
                            <div style={{
                                backgroundColor: 'var(--color-card)',
                                padding: 'var(--spacing-lg)',
                                borderRadius: 'var(--radius-lg)'
                            }}>
                                <h3>Cierre de Turno</h3>
                                <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-md)' }}>
                                    Ingresa el efectivo real en caja para validar el corte.
                                </p>

                                <div style={{ display: 'flex', gap: 'var(--spacing-md)', alignItems: 'flex-end' }}>
                                    <div style={{ flex: 1 }}>
                                        <label style={{ display: 'block', marginBottom: '8px' }}>Efectivo Declarado</label>
                                        <input
                                            type="number"
                                            value={declaredCash}
                                            onChange={(e) => setDeclaredCash(e.target.value)}
                                            placeholder="0.00"
                                            style={{
                                                width: '100%', padding: '10px',
                                                backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)',
                                                color: 'var(--color-text-primary)'
                                            }}
                                        />
                                    </div>
                                    <button onClick={handleCloseShift} style={{ backgroundColor: 'var(--color-danger)' }}>
                                        Realizar Corte
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div style={{
                                backgroundColor: 'var(--color-card)',
                                padding: 'var(--spacing-lg)',
                                borderRadius: 'var(--radius-lg)',
                                border: `1px solid ${corteResult.difference === 0 ? 'var(--color-success)' : 'var(--color-warning)'}`
                            }}>
                                <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    {corteResult.difference === 0 ? <CheckCircle color="var(--color-success)" /> : <AlertTriangle color="var(--color-warning)" />}
                                    Resultado del Corte
                                </h3>

                                <div style={{ marginTop: 'var(--spacing-md)', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--spacing-md)' }}>
                                    <div>
                                        <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>Sistema</div>
                                        <div style={{ fontSize: '18px' }}>${currentShift.total_efectivo.toFixed(2)}</div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>Declarado</div>
                                        <div style={{ fontSize: '18px' }}>${Number(declaredCash).toFixed(2)}</div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>Diferencia</div>
                                        <div style={{
                                            fontSize: '18px',
                                            fontWeight: 'bold',
                                            color: corteResult.difference === 0 ? 'var(--color-success)' : 'var(--color-warning)'
                                        }}>
                                            {corteResult.difference > 0 ? '+' : ''}{corteResult.difference.toFixed(2)}
                                        </div>
                                    </div>
                                </div>

                                <p style={{ marginTop: 'var(--spacing-md)', fontSize: '14px' }}>
                                    {corteResult.difference === 0
                                        ? 'Corte perfecto. Turno cerrado exitosamente.'
                                        : 'El corte presenta diferencias. Se ha registrado la incidencia.'}
                                </p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
