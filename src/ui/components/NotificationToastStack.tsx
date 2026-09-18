import { CheckCircle2, XCircle, X } from 'lucide-react';
import { useNotifications } from '../../logic/notificationsContext';

// "Someone just checked in" toasts for devices other than the one that performed the
// check-in - lets staff working elsewhere in the gym see arrivals (and their membership
// status) without watching the Asistencias page.
export function NotificationToastStack() {
    const { notifications, dismiss } = useNotifications();

    if (notifications.length === 0) return null;

    return (
        <div style={{
            position: 'fixed', top: '16px', right: '16px', zIndex: 2000,
            display: 'flex', flexDirection: 'column', gap: '10px',
            maxWidth: '320px', width: 'calc(100% - 32px)'
        }}>
            {notifications.map(n => (
                <div
                    key={n.id}
                    style={{
                        backgroundColor: 'var(--color-card)', border: `1px solid ${n.badge.colorVar}`,
                        borderRadius: 'var(--radius-md)', padding: '12px 14px',
                        boxShadow: '0 10px 25px rgba(0,0,0,0.35)',
                        animation: 'toastSlideIn 0.25s ease-out',
                        display: 'flex', alignItems: 'flex-start', gap: '10px'
                    }}
                >
                    {n.permitido
                        ? <CheckCircle2 size={20} color="var(--color-success)" style={{ flexShrink: 0, marginTop: '2px' }} />
                        : <XCircle size={20} color="var(--color-danger)" style={{ flexShrink: 0, marginTop: '2px' }} />
                    }
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: '14px' }}>{n.nombre} {n.apellido}</div>
                        <div style={{ fontSize: '13px', color: n.badge.colorVar, marginTop: '2px' }}>{n.badge.label}</div>
                    </div>
                    <button
                        onClick={() => dismiss(n.id)}
                        style={{ background: 'transparent', border: 'none', padding: '2px', color: 'var(--color-text-secondary)', cursor: 'pointer', flexShrink: 0 }}
                        aria-label="Cerrar"
                    >
                        <X size={14} />
                    </button>
                </div>
            ))}
        </div>
    );
}
