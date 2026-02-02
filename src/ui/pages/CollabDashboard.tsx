import { useNavigate } from 'react-router-dom';
import { useShift } from '../../logic/shiftContext';
import { useAuth } from '../../logic/authContext';
import { Play, Users, DollarSign, ListChecks } from 'lucide-react';

export function CollabDashboard() {
    const { currentShift } = useShift();
    const { user } = useAuth();
    const navigate = useNavigate();

    const handleOpenShiftConfig = () => {
        // Here we could open a modal, or redirect to /shifts where the open logic is
        navigate('/shifts');
    };

    return (
        <div className="dashboard-page">
            <div style={{ marginBottom: '30px' }}>
                <h2 style={{ fontSize: '28px' }}>Hola, <span style={{ color: 'var(--color-accent)' }}>{user?.nombre}</span></h2>
                <p style={{ color: 'var(--color-text-secondary)' }}>Panel de Colaborador</p>
            </div>

            {!currentShift ? (
                <div style={{
                    backgroundColor: 'var(--color-card)',
                    padding: '40px',
                    borderRadius: '16px',
                    textAlign: 'center',
                    border: '1px solid var(--color-danger)'
                }}>
                    <div style={{ marginBottom: '20px', fontSize: '64px' }}>🛑</div>
                    <h3 style={{ marginBottom: '10px' }}>Turno Cerrado</h3>
                    <p style={{ color: 'var(--color-text-secondary)', marginBottom: '30px' }}>
                        Para comenzar a operar (Check-in, Cobros, etc.) debes abrir tu turno.
                    </p>
                    <button
                        onClick={handleOpenShiftConfig}
                        className="primary-btn"
                        style={{ padding: '15px 40px', fontSize: '18px', display: 'inline-flex', alignItems: 'center', gap: '10px' }}
                    >
                        <Play size={24} fill="currentColor" /> Abrir Caja y Turno
                    </button>
                </div>
            ) : (
                <div>
                    <div style={{
                        backgroundColor: 'var(--color-card)',
                        padding: '20px',
                        borderRadius: '12px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '30px',
                        borderLeft: '5px solid var(--color-success)'
                    }}>
                        <div>
                            <h4 style={{ margin: 0, color: 'var(--color-text-secondary)' }}>Turno Activo</h4>
                            <div style={{ fontSize: '20px', fontWeight: 'bold', marginTop: '5px' }}>
                                Inicio: {new Date(currentShift.hora_inicio).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <button onClick={() => navigate('/shifts')} style={{ background: 'rgba(255,255,255,0.1)', padding: '8px 15px', borderRadius: '20px', fontSize: '14px' }}>
                                Gestionar Caja
                            </button>
                        </div>
                    </div>

                    <h3 style={{ marginBottom: '20px' }}>Accesos Rápidos</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>

                        <div onClick={() => navigate('/attendance')} style={{
                            background: 'var(--color-card)', padding: '25px', borderRadius: '12px', cursor: 'pointer',
                            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', transition: 'transform 0.2s'
                        }} className="action-card">
                            <ListChecks size={40} color="var(--color-accent)" />
                            <span style={{ fontWeight: 'bold' }}>Check-in Asistencia</span>
                        </div>

                        <div onClick={() => navigate('/payments')} style={{
                            background: 'var(--color-card)', padding: '25px', borderRadius: '12px', cursor: 'pointer',
                            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px'
                        }} className="action-card">
                            <DollarSign size={40} color="var(--color-success)" />
                            <span style={{ fontWeight: 'bold' }}>Registrar Pago</span>
                        </div>

                        <div onClick={() => navigate('/members')} style={{
                            background: 'var(--color-card)', padding: '25px', borderRadius: '12px', cursor: 'pointer',
                            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px'
                        }} className="action-card">
                            <Users size={40} color="var(--color-warning)" />
                            <span style={{ fontWeight: 'bold' }}>Nuevo Miembro</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
