import { useState } from 'react';
import { createCollaborator } from '../../logic/api/authService';
import { Save, UserPlus, Lock } from 'lucide-react';

export default function Settings() {
    const [activeTab, setActiveTab] = useState<'general' | 'users'>('general');

    return (
        <div className="page-container">
            <h2 className="page-title">Configuración</h2>

            <div style={{ display: 'flex', gap: '20px', marginBottom: '30px', borderBottom: '1px solid var(--color-border)' }}>
                <button
                    onClick={() => setActiveTab('general')}
                    style={{
                        padding: '10px 20px',
                        background: 'none',
                        borderBottom: activeTab === 'general' ? '2px solid var(--color-accent)' : 'none',
                        color: activeTab === 'general' ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                        cursor: 'pointer'
                    }}
                >
                    General
                </button>
                <button
                    onClick={() => setActiveTab('users')}
                    style={{
                        padding: '10px 20px',
                        background: 'none',
                        borderBottom: activeTab === 'users' ? '2px solid var(--color-accent)' : 'none',
                        color: activeTab === 'users' ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                        cursor: 'pointer'
                    }}
                >
                    Usuarios y Colaboradores
                </button>
            </div>

            {activeTab === 'general' && <GeneralSettings />}
            {activeTab === 'users' && <UserManagement />}
        </div>
    );
}

function GeneralSettings() {
    return (
        <div className="card">
            <h3>Datos de la Empresa</h3>
            <p style={{ color: 'var(--color-text-secondary)', marginBottom: '20px' }}>
                Información visible en tickets y reportes.
            </p>
            <div className="form-group">
                <label>Nombre del Gimnasio</label>
                <input type="text" className="input-field" defaultValue="GIC Gym" />
            </div>
            <button className="primary-btn" style={{ marginTop: '20px' }}>
                <Save size={18} /> Guardar Cambios
            </button>
        </div>
    );
}

function UserManagement() {
    const [formData, setFormData] = useState({ nombre: '', email: '', password: '' });
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMessage(null);

        if (formData.password.length < 6) {
            setMessage({ type: 'error', text: 'La contraseña debe tener al menos 6 caracteres.' });
            setLoading(false);
            return;
        }

        const result = await createCollaborator(formData.email, formData.password, formData.nombre);

        if (result.success) {
            setMessage({ type: 'success', text: 'Colaborador creado exitosamente.' });
            setFormData({ nombre: '', email: '', password: '' });
        } else {
            setMessage({ type: 'error', text: result.error || 'Error al crear usuario.' });
        }
        setLoading(false);
    };

    return (
        <div className="card">
            <h3><UserPlus size={20} style={{ verticalAlign: 'middle', marginRight: '10px' }} /> Nuevo Colaborador</h3>
            <p style={{ color: 'var(--color-text-secondary)', marginBottom: '20px' }}>
                Registra un nuevo usuario con acceso al sistema (Rol: Colaborador).
            </p>

            {message && (
                <div style={{
                    padding: '10px',
                    borderRadius: '8px',
                    marginBottom: '15px',
                    backgroundColor: message.type === 'success' ? 'rgba(76, 175, 80, 0.1)' : 'rgba(244, 67, 54, 0.1)',
                    color: message.type === 'success' ? 'var(--color-success)' : 'var(--color-danger)',
                    border: `1px solid ${message.type === 'success' ? 'var(--color-success)' : 'var(--color-danger)'}`
                }}>
                    {message.text}
                </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '15px', maxWidth: '500px' }}>
                <div className="form-group">
                    <label>Nombre Completo</label>
                    <input
                        type="text"
                        required
                        className="input-field"
                        value={formData.nombre}
                        onChange={e => setFormData({ ...formData, nombre: e.target.value })}
                        placeholder="Ej. Juan Pérez"
                    />
                </div>
                <div className="form-group">
                    <label>Correo Electrónico</label>
                    <input
                        type="email"
                        required
                        className="input-field"
                        value={formData.email}
                        onChange={e => setFormData({ ...formData, email: e.target.value })}
                        placeholder="colaborador@gym.com"
                    />
                </div>
                <div className="form-group">
                    <label>Contraseña</label>
                    <div style={{ position: 'relative' }}>
                        <input
                            type="text" // Visible for admin creation ease, or password if preferred. Let's use text for easier setup logic.
                            required
                            className="input-field"
                            value={formData.password}
                            onChange={e => setFormData({ ...formData, password: e.target.value })}
                            placeholder="Mínimo 6 caracteres"
                        />
                        <Lock size={16} style={{ position: 'absolute', right: '10px', top: '12px', color: 'gray' }} />
                    </div>
                    <small style={{ color: 'var(--color-text-secondary)' }}>
                        El colaborador usará estas credenciales para ingresar.
                    </small>
                </div>

                <div style={{ marginTop: '10px' }}>
                    <button type="submit" className="primary-btn" disabled={loading}>
                        {loading ? 'Creando...' : 'Crear Usuario'}
                    </button>
                </div>
            </form>
        </div>
    );
}
