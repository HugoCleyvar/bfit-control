import { useEffect, useState, useCallback } from 'react';
import { getMembers, deleteMember, createMember, updateMember, updateSubscriptionExpiration } from '../../logic/api/memberService';
import { supabase } from '../../logic/api/supabase';
import { useAuth } from '../../logic/authContext';
import type { MemberWithStatus } from '../../logic/api/memberService';
import { DataTable } from '../components/DataTable';
import type { Column } from '../components/DataTable';
import { Edit, UserPlus, Trash2, X, Phone, Calendar } from 'lucide-react';
import { MemberSearch } from '../components/MemberSearch';
import { MemberForm } from '../components/MemberForm';
import { getMemberStats } from '../../logic/api/gamificationService';
import { MessageCircle, Trophy, Flame } from 'lucide-react';

interface MemberFormData {
    nombre: string;
    apellido: string;
    telefono: string;
    fecha_nacimiento?: string;
    foto_url: string;
    fecha_vencimiento?: string;
}

function Scorecard({ userId }: { userId: string }) {
    const [stats, setStats] = useState({ totalVisits: 0, thisMonth: 0, streak: 0 });

    useEffect(() => {
        getMemberStats(userId).then(setStats);
    }, [userId]);

    return (
        <>
            <div style={{
                padding: '8px 14px', borderRadius: '8px',
                backgroundColor: 'rgba(255,165,0, 0.1)', color: 'orange',
                display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid rgba(255,165,0, 0.3)'
            }}>
                <Flame size={18} />
                <span>Racha: <b>{stats.streak}</b> sem</span>
            </div>

            <div style={{
                padding: '8px 14px', borderRadius: '8px',
                backgroundColor: 'rgba(50, 205, 50, 0.1)', color: 'var(--color-success)',
                display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid rgba(50, 205, 50, 0.3)'
            }}>
                <Trophy size={18} />
                <span>Nivel: <b>{stats.totalVisits > 50 ? 'Elite' : stats.totalVisits > 20 ? 'Pro' : 'Novato'}</b> ({stats.totalVisits} visitas)</span>
            </div>
        </>
    );
}

export default function Members() {
    const [members, setMembers] = useState<MemberWithStatus[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedMemberId, setSelectedMemberId] = useState('');

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingMember, setEditingMember] = useState<MemberWithStatus | undefined>(undefined);

    const selectedMember = members.find(m => m.id === selectedMemberId);
    const displayedMembers = selectedMember ? [selectedMember] : members;

    const loadMembers = useCallback(async () => {
        setLoading(true);
        const data = await getMembers();
        setMembers(data);
        setLoading(false);
    }, []);

    useEffect(() => {
        loadMembers();
    }, [loadMembers]);

    const columns: Column<MemberWithStatus>[] = [
        {
            header: 'Miembro',
            accessor: (member) => (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                        width: '32px', height: '32px', borderRadius: '50%',
                        backgroundColor: 'var(--color-card)', border: '1px solid var(--color-border)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '12px', fontWeight: 'bold', overflow: 'hidden'
                    }}>
                        {member.foto_url ? (
                            <img src={member.foto_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                            <span>{member.nombre.charAt(0)}{member.apellido.charAt(0)}</span>
                        )}
                    </div>
                    <div>
                        <div style={{ fontWeight: 500 }}>{member.nombre} {member.apellido}</div>
                        <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>{member.telefono || 'Sin teléfono'}</div>
                    </div>
                </div>
            )
        },
        {
            header: 'Estatus',
            accessor: (member) => {
                let color = 'var(--color-text-secondary)';
                let bg = 'rgba(255, 255, 255, 0.1)';
                const label = member.estatus;

                if (member.estatus === 'activo') {
                    color = 'var(--color-success)';
                    bg = 'rgba(0, 204, 102, 0.15)';
                } else {
                    color = 'var(--color-text-secondary)';
                }

                return (
                    <span style={{
                        backgroundColor: bg, color,
                        padding: '4px 8px', borderRadius: '12px',
                        fontSize: '11px', textTransform: 'capitalize'
                    }}>
                        {label}
                    </span>
                );
            }
        },
        {
            header: 'Suscripción',
            accessor: (member) => {
                const map = {
                    'activa': { color: 'var(--color-success)', label: 'Activa' },
                    'vencida': { color: 'var(--color-danger)', label: 'Vencida' },
                    'cancelada': { color: 'var(--color-text-secondary)', label: 'Cancelada' },
                    'sin_suscripcion': { color: 'var(--color-warning)', label: 'Sin Plan' }
                };

                const status = map[member.subscriptionStatus];

                return (
                    <div>
                        <div style={{ color: status.color, fontWeight: 500 }}>{status.label}</div>
                        {member.daysRemaining > 0 && (
                            <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                                Vence en {member.daysRemaining} días
                            </div>
                        )}
                        {member.daysRemaining < 0 && (
                            <div style={{ fontSize: '11px', color: 'var(--color-danger)' }}>
                                Venció hace {Math.abs(member.daysRemaining)} días
                            </div>
                        )}
                    </div>
                );
            }
        },
        { header: 'Registro', accessor: 'fecha_registro' },
    ];




    const handleDelete = async (id: string) => {
        if (window.confirm('¿Estás seguro de eliminar este miembro? Esta acción no se puede deshacer.')) {
            setLoading(true);
            const success = await deleteMember(id);
            if (success) {
                await loadMembers();
                setSelectedMemberId(''); // Clear selection if deleted
            } else {
                alert('Error al eliminar miembro');
                setLoading(false);
            }
        }
    };

    const { user } = useAuth(); // for collaborator_id

    const handleCreate = async (data: MemberFormData) => {
        const { fecha_vencimiento, ...memberData } = data;

        // Clean empty dates to avoid Supabase errors (Postgres date invalid input syntax)
        if (memberData.fecha_nacimiento === '') memberData.fecha_nacimiento = undefined;

        const result = await createMember(memberData, user?.id);
        if (result) {
            // If expiration date provided for new member, set it
            if (fecha_vencimiento) {
                await updateSubscriptionExpiration(result.id, fecha_vencimiento);
            }

            await loadMembers();
            setIsModalOpen(false);
            return true;
        }
        return false;
    };


    const handleUpdate = async (data: MemberFormData) => {
        if (!editingMember) return false;

        // 1. Update Profile
        const { fecha_vencimiento: _fecha_vencimiento, ...memberData } = data;

        // Clean empty dates
        if (memberData.fecha_nacimiento === '') memberData.fecha_nacimiento = undefined;

        const memberResult = await updateMember(editingMember.id, memberData);

        // 2. Update Subscription Expiration if provided (and different)
        if (data.fecha_vencimiento) {
            await updateSubscriptionExpiration(editingMember.id, data.fecha_vencimiento);
        }

        if (memberResult) {
            await loadMembers();
            setIsModalOpen(false);
            setEditingMember(undefined);
            return true;
        }
        return false;
    };

    const openCreateModal = () => {
        setEditingMember(undefined);
        setIsModalOpen(true);
    };

    const openEditModal = async (member: MemberWithStatus) => {
        // Fetch current active expiration date to pre-fill
        const { data } = await supabase
            .from('subscriptions')
            .select('fecha_vencimiento')
            .eq('usuario_id', member.id)
            .eq('estatus', 'activa')
            .maybeSingle();

        const fullMember = {
            ...member,
            fecha_vencimiento: data?.fecha_vencimiento || ''
        };

        setEditingMember(fullMember);
        setIsModalOpen(true);
    };

    return (
        <div className="page-container">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-lg)' }}>
                <h2>Gestión de Usuarios</h2>
                <div style={{ width: '300px' }}>
                    <MemberSearch
                        placeholder="Buscar miembro..."
                        onSelect={(id, member) => {
                            setSelectedMemberId(id);
                            // If member is not in current list (pagination), add it temporarily so it can be displayed
                            if (member && !members.find(m => m.id === id)) {
                                setMembers(prev => [member, ...prev]);
                            }
                        }}
                    />
                </div>
                <button
                    onClick={openCreateModal}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                    <UserPlus size={18} /> Nuevo Miembro
                </button>
            </div>

            {selectedMember && (
                <div style={{
                    backgroundColor: 'var(--color-card)',
                    padding: 'var(--spacing-lg)',
                    borderRadius: 'var(--radius-lg)',
                    marginBottom: 'var(--spacing-lg)',
                    border: '1px solid var(--color-primary)',
                    position: 'relative',
                    animation: 'fadeIn 0.3s ease'
                }}>
                    <button
                        onClick={() => setSelectedMemberId('')}
                        style={{ position: 'absolute', top: '10px', right: '10px', background: 'transparent', border: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer' }}
                    >
                        <X size={20} />
                    </button>

                    <div style={{ display: 'flex', gap: 'var(--spacing-xl)', alignItems: 'center' }}>
                        <div style={{
                            width: '100px', height: '100px', borderRadius: '50%',
                            backgroundColor: 'var(--color-bg)', border: '2px solid var(--color-primary)',
                            overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                            {selectedMember.foto_url ? (
                                <img src={selectedMember.foto_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                                <span style={{ fontSize: '32px', fontWeight: 'bold' }}>{selectedMember.nombre[0]}</span>
                            )}
                        </div>

                        <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <h2 style={{ margin: 0, marginBottom: '8px' }}>{selectedMember.nombre} {selectedMember.apellido}</h2>
                                {selectedMember.telefono && (
                                    <a
                                        href={`https://wa.me/${selectedMember.telefono.replace(/\D/g, '')}?text=Hola ${selectedMember.nombre}, te contactamos de BFIT Gym...`}
                                        target="_blank"
                                        rel="noreferrer"
                                        style={{
                                            backgroundColor: '#25D366', color: 'white', padding: '8px 16px', borderRadius: '20px',
                                            textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', fontWeight: 'bold'
                                        }}
                                    >
                                        <MessageCircle size={16} /> WhatsApp
                                    </a>
                                )}
                            </div>

                            <div style={{ display: 'flex', gap: '20px', color: 'var(--color-text-secondary)', fontSize: '14px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Phone size={16} /> {selectedMember.telefono || 'Sin teléfono'}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Calendar size={16} /> Registro: {new Date(selectedMember.fecha_registro).toLocaleDateString()}
                                </div>
                            </div>

                            {/* Member Scorecard */}
                            <div style={{ marginTop: '16px', display: 'flex', gap: '15px' }}>
                                <Scorecard userId={selectedMember.id} />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {loading ? (
                <div style={{ textAlign: 'center', padding: '20px', color: 'var(--color-text-secondary)' }}>
                    Cargando miembros...
                </div>
            ) : (
                <DataTable
                    columns={columns}
                    data={displayedMembers}
                    keyExtractor={(m) => m.id}
                    actions={[
                        { icon: Edit, onClick: (m) => openEditModal(m) },
                        {
                            icon: Trash2,
                            onClick: (m) => handleDelete(m.id),
                            className: 'text-danger'
                        }
                    ]}
                />
            )}
            {isModalOpen && (
                <MemberForm
                    title={editingMember ? 'Editar Miembro' : 'Nuevo Miembro'}
                    initialData={editingMember}
                    onSubmit={editingMember ? handleUpdate : handleCreate}
                    onCancel={() => setIsModalOpen(false)}
                />
            )}
        </div>
    );
}
