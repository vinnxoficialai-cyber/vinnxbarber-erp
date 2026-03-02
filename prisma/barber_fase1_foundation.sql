-- ============================================================
-- VINNX Barber — Fase 1: Fundação do Banco de Dados
-- Adiciona campos e tabelas necessárias para barbearia
-- Executar no SQL Editor do Supabase
-- ============================================================

-- ============================================================
-- 1. ENUM: UserRole + BARBER
-- ============================================================
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'BARBER';

-- ============================================================
-- 2. ENUM: EventType + APPOINTMENT, BLOCKED  
-- ============================================================
ALTER TYPE "EventType" ADD VALUE IF NOT EXISTS 'APPOINTMENT';
ALTER TYPE "EventType" ADD VALUE IF NOT EXISTS 'BLOCKED';

-- ============================================================
-- 3. ALTER TABLE: services (+duration, +category)
-- Verificado: tabela services tem colunas:
--   id, name, description, price, cost, type, active, createdAt, updatedAt
-- ============================================================
ALTER TABLE services ADD COLUMN IF NOT EXISTS duration INT DEFAULT 30;
ALTER TABLE services ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'corte';

CREATE INDEX IF NOT EXISTS idx_services_category ON services(category);

-- ============================================================
-- 4. ALTER TABLE: clients (+lastVisit, +preferredBarberId, +totalVisits)
-- Verificado: tabela clients tem colunas TEXT para IDs
-- ============================================================
ALTER TABLE clients ADD COLUMN IF NOT EXISTS "lastVisit" TIMESTAMPTZ;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS "preferredBarberId" TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS "totalVisits" INT DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_clients_preferred_barber ON clients("preferredBarberId");

-- ============================================================
-- 5. ALTER TABLE: team_members (+specialties, +station)
-- Verificado: tabela team_members, colunas com camelCase
-- ============================================================
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS specialties TEXT[] DEFAULT '{}';
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS station TEXT;

-- ============================================================
-- 6. CREATE TABLE: products (estoque de produtos para venda)
-- ============================================================
CREATE TABLE IF NOT EXISTS products (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    brand TEXT,
    category TEXT DEFAULT 'pomada',
    "costPrice" DECIMAL(10,2) DEFAULT 0,
    "sellPrice" DECIMAL(10,2) NOT NULL DEFAULT 0,
    stock INT DEFAULT 0,
    "minStock" INT DEFAULT 5,
    active BOOLEAN DEFAULT true,
    "createdAt" TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    "updatedAt" TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(active);

-- RLS
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "products_select" ON products;
CREATE POLICY "products_select" ON products
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "products_insert" ON products;
CREATE POLICY "products_insert" ON products
    FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "products_update" ON products;
CREATE POLICY "products_update" ON products
    FOR UPDATE TO authenticated USING (true);

DROP POLICY IF EXISTS "products_delete" ON products;
CREATE POLICY "products_delete" ON products
    FOR DELETE TO authenticated USING (true);

-- ============================================================
-- 7. CREATE TABLE: comandas (atendimento)
-- Nota: clientId é TEXT pois clients.id é TEXT (UUID armazenado como string)
-- Nota: barberId é TEXT pois users.id é TEXT
-- ============================================================
CREATE TABLE IF NOT EXISTS comandas (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    "clientId" TEXT,
    "clientName" TEXT,
    "barberId" TEXT NOT NULL,
    "barberName" TEXT,
    status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'closed', 'cancelled')),
    "totalAmount" DECIMAL(10,2) DEFAULT 0,
    "discountAmount" DECIMAL(10,2) DEFAULT 0,
    "finalAmount" DECIMAL(10,2) DEFAULT 0,
    "paymentMethod" TEXT,
    notes TEXT,
    "openedAt" TIMESTAMPTZ DEFAULT NOW(),
    "closedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    "updatedAt" TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_comandas_barber ON comandas("barberId");
CREATE INDEX IF NOT EXISTS idx_comandas_client ON comandas("clientId");
CREATE INDEX IF NOT EXISTS idx_comandas_status ON comandas(status);
CREATE INDEX IF NOT EXISTS idx_comandas_opened ON comandas("openedAt" DESC);

-- RLS
ALTER TABLE comandas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "comandas_select" ON comandas;
CREATE POLICY "comandas_select" ON comandas
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "comandas_insert" ON comandas;
CREATE POLICY "comandas_insert" ON comandas
    FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "comandas_update" ON comandas;
CREATE POLICY "comandas_update" ON comandas
    FOR UPDATE TO authenticated USING (true);

DROP POLICY IF EXISTS "comandas_delete" ON comandas;
CREATE POLICY "comandas_delete" ON comandas
    FOR DELETE TO authenticated USING (true);

-- ============================================================
-- 8. CREATE TABLE: comanda_items (itens do atendimento)
-- ============================================================
CREATE TABLE IF NOT EXISTS comanda_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    "comandaId" UUID NOT NULL REFERENCES comandas(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('service', 'product')),
    "itemId" TEXT NOT NULL,
    name TEXT NOT NULL,
    quantity INT DEFAULT 1,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "totalPrice" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_comanda_items_comanda ON comanda_items("comandaId");
CREATE INDEX IF NOT EXISTS idx_comanda_items_type ON comanda_items(type);

-- RLS
ALTER TABLE comanda_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "comanda_items_select" ON comanda_items;
CREATE POLICY "comanda_items_select" ON comanda_items
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "comanda_items_insert" ON comanda_items;
CREATE POLICY "comanda_items_insert" ON comanda_items
    FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "comanda_items_update" ON comanda_items;
CREATE POLICY "comanda_items_update" ON comanda_items
    FOR UPDATE TO authenticated USING (true);

DROP POLICY IF EXISTS "comanda_items_delete" ON comanda_items;
CREATE POLICY "comanda_items_delete" ON comanda_items
    FOR DELETE TO authenticated USING (true);

-- ============================================================
-- 9. SEED: role_permissions para BARBER
-- Verificado: role_permissions tem coluna "role" tipo UserRole e "permissions" tipo Json
-- BARBER pode ver: Dashboard, Agenda, Comanda, Tasks, Serviços, Clientes
-- ============================================================
INSERT INTO role_permissions (id, role, permissions, "createdAt", "updatedAt")
VALUES (
    gen_random_uuid(),
    'BARBER',
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
            "/ativos-circulantes": false
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

SELECT 'VINNX Barber — Fase 1 SQL executado com sucesso!' as result;
