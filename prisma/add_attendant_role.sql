-- ============================================================
-- VINNX Barber — Adicionar role ATTENDANT (Atendente)
-- Executado em 2026-04-16
-- ============================================================

-- 1. Adicionar ATTENDANT ao enum UserRole
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'ATTENDANT';

-- 2. Criar role_permissions para ATTENDANT
-- (Mesmo nível de acesso do BARBER, com agenda, clientes, comandas)
INSERT INTO role_permissions (id, role, permissions, "createdAt", "updatedAt")
VALUES (
    gen_random_uuid(),
    'ATTENDANT',
    '{
        "pages": {
            "/": true,
            "/agenda": true,
            "/tasks": true,
            "/clients": true,
            "/services": true,
            "/comanda": true,
            "/products": true,
            "/team": false,
            "/finance": false,
            "/settings": false,
            "/projects": false,
            "/pipeline": false,
            "/budgets": false,
            "/contracts": false,
            "/contas-bancarias": false,
            "/contas-pagar": false,
            "/avaliacoes": false,
            "/banco-horas": false,
            "/ferias": false,
            "/credenciais": false,
            "/metas": false,
            "/folha-pagamento": false,
            "/passivo-circulante": false,
            "/ativos-circulantes": false,
            "/unidades": false,
            "/relatorios": false
        },
        "actions": {
            "canCreate": true,
            "canEdit": true,
            "canDelete": false,
            "canExport": false,
            "canViewFinancials": false,
            "canManageTeam": false,
            "canManageSettings": false
        }
    }'::jsonb,
    NOW(),
    NOW()
)
ON CONFLICT (role) DO UPDATE SET
    permissions = EXCLUDED.permissions,
    "updatedAt" = NOW();
