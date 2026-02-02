import { useState, useMemo } from 'react';
import type { Member } from '../../domain/types';
import { X, Save, User, Phone, Calendar, Image as ImageIcon } from 'lucide-react';

interface MemberFormData {
    nombre: string;
    apellido: string;
    telefono: string;
    fecha_nacimiento: string;
    foto_url: string;
    fecha_vencimiento: string;
}

interface MemberFormProps {
    initialData?: Partial<Member> & { fecha_vencimiento?: string };
    onSubmit: (data: MemberFormData) => Promise<boolean>;
    onCancel: () => void;
    title: string;
}

export function MemberForm({ initialData, onSubmit, onCancel, title }: MemberFormProps) {
    const [loading, setLoading] = useState(false);

    // Memoizado para evitar recálculos innecesarios
    const initialFormData = useMemo((): MemberFormData => ({
        nombre: initialData?.nombre || '',
        apellido: initialData?.apellido || '',
        telefono: initialData?.telefono || '',
        fecha_nacimiento: initialData?.fecha_nacimiento ? new Date(initialData.fecha_nacimiento).toISOString().split('T')[0] : '',
        foto_url: initialData?.foto_url || '',
        fecha_vencimiento: initialData?.fecha_vencimiento ? new Date(initialData.fecha_vencimiento).toISOString().split('T')[0] : ''
    }), [initialData]);

    const [formData, setFormData] = useState<MemberFormData>(initialFormData);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        const success = await onSubmit(formData);
        if (!success) setLoading(false);
    };

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
            <div style={{
                backgroundColor: 'var(--color-card)',
                padding: 'var(--spacing-xl)',
                borderRadius: 'var(--radius-lg)',
                width: '100%', maxWidth: '500px',
                border: '1px solid var(--color-border)',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-lg)' }}>
                    <h2 style={{ margin: 0 }}>{title}</h2>
                    <button onClick={onCancel} style={{ background: 'transparent', border: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer' }}>
                        <X size={24} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: '8px', fontSize: 'var(--font-size-sm)' }}>Nombre</label>
                            <div style={{ position: 'relative' }}>
                                <User size={16} style={{ position: 'absolute', left: '10px', top: '12px', color: 'gray' }} />
                                <input
                                    type="text"
                                    required
                                    value={formData.nombre}
                                    onChange={e => setFormData({ ...formData, nombre: e.target.value })}
                                    style={{ width: '100%', padding: '10px 10px 10px 35px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'white' }}
                                />
                            </div>
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '8px', fontSize: 'var(--font-size-sm)' }}>Apellido</label>
                            <input
                                type="text"
                                required
                                value={formData.apellido}
                                onChange={e => setFormData({ ...formData, apellido: e.target.value })}
                                style={{ width: '100%', padding: '10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'white' }}
                            />
                        </div>
                    </div>

                    <div>
                        <label style={{ display: 'block', marginBottom: '8px', fontSize: 'var(--font-size-sm)' }}>Teléfono</label>
                        <div style={{ position: 'relative' }}>
                            <Phone size={16} style={{ position: 'absolute', left: '10px', top: '12px', color: 'gray' }} />
                            <input
                                type="tel"
                                value={formData.telefono}
                                onChange={e => setFormData({ ...formData, telefono: e.target.value })}
                                placeholder="55 1234 5678"
                                style={{ width: '100%', padding: '10px 10px 10px 35px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'white' }}
                            />
                        </div>
                    </div>

                    <div>
                        <label style={{ display: 'block', marginBottom: '8px', fontSize: 'var(--font-size-sm)' }}>Fecha Nacimiento</label>
                        <div style={{ position: 'relative' }}>
                            <Calendar size={16} style={{ position: 'absolute', left: '10px', top: '12px', color: 'gray' }} />
                            <input
                                type="date"
                                value={formData.fecha_nacimiento}
                                onChange={e => setFormData({ ...formData, fecha_nacimiento: e.target.value })}
                                style={{ width: '100%', padding: '10px 10px 10px 35px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'white' }}
                            />
                        </div>
                    </div>

                    <div>
                        <label style={{ display: 'block', marginBottom: '8px', fontSize: 'var(--font-size-sm)' }}>Foto URL (Opcional)</label>
                        <div style={{ position: 'relative' }}>
                            <ImageIcon size={16} style={{ position: 'absolute', left: '10px', top: '12px', color: 'gray' }} />
                            <input
                                type="url"
                                value={formData.foto_url}
                                onChange={e => setFormData({ ...formData, foto_url: e.target.value })}
                                placeholder="https://..."
                                style={{ width: '100%', padding: '10px 10px 10px 35px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'white' }}
                            />
                        </div>
                    </div>
                    <div style={{ padding: '10px', backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 'var(--radius-md)', border: '1px dashed var(--color-border)' }}>
                        <label style={{ display: 'block', marginBottom: '8px', fontSize: 'var(--font-size-sm)', color: 'var(--color-warning)' }}>Vencimiento Membresía (Manual)</label>
                        <div style={{ position: 'relative' }}>
                            <Calendar size={16} style={{ position: 'absolute', left: '10px', top: '12px', color: 'gray' }} />
                            <input
                                type="date"
                                value={formData.fecha_vencimiento}
                                onChange={e => setFormData({ ...formData, fecha_vencimiento: e.target.value })}
                                style={{ width: '100%', padding: '10px 10px 10px 35px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'white' }}
                            />
                        </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: 'var(--spacing-md)' }}>
                        <button type="button" onClick={onCancel} style={{ padding: '10px 20px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'transparent', color: 'white', cursor: 'pointer' }}>
                            Cancelar
                        </button>
                        <button type="submit" disabled={loading} style={{ padding: '10px 20px', borderRadius: '6px', border: 'none', background: 'var(--color-primary)', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {loading ? 'Guardando...' : <><Save size={18} /> Guardar</>}
                        </button>
                    </div>

                </form>
            </div>
        </div>
    );
}
