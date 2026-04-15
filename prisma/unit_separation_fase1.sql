-- ============================================================
-- VINNX Barber — FASE 1: Separacao de Dados por Unidade
-- Adicionar unitId nas tabelas clients e services
-- Executar no SQL Editor do Supabase
-- ============================================================

-- 1. ALTER TABLE: clients
ALTER TABLE clients ADD COLUMN IF NOT EXISTS "unitId" TEXT;
CREATE INDEX IF NOT EXISTS idx_clients_unit ON clients("unitId");

-- 2. ALTER TABLE: services
ALTER TABLE services ADD COLUMN IF NOT EXISTS "unitId" TEXT;
CREATE INDEX IF NOT EXISTS idx_services_unit ON services("unitId");

-- 3. Verificar que unitId ja existe nas demais tabelas
-- (comandas, transactions, products, calendar_events ja tem unitId via units_migration.sql)

SELECT 'FASE 1 — unitId adicionado em clients e services com sucesso!' as result;
