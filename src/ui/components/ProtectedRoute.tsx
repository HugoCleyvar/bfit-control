import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../logic/authContext';
import type { UserRole } from '../../domain/types';

interface ProtectedRouteProps {
    children: React.ReactElement;
    allowedRoles?: UserRole[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
    const { user, isAuthenticated, isLoading } = useAuth();
    const location = useLocation();

    if (isLoading) {
        return (
            <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                Cargando...
            </div>
        );
    }

    if (!isAuthenticated || !user) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    if (allowedRoles && !allowedRoles.includes(user.rol)) {
        // Redirect unauthorized users to a safe page (e.g. Shifts where they usually work, or just Home)
        // If they are at Home and not allowed, this might loop if Home is protected. 
        // For MVP, if they try to access Admin route, send them to /shifts or show message.
        return <Navigate to="/shifts" replace />;
    }

    return children;
}
