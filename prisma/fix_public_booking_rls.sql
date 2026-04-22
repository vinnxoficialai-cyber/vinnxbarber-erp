-- ============================================================
-- FIX: Agendamento do Site Público — RLS calendar_events
--
-- PROBLEMA: A policy atual bloqueava INSERT de clientes
-- autenticados via site público (código 42501 / 401)
--
-- CAUSA: Policies conflitantes + falta de WITH CHECK para INSERT
-- Políticas existentes usam USING sem WITH CHECK, o que bloqueia
-- INSERT mesmo para usuários autenticados.
--
-- SOLUÇÃO: Política explícita que permite INSERT de usuários
-- autenticados via Supabase Auth (clientes do site público).
--
-- Execute no SQL Editor do Supabase:
-- https://supabase.com/dashboard/project/_/sql
-- ============================================================

-- Remove todas as policies existentes de calendar_events
-- (podem estar em conflito entre si)
DROP POLICY IF EXISTS "Allow all for calendar_events"        ON calendar_events;
DROP POLICY IF EXISTS "Enable all for authenticated users"   ON calendar_events;
DROP POLICY IF EXISTS "Enable all for authenticated"         ON calendar_events;
DROP POLICY IF EXISTS "calendar_events_all"                  ON calendar_events;
DROP POLICY IF EXISTS "Authenticated access to calendar_events" ON calendar_events;

-- ============================================================
-- Políticas novas e corretas
-- ============================================================

-- SELECT: qualquer usuário autenticado pode ler eventos
-- (ERP staff e clientes do site público)
CREATE POLICY "ps_calendar_events_select" ON calendar_events
  FOR SELECT TO authenticated
  USING (true);

-- INSERT: qualquer usuário autenticado pode criar agendamentos
-- Inclui clientes do site público (auth.uid() é não-nulo)
CREATE POLICY "ps_calendar_events_insert" ON calendar_events
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- UPDATE: qualquer usuário autenticado pode atualizar
CREATE POLICY "ps_calendar_events_update" ON calendar_events
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

-- DELETE: qualquer usuário autenticado pode deletar
CREATE POLICY "ps_calendar_events_delete" ON calendar_events
  FOR DELETE TO authenticated
  USING (true);

-- ============================================================
-- Verificação
-- ============================================================
SELECT
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'calendar_events'
ORDER BY policyname;
