import type { SubscriptionStatus } from './types';

export type BadgeTone = 'success' | 'warning' | 'danger';

export interface SubscriptionBadge {
    label: string;
    tone: BadgeTone;
    colorVar: string;
}

// Shared by the check-in result card and the cross-device "someone arrived" toasts, so both
// classify a member's standing the same way instead of drifting apart over time.
export function getSubscriptionBadge(
    status: SubscriptionStatus | 'sin_suscripcion' | undefined,
    daysRemaining: number | undefined
): SubscriptionBadge {
    if (status === 'vencida') {
        return { label: 'Vencido', tone: 'danger', colorVar: 'var(--color-danger)' };
    }
    if (status === 'cancelada') {
        return { label: 'Cancelada', tone: 'danger', colorVar: 'var(--color-danger)' };
    }
    if (status === 'sin_suscripcion' || status === undefined) {
        return { label: 'Sin membresía', tone: 'danger', colorVar: 'var(--color-danger)' };
    }

    // status === 'activa' from here on
    if (daysRemaining !== undefined && daysRemaining <= 3) {
        return {
            label: daysRemaining <= 0 ? 'Vence hoy' : `Vence en ${daysRemaining} día${daysRemaining === 1 ? '' : 's'}`,
            tone: 'warning',
            colorVar: 'var(--color-warning)'
        };
    }

    return { label: 'Vigente', tone: 'success', colorVar: 'var(--color-success)' };
}
