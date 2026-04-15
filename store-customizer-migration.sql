-- =====================================================================
-- VINNX BARBER — Store Customizer: Migração de Banco de Dados
-- Script SQL v3 — Executar no Supabase SQL Editor
-- 
-- Pré-requisitos: Nenhum script anterior precisa ter sido executado.
-- Este script é idempotente (seguro para executar múltiplas vezes).
-- =====================================================================

-- =====================================================================
-- PARTE 1: Remover tabela antiga (site_settings)
-- =====================================================================
-- A tabela site_settings era uma single-row com JSONB.
-- Será substituída por store_settings (key-value, muito mais flexível).
-- Verificação: NÃO é usada pelo AppDataContext (confirmado: 0 referências).

DROP TABLE IF EXISTS site_settings CASCADE;

-- =====================================================================
-- PARTE 2: Criar tabela store_settings (key-value)
-- =====================================================================
-- Cada configuração é uma linha com key TEXT UNIQUE e value TEXT.
-- A constraint UNIQUE em 'key' cria um índice B-tree automático.

CREATE TABLE IF NOT EXISTS store_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  value TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =====================================================================
-- PARTE 3: Row Level Security (RLS) para store_settings
-- =====================================================================
-- Leitura: PÚBLICA (o PublicSite e o iframe precisam ler sem auth)
-- Escrita: Apenas usuários AUTENTICADOS (admin no StoreCustomizer)

ALTER TABLE store_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "store_settings_public_read" ON store_settings;
DROP POLICY IF EXISTS "store_settings_auth_insert" ON store_settings;
DROP POLICY IF EXISTS "store_settings_auth_update" ON store_settings;
DROP POLICY IF EXISTS "store_settings_auth_delete" ON store_settings;

CREATE POLICY "store_settings_public_read" 
  ON store_settings FOR SELECT 
  USING (true);

CREATE POLICY "store_settings_auth_insert" 
  ON store_settings FOR INSERT 
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "store_settings_auth_update" 
  ON store_settings FOR UPDATE 
  USING (auth.role() = 'authenticated');

CREATE POLICY "store_settings_auth_delete" 
  ON store_settings FOR DELETE 
  USING (auth.role() = 'authenticated');

-- =====================================================================
-- PARTE 4: Trigger para atualizar updated_at automaticamente
-- =====================================================================

CREATE OR REPLACE FUNCTION update_store_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_store_settings_updated_at ON store_settings;

CREATE TRIGGER trigger_store_settings_updated_at
  BEFORE UPDATE ON store_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_store_settings_updated_at();

-- =====================================================================
-- PARTE 5: Garantir leitura pública nas tabelas do PublicSite
-- =====================================================================
-- O PublicSite faz queries diretas (sem auth) nestas tabelas:
--   - services, units, users, subscription_plans
--
-- REGRA DE SEGURANÇA:
--   - Se RLS ESTÁ ATIVO na tabela → adicionar policy SELECT público
--     (é ADITIVO: não remove policies existentes de INSERT/UPDATE/DELETE)
--   - Se RLS NÃO ESTÁ ATIVO → NÃO FAZER NADA
--     (sem RLS = acesso total, leitura já funciona)
--
-- ⚠️ NUNCA ativar RLS em tabela sem RLS apenas para adicionar SELECT,
-- porque isso BLOQUEARIA INSERT/UPDATE/DELETE (sem policies de escrita)
-- e QUEBRARIA o ERP inteiro!

DO $$
DECLARE
  tbl RECORD;
  rls_enabled BOOLEAN;
BEGIN
  FOR tbl IN 
    SELECT * FROM (VALUES 
      ('services', 'services_public_read'),
      ('units', 'units_public_read'),
      ('users', 'users_public_read'),
      ('subscription_plans', 'subscription_plans_public_read')
    ) AS t(table_name, policy_name)
  LOOP
    -- Verificar se RLS está ativo nesta tabela
    SELECT c.relrowsecurity INTO rls_enabled
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = tbl.table_name
    AND n.nspname = 'public'
    AND c.relkind = 'r';
    
    IF rls_enabled IS NULL THEN
      RAISE NOTICE '⚠️ Tabela "%" não encontrada — pulando', tbl.table_name;
      CONTINUE;
    END IF;
    
    IF NOT rls_enabled THEN
      RAISE NOTICE '⏭️ Tabela "%" NÃO tem RLS ativo — leitura pública já funciona, nada a fazer', tbl.table_name;
      CONTINUE;
    END IF;
    
    -- RLS está ativo: verificar se já tem policy de SELECT público
    IF EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE tablename = tbl.table_name 
      AND cmd = 'SELECT'
      AND qual = '(true)'
    ) THEN
      RAISE NOTICE '⏭️ Tabela "%" já tem SELECT público — pulando', tbl.table_name;
    ELSE
      -- Adicionar policy de SELECT público (ADITIVO — não afeta outras policies)
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I', tbl.policy_name, tbl.table_name);
      EXECUTE format('CREATE POLICY %I ON %I FOR SELECT USING (true)', tbl.policy_name, tbl.table_name);
      RAISE NOTICE '✅ Policy "%" criada na tabela "%"', tbl.policy_name, tbl.table_name;
    END IF;
  END LOOP;
END $$;

-- =====================================================================
-- PARTE 6: Verificação final
-- =====================================================================

-- 6a. Policies da store_settings
SELECT 'STORE_SETTINGS POLICIES' AS check_type,
  policyname, cmd, qual
FROM pg_policies 
WHERE tablename = 'store_settings'
ORDER BY policyname;

-- 6b. Colunas da store_settings
SELECT 'STORE_SETTINGS COLUMNS' AS check_type,
  column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'store_settings'
ORDER BY ordinal_position;

-- 6c. Status de RLS e policies públicas em todas as tabelas relevantes
SELECT 'PUBLIC TABLE STATUS' AS check_type,
  c.relname AS table_name,
  c.relrowsecurity AS rls_enabled,
  (SELECT COUNT(*) FROM pg_policies p 
   WHERE p.tablename = c.relname 
   AND p.cmd = 'SELECT' 
   AND p.qual = '(true)') AS public_read_policies
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relname IN ('services', 'units', 'users', 'subscription_plans', 'store_settings')
AND c.relkind = 'r'
AND n.nspname = 'public'
ORDER BY c.relname;

-- =====================================================================
-- NOTA: Bucket 'store-assets'
-- =====================================================================
-- Criar MANUALMENTE no Supabase Dashboard:
-- 1. Storage → Create bucket → Nome: store-assets
-- 2. Public: SIM (leitura pública)
-- 3. MIME types: image/jpeg, image/png, image/webp, image/svg+xml
-- 4. Max file size: 5MB
-- 5. Policies de escrita: auth.role() = 'authenticated'
-- =====================================================================
