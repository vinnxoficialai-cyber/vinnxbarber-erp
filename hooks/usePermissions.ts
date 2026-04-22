import { useMemo, useCallback } from 'react';
import { TeamMember, RolePermission } from '../types';
import { useAppData } from '../context/AppDataContext';

// ===== TYPES =====
export type PermissionAction = 'view' | 'create' | 'edit' | 'delete' | 'manage_users' | 'view_financial';
export type ComponentResource = 'payroll' | 'finance' | 'settings' | 'team' | 'projects';

// Data scoping modes (configurable via Settings > Permissions)
export type DataScopingMode = 'own_only' | 'view_all_edit_own';

// ===== ROUTE-LEVEL ACCESS MAP =====
// Defines which routes each role can ACCESS (navigate to)
const ROUTE_ACCESS: Record<string, string[]> = {
    ADMIN: ['*'], // All routes
    MANAGER: [
        '/', '/agenda', '/tasks',
        '/clients', '/pipeline', '/budgets', '/contracts', '/services', '/projects',
        '/comanda', '/products',
        '/finance', '/contas-bancarias', '/accounts',
        '/team', '/avaliacoes', '/banco-horas', '/ferias', '/metas', '/folha-pagamento',
        '/credenciais',
        // Manager does NOT have /settings
    ],
    SALES: [
        '/', '/agenda', '/tasks',
        '/clients', '/pipeline', '/budgets', '/contracts', '/services', '/projects',
        '/comanda', '/products',
        '/team', '/avaliacoes', '/banco-horas', '/ferias', '/metas',
        '/credenciais',
    ],
    SUPPORT: [
        '/', '/agenda', '/tasks',
        '/projects',
        '/team', '/avaliacoes', '/banco-horas', '/ferias',
    ],
    BARBER: [
        '/', '/agenda', '/tasks',
        '/clients', '/services',
        '/comanda', '/products',
    ],
    ATTENDANT: [
        '/', '/agenda', '/tasks',
        '/clients', '/services',
        '/comanda', '/products',
    ],
};

// ===== ACTION-LEVEL PERMISSIONS PER ROUTE =====
// 'full' = view + create + edit + delete
// 'read' = view only
// undefined = no access
type ActionLevel = 'full' | 'read' | 'own';

const ROUTE_ACTIONS: Record<string, Record<string, ActionLevel>> = {
    ADMIN: {}, // Admin has 'full' everywhere (handled in code)
    MANAGER: {
        '/contas-bancarias': 'read',
        '/accounts': 'read',
        '/folha-pagamento': 'read',
    },
    SALES: {
        '/contracts': 'read',
        '/services': 'read',
        '/projects': 'read',
        '/team': 'read',
        '/avaliacoes': 'own',
        '/banco-horas': 'own',
        '/ferias': 'own',
        '/metas': 'read',
        '/credenciais': 'read',
        '/clients': 'own', // Depends on dataScopingMode
        '/pipeline': 'own',
        '/budgets': 'full',
    },
    SUPPORT: {
        '/projects': 'own',
        '/team': 'read',
        '/avaliacoes': 'own',
        '/banco-horas': 'own',
        '/ferias': 'own',
    },
    BARBER: {
        '/clients': 'own',
        '/services': 'read',
    },
    ATTENDANT: {
        '/clients': 'read',
        '/services': 'read',
    },
};

// ===== OLD RESOURCE-BASED PERMISSIONS (backward compat) =====
const RESOURCE_PERMISSIONS: Record<string, Partial<Record<ComponentResource, PermissionAction[]>>> = {
    ADMIN: {
        payroll: ['view', 'create', 'edit', 'delete'],
        finance: ['view', 'create', 'edit', 'delete'],
        settings: ['view', 'edit'],
        team: ['view', 'create', 'edit', 'delete', 'manage_users'],
        projects: ['view', 'create', 'edit', 'delete'],
    },
    MANAGER: {
        payroll: ['view'],
        finance: ['view'],
        settings: ['view'],
        team: ['view', 'create', 'edit'],
        projects: ['view', 'create', 'edit'],
    },
    SUPPORT: {
        payroll: [],
        finance: [],
        settings: [],
        team: ['view'],
        projects: ['view', 'create', 'edit'],
    },
    SALES: {
        payroll: [],
        finance: [],
        settings: [],
        team: ['view'],
        projects: ['view', 'create', 'edit'],
    },
    BARBER: {
        payroll: [],
        finance: [],
        settings: [],
        team: ['view'],
        projects: [],
    },
    ATTENDANT: {
        payroll: [],
        finance: [],
        settings: [],
        team: ['view'],
        projects: [],
    }
};

const DEFAULT_RESOURCE_PERMISSIONS: Partial<Record<ComponentResource, PermissionAction[]>> = {
    payroll: [],
    finance: [],
    settings: [],
    team: ['view'],
    projects: ['view']
};

// ===== HELPER: Normalize role =====
function normalizeRole(role?: string): string {
    if (!role) return 'SUPPORT';
    let key = role.toUpperCase();
    if (key === 'SALES EXECUTIVE') key = 'SALES';
    return key;
}

// ===== MAIN HOOK =====
export function usePermissions(
    user: TeamMember | null,
    contextPermissions?: RolePermission[],
    dataScopingMode?: DataScopingMode
) {
    const { settings } = useAppData();
    const effectiveScopingMode = dataScopingMode || settings?.company?.dataScoping || 'own_only';

    const roleKey = useMemo(() => normalizeRole(user?.role), [user?.role]);
    const scopingMode = effectiveScopingMode;

    // Check if user can ACCESS a route (navigate to it)
    const canAccess = useCallback((path: string): boolean => {
        if (!user) return false;
        if (roleKey === 'ADMIN') return true;

        // Check context permissions first (from Settings > Permissions tab)
        if (contextPermissions && contextPermissions.length > 0) {
            const rolePerms = contextPermissions.find(p => p.role === roleKey as any);
            if (rolePerms && rolePerms.permissions) {
                const perm = rolePerms.permissions[path];
                if (typeof perm === 'boolean') return perm;
            }
        }

        // Fallback to hardcoded defaults
        const routes = ROUTE_ACCESS[roleKey] || ROUTE_ACCESS['SUPPORT'];
        if (routes.includes('*')) return true;
        return routes.includes(path);
    }, [user, roleKey, contextPermissions]);

    // Get the action level for a route
    const getActionLevel = useCallback((path: string): ActionLevel => {
        if (roleKey === 'ADMIN') return 'full';
        const actions = ROUTE_ACTIONS[roleKey] || {};
        return actions[path] || 'full'; // Default to full if route is accessible but no restriction
    }, [roleKey]);

    // Can the user CREATE records on this page?
    const canCreate = useCallback((path: string): boolean => {
        if (!canAccess(path)) return false;
        const level = getActionLevel(path);
        return level === 'full' || level === 'own';
    }, [canAccess, getActionLevel]);

    // Can the user EDIT records on this page?
    const canEdit = useCallback((path: string): boolean => {
        if (!canAccess(path)) return false;
        const level = getActionLevel(path);
        return level === 'full' || level === 'own';
    }, [canAccess, getActionLevel]);

    // Can the user DELETE records on this page?
    const canDelete = useCallback((path: string): boolean => {
        if (!canAccess(path)) return false;
        const level = getActionLevel(path);
        return level === 'full';
    }, [canAccess, getActionLevel]);

    // Is this page read-only for the current user?
    const isReadOnly = useCallback((path: string): boolean => {
        return getActionLevel(path) === 'read';
    }, [getActionLevel]);

    // Does this page scope data to "own" records?
    const isOwnOnly = useCallback((path: string): boolean => {
        return getActionLevel(path) === 'own';
    }, [getActionLevel]);

    // Check if a resource belongs to this user (data scoping)
    const isOwner = useCallback((ownerId?: string): boolean => {
        if (!user || !ownerId) return false;
        return user.id === ownerId;
    }, [user]);

    // Should the user see ALL data or only their own?
    // Depends on dataScopingMode setting + action level
    const canViewAllData = useCallback((path: string): boolean => {
        if (roleKey === 'ADMIN' || roleKey === 'MANAGER') return true;
        const level = getActionLevel(path);
        if (level === 'full') return true;
        if (level === 'read') return true; // Read-only still sees all data
        // 'own' level: depends on scoping mode
        if (scopingMode === 'view_all_edit_own') return true;
        return false; // 'own_only' mode: only see own data
    }, [roleKey, getActionLevel, scopingMode]);

    // Role checkers
    const isAdmin = roleKey === 'ADMIN';
    const isManager = roleKey === 'MANAGER';
    const isSales = roleKey === 'SALES';
    const isSupport = roleKey === 'SUPPORT';
    const isBarber = roleKey === 'BARBER';
    const isAttendant = roleKey === 'ATTENDANT';
    const isAdminOrManager = isAdmin || isManager;

    // Backward compatible: old `can(action, resource)` API
    const resourcePerms = useMemo(() => {
        return RESOURCE_PERMISSIONS[roleKey] || DEFAULT_RESOURCE_PERMISSIONS;
    }, [roleKey]);

    const can = useCallback((action: PermissionAction, resource: ComponentResource): boolean => {
        const perms = resourcePerms[resource];
        return perms?.includes(action) || false;
    }, [resourcePerms]);

    const isRole = useCallback((role: string) => {
        return roleKey === normalizeRole(role);
    }, [roleKey]);

    return {
        // New API
        canAccess,
        canCreate,
        canEdit,
        canDelete,
        isReadOnly,
        isOwnOnly,
        isOwner,
        canViewAllData,

        // Role checkers
        isAdmin,
        isManager,
        isSales,
        isSupport,
        isBarber,
        isAttendant,
        isAdminOrManager,
        getActionLevel,
        effectiveScopingMode, // Export for debug if needed

        // Backward compatible API
        can,
        isRole,
        role: user?.role,
    };
}
