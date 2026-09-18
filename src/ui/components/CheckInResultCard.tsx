import { CheckCircle2, XCircle, User } from 'lucide-react';
import type { CheckInResult } from '../../logic/api/attendanceService';
import { getSubscriptionBadge } from '../../domain/subscriptionStatus';
import { parseLocalDate } from '../../domain/dateUtils';

interface CheckInResultCardProps {
    result: CheckInResult;
}

export function CheckInResultCard({ result }: CheckInResultCardProps) {
    const member = result.member;
    const accentColor = result.success ? 'var(--color-success)' : 'var(--color-danger)';
    const badge = member ? getSubscriptionBadge(member.subscriptionStatus, member.daysRemaining) : null;
    const visitas = member?.visitasDisponibles ?? 0;

    return (
        <div style={{
            marginTop: 'var(--spacing-lg)',
            padding: 'var(--spacing-lg)',
            borderRadius: 'var(--radius-lg)',
            backgroundColor: result.success ? 'rgba(0, 204, 102, 0.08)' : 'rgba(255, 77, 77, 0.08)',
            border: `1px solid ${accentColor}`,
            textAlign: 'center',
            animation: 'checkInPop 0.25s ease-out'
        }}>
            {member?.foto_url ? (
                <img
                    src={member.foto_url}
                    alt={member.nombre}
                    style={{
                        width: '72px', height: '72px', borderRadius: '50%', objectFit: 'cover',
                        margin: '0 auto 12px', display: 'block', border: `3px solid ${accentColor}`
                    }}
                />
            ) : (
                <div style={{
                    width: '72px', height: '72px', borderRadius: '50%', margin: '0 auto 12px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    backgroundColor: 'var(--color-card)', border: `3px solid ${accentColor}`
                }}>
                    <User size={32} color="var(--color-text-secondary)" />
                </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: 'var(--font-size-lg)', fontWeight: 'bold', color: accentColor }}>
                {result.success ? <CheckCircle2 size={22} /> : <XCircle size={22} />}
                {result.success ? 'ACCESO CONCEDIDO' : 'ACCESO DENEGADO'}
            </div>

            {member && (
                <div style={{ fontSize: '19px', fontWeight: 600, marginTop: '6px' }}>
                    {member.nombre} {member.apellido || ''}
                </div>
            )}

            <div style={{ marginTop: 'var(--spacing-sm)', fontSize: 'var(--font-size-base)', color: 'var(--color-text-secondary)' }}>
                {result.message}
            </div>

            {member && member.isPackPlan ? (
                <div style={{
                    marginTop: 'var(--spacing-md)', display: 'inline-flex', alignItems: 'center', gap: '8px',
                    padding: '8px 16px', borderRadius: 'var(--radius-full)',
                    backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid var(--color-accent)'
                }}>
                    <span style={{ color: 'var(--color-accent)', fontWeight: 600, fontSize: '14px' }}>
                        {visitas} visita{visitas === 1 ? '' : 's'} restante{visitas === 1 ? '' : 's'}
                    </span>
                </div>
            ) : member && badge ? (
                <div style={{
                    marginTop: 'var(--spacing-md)', display: 'inline-flex', alignItems: 'center', gap: '8px',
                    padding: '8px 16px', borderRadius: 'var(--radius-full)',
                    backgroundColor: 'rgba(255,255,255,0.06)', border: `1px solid ${badge.colorVar}`
                }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: badge.colorVar }} />
                    <span style={{ color: badge.colorVar, fontWeight: 600, fontSize: '14px' }}>{badge.label}</span>
                    {member.subscriptionEndDate && (
                        <span style={{ color: 'var(--color-text-secondary)', fontSize: '13px' }}>
                            · vence {parseLocalDate(member.subscriptionEndDate).toLocaleDateString('es-MX')}
                        </span>
                    )}
                </div>
            ) : null}
        </div>
    );
}
