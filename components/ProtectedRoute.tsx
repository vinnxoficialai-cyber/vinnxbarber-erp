import React, { useEffect, useRef } from 'react';
import { Navigate } from 'react-router-dom';
import { TeamMember } from '../types';
import { usePermissions } from '../hooks/usePermissions';
import { useAppData } from '../context/AppDataContext';
import { useToast } from './Toast';

interface ProtectedRouteProps {
    path: string;
    currentUser: TeamMember | null;
    children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ path, currentUser, children }) => {
    const { permissions } = useAppData();
    const { canAccess } = usePermissions(currentUser, permissions);
    const toast = useToast();
    const hasShownToast = useRef(false);

    // canAccess returns false when user is null (loading) — track that separately
    const isLoading = !currentUser;
    const allowed = !isLoading && canAccess(path);

    useEffect(() => {
        if (!isLoading && !allowed && !hasShownToast.current) {
            hasShownToast.current = true;
            toast.warning(
                'Acesso negado',
                'Você não tem permissão para acessar esta página.'
            );
        }
    }, [isLoading, allowed, toast]);

    // While auth is still loading (currentUser is null), render nothing — don't redirect
    if (isLoading) {
        return null;
    }

    if (!allowed) {
        return <Navigate to="/" replace />;
    }

    return <>{children}</>;
};
