import { useState, useEffect, useCallback } from 'react';
import { registerCheckIn, getTodayAttendance } from '../../logic/api/attendanceService';
import type { CheckInResult } from '../../logic/api/attendanceService';
import type { Attendance } from '../../domain/types';
import { useAuth } from '../../logic/authContext';
import { useShift } from '../../logic/shiftContext';
import { DataTable } from '../components/DataTable';
import type { Column } from '../components/DataTable';
// Removed unused getMembers import
import { MemberSearch } from '../components/MemberSearch';
import { Search, XCircle, CheckCircle } from 'lucide-react';

export default function AttendancePage() {
    const [query, setQuery] = useState('');
    const [checkInResult, setCheckInResult] = useState<CheckInResult | null>(null);
    const [attendanceList, setAttendanceList] = useState<Attendance[]>([]);
    const [loading, setLoading] = useState(false);

    const loadData = useCallback(async () => {
        // Load in parallel
        const [attList] = await Promise.all([
            getTodayAttendance()
        ]);
        setAttendanceList(attList);
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const { user, isAdmin } = useAuth();
    const { currentShift } = useShift();

    // Manual ID checkin (legacy input or fallback)
    const handleCheckIn = async (e?: React.FormEvent, directId?: string) => {
        if (e) e.preventDefault();

        // Security Check
        if (!isAdmin && !currentShift) {
            alert('Debes abrir un turno para registrar asistencias.');
            return;
        }

        const searchTerm = directId || query;

        if (!searchTerm.trim()) return;

        setLoading(true);
        setCheckInResult(null);

        const result = await registerCheckIn(
            searchTerm,
            user?.id,
            currentShift?.id
        );

        setCheckInResult(result);
        setLoading(false);
        setQuery(''); // Clear manual input

        if (result.success || result.message !== 'Usuario no encontrado') {
            await loadData();
        }
    };

    const columns: Column<Attendance>[] = [
        { header: 'Hora', accessor: (item) => new Date(item.fecha_hora).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
        { header: 'Miembro', accessor: (item) => item.usuario ? `${item.usuario.nombre} ${item.usuario.apellido}` : 'Desconocido' },
        {
            header: 'Acceso',
            accessor: (item) => (
                item.permitido
                    ? <span style={{ color: 'var(--color-success)', display: 'flex', alignItems: 'center', gap: '4px' }}><CheckCircle size={14} /> Permitido</span>
                    : <span style={{ color: 'var(--color-danger)', display: 'flex', alignItems: 'center', gap: '4px' }}><XCircle size={14} /> Denegado</span>
            )
        },
    ];

    return (
        <div className="page-container">
            <h2>Control de Asistencias</h2>

            <div style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-xl)', marginTop: 'var(--spacing-lg)'
            }}>
                {/* Check-in Panel */}
                <div style={{ backgroundColor: 'var(--color-card)', padding: 'var(--spacing-xl)', borderRadius: 'var(--radius-lg)' }}>
                    <h3 style={{ marginBottom: 'var(--spacing-md)' }}>Registrar Entrada</h3>

                    <div style={{ marginBottom: 'var(--spacing-md)' }}>
                        <label style={{ display: 'block', marginBottom: '8px', fontSize: 'var(--font-size-sm)' }}>Buscar por Nombre</label>
                        <MemberSearch
                            placeholder="Escribe el nombre del miembro..."
                            onSelect={(id) => handleCheckIn(undefined, id)}
                        />
                    </div>

                    <div style={{ position: 'relative', textAlign: 'center', margin: '10px 0', opacity: 0.5 }}>- O -</div>

                    <form onSubmit={(e) => handleCheckIn(e)} style={{ display: 'flex', gap: 'var(--spacing-md)' }}>
                        <div style={{ position: 'relative', flex: 1 }}>
                            <Search size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--color-text-secondary)' }} />
                            <input
                                type="text"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="ID Manual..."
                                style={{
                                    width: '100%', padding: '10px 10px 10px 36px',
                                    borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)',
                                    backgroundColor: 'var(--color-bg)', color: 'var(--color-text-primary)'
                                }}
                            />
                        </div>
                        <button type="submit" disabled={loading} style={{ padding: '0 15px' }}>
                            ID
                        </button>
                    </form>

                    {checkInResult && (
                        <div style={{
                            marginTop: 'var(--spacing-lg)',
                            padding: 'var(--spacing-lg)',
                            borderRadius: 'var(--radius-md)',
                            backgroundColor: checkInResult.success ? 'rgba(0, 204, 102, 0.1)' : 'rgba(255, 77, 77, 0.1)',
                            border: `1px solid ${checkInResult.success ? 'var(--color-success)' : 'var(--color-danger)'}`,
                            textAlign: 'center'
                        }}>
                            <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'bold', color: checkInResult.success ? 'var(--color-success)' : 'var(--color-danger)' }}>
                                {checkInResult.success ? 'ACCESO CONCEDIDO' : 'ACCESO DENEGADO'}
                            </div>
                            <div style={{ marginTop: 'var(--spacing-sm)', fontSize: 'var(--font-size-lg)' }}>
                                {checkInResult.message}
                            </div>
                        </div>
                    )}
                </div>

                {/* Recent Attendance */}
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-md)' }}>
                        <h3>Visitas de Hoy</h3>
                        <span style={{ fontSize: '14px', color: 'var(--color-text-secondary)' }}>
                            Permitidas: <b>{attendanceList.filter(a => a.permitido).length}</b>
                        </span>
                    </div>
                    <DataTable
                        columns={columns}
                        data={attendanceList}
                        keyExtractor={(item) => item.id}
                    />
                </div>
            </div>
        </div>
    );
}
