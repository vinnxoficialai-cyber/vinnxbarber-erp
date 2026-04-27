-- =====================================================
-- VINNX Barber ERP — Push Subscriptions RLS Policy Fix
-- Execute 1x no Supabase SQL Editor
-- =====================================================

-- 0. Garante que RLS está habilitado na tabela
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Helper: verifica se o email do JWT pertence a um staff (tabela users)
-- SECURITY DEFINER: bypassa RLS da tabela users para evitar bloqueio
CREATE OR REPLACE FUNCTION is_staff_user()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM users WHERE email = (auth.jwt()->>'email')
  );
$$;

-- 1. Remove policies antigas (idempotente)
DROP POLICY IF EXISTS "push_subs_own" ON push_subscriptions;
DROP POLICY IF EXISTS "push_subs_staff_read" ON push_subscriptions;
DROP POLICY IF EXISTS "push_subs_access" ON push_subscriptions;
DROP POLICY IF EXISTS "push_subs_write" ON push_subscriptions;

-- 2. Policy de LEITURA: cliente vê suas próprias + staff vê todas
--    Usa is_staff_user() que é SECURITY DEFINER (bypassa RLS de users)
CREATE POLICY "push_subs_access" ON push_subscriptions
    FOR SELECT TO authenticated
    USING (
      auth.uid()::text = "authUserId"
      OR is_staff_user()
    );

-- 3. Policy de ESCRITA: apenas o próprio cliente pode inserir/atualizar/deletar
--    Staff NÃO pode deletar subscriptions de outros via client-side (segurança).
--    APIs serverless usam service-role key e bypassam RLS.
CREATE POLICY "push_subs_write" ON push_subscriptions
    FOR ALL TO authenticated
    USING (auth.uid()::text = "authUserId")
    WITH CHECK (auth.uid()::text = "authUserId");
