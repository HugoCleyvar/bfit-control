import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from './api/supabase';
import { useAuth } from './authContext';
import { getMemberStatusById } from './api/memberService';
import { getSubscriptionBadge, type SubscriptionBadge } from '../domain/subscriptionStatus';

export interface AttendanceNotification {
    id: string;
    nombre: string;
    apellido: string;
    permitido: boolean;
    badge: SubscriptionBadge;
}

interface NotificationsContextType {
    notifications: AttendanceNotification[];
    dismiss: (id: string) => void;
}

const NotificationsContext = createContext<NotificationsContextType | undefined>(undefined);

const AUTO_DISMISS_MS = 9000;
const MAX_TOASTS = 4;

interface AttendanceRow {
    id: string;
    usuario_id: string;
    colaborador_id?: string | null;
    permitido: boolean;
}

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
    const { user, isAuthenticated } = useAuth();
    const [notifications, setNotifications] = useState<AttendanceNotification[]>([]);
    const timersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

    const dismiss = useCallback((id: string) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
        const timer = timersRef.current[id];
        if (timer) {
            clearTimeout(timer);
            delete timersRef.current[id];
        }
    }, []);

    useEffect(() => {
        if (!isAuthenticated || !user) return;

        const channel = supabase
            .channel('attendance-notifications')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'attendance' },
                async (payload) => {
                    const row = payload.new as AttendanceRow;

                    // Skip check-ins this same account just performed - that device already
                    // shows the full result card, a toast on top of it would be redundant.
                    if (row.colaborador_id && row.colaborador_id === user.id) return;

                    const member = await getMemberStatusById(row.usuario_id);
                    if (!member) return;

                    const notification: AttendanceNotification = {
                        id: row.id,
                        nombre: member.nombre,
                        apellido: member.apellido,
                        permitido: row.permitido,
                        badge: getSubscriptionBadge(member.subscriptionStatus, member.daysRemaining)
                    };

                    setNotifications(prev => [notification, ...prev].slice(0, MAX_TOASTS));

                    timersRef.current[notification.id] = setTimeout(() => {
                        setNotifications(prev => prev.filter(n => n.id !== notification.id));
                        delete timersRef.current[notification.id];
                    }, AUTO_DISMISS_MS);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
            Object.values(timersRef.current).forEach(clearTimeout);
            timersRef.current = {};
        };
    }, [isAuthenticated, user]);

    return (
        <NotificationsContext.Provider value={{ notifications, dismiss }}>
            {children}
        </NotificationsContext.Provider>
    );
}

export function useNotifications() {
    const context = useContext(NotificationsContext);
    if (context === undefined) {
        throw new Error('useNotifications must be used within a NotificationsProvider');
    }
    return context;
}
