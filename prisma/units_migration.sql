-- ============================================================
-- VINNX Barber — Multi-Unidades: Migration
-- Cria tabelas units + unit_members e adiciona unitId nas tabelas operacionais
-- Executar no SQL Editor do Supabase
-- ============================================================

-- ============================================================
-- 1. CREATE TABLE: units (unidades da rede)
-- ============================================================
CREATE TABLE IF NOT EXISTS units (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    "tradeName" TEXT,
    cnpj TEXT,
    address TEXT NOT NULL,
    city TEXT NOT NULL,
    state TEXT NOT NULL DEFAULT 'SP',
    zip TEXT,
    phone TEXT NOT NULL,
    email TEXT,
    "managerId" TEXT,           -- FK users.id (TEXT)
    "managerName" TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'opening')),
    image TEXT,
    "openingDate" DATE,
    "maxCapacity" INT DEFAULT 6,
    "operatingHours" TEXT DEFAULT '09:00 - 20:00',
    notes TEXT,
    "createdAt" TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    "updatedAt" TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_units_status ON units(status);

-- RLS
ALTER TABLE units ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "units_select" ON units;
CREATE POLICY "units_select" ON units
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "units_insert" ON units;
CREATE POLICY "units_insert" ON units
    FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "units_update" ON units;
CREATE POLICY "units_update" ON units
    FOR UPDATE TO authenticated USING (true);

DROP POLICY IF EXISTS "units_delete" ON units;
CREATE POLICY "units_delete" ON units
    FOR DELETE TO authenticated USING (true);

-- ============================================================
-- 2. CREATE TABLE: unit_members (N:N entre units e users)
-- userId é TEXT porque users.id é TEXT (não UUID)
-- ============================================================
CREATE TABLE IF NOT EXISTS unit_members (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    "unitId" UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,
    "userId" TEXT NOT NULL,       -- FK users.id (TEXT)
    role TEXT DEFAULT 'member',
    "isPrimary" BOOLEAN DEFAULT false,
    "createdAt" TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_unit_members_unique
    ON unit_members("unitId", "userId");
CREATE INDEX IF NOT EXISTS idx_unit_members_unit ON unit_members("unitId");
CREATE INDEX IF NOT EXISTS idx_unit_members_user ON unit_members("userId");

-- RLS
ALTER TABLE unit_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "unit_members_select" ON unit_members;
CREATE POLICY "unit_members_select" ON unit_members
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "unit_members_insert" ON unit_members;
CREATE POLICY "unit_members_insert" ON unit_members
    FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "unit_members_update" ON unit_members;
CREATE POLICY "unit_members_update" ON unit_members
    FOR UPDATE TO authenticated USING (true);

DROP POLICY IF EXISTS "unit_members_delete" ON unit_members;
CREATE POLICY "unit_members_delete" ON unit_members
    FOR DELETE TO authenticated USING (true);

-- ============================================================
-- 3. ALTER TABLE: Adicionar "unitId" nullable nas tabelas operacionais
-- TEXT para manter consistência (armazenado como string UUID)
-- NULL = "sem unidade atribuída" (dados existentes ficam intactos)
-- ============================================================
ALTER TABLE comandas         ADD COLUMN IF NOT EXISTS "unitId" TEXT;
ALTER TABLE transactions     ADD COLUMN IF NOT EXISTS "unitId" TEXT;
ALTER TABLE products         ADD COLUMN IF NOT EXISTS "unitId" TEXT;
ALTER TABLE calendar_events  ADD COLUMN IF NOT EXISTS "unitId" TEXT;

-- Indices para performance em queries filtradas por unidade
CREATE INDEX IF NOT EXISTS idx_comandas_unit ON comandas("unitId");
CREATE INDEX IF NOT EXISTS idx_transactions_unit ON transactions("unitId");
CREATE INDEX IF NOT EXISTS idx_products_unit ON products("unitId");
CREATE INDEX IF NOT EXISTS idx_calendar_events_unit ON calendar_events("unitId");

-- ============================================================
-- 4. SEED: role_permissions — adicionar /unidades e /relatorios
-- ============================================================
-- Primeiro adiciona as rotas como false para todos
UPDATE role_permissions
SET permissions = jsonb_set(
    permissions,
    '{pages,/unidades}', 'false'::jsonb
)
WHERE permissions->'pages' IS NOT NULL
  AND NOT (permissions->'pages' ? '/unidades');

UPDATE role_permissions
SET permissions = jsonb_set(
    permissions,
    '{pages,/relatorios}', 'false'::jsonb
)
WHERE permissions->'pages' IS NOT NULL
  AND NOT (permissions->'pages' ? '/relatorios');

-- Depois libera para ADMIN e MANAGER
UPDATE role_permissions
SET permissions = jsonb_set(
    jsonb_set(permissions, '{pages,/unidades}', 'true'::jsonb),
    '{pages,/relatorios}', 'true'::jsonb
)
WHERE role IN ('ADMIN', 'MANAGER');

SELECT 'VINNX Barber — Multi-Unidades migration executada com sucesso!' as result;
