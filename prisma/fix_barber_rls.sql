-- ============================================================
-- FIX: Barbeiros não aparecendo no PublicSite (/#/site)
--
-- CAUSA RAIZ: As policies RLS usavam role = 'Barber' mas o
-- enum "UserRole" define o valor como 'BARBER' (uppercase).
--
-- NOTA: role é um ENUM "UserRole", não TEXT.
-- Comparar diretamente com o valor do enum.
--
-- ✅ EXECUTADO COM SUCESSO em 2026-04-16
-- ============================================================

DROP POLICY IF EXISTS "ps_anon_read_barbers" ON users;
DROP POLICY IF EXISTS "ps_client_read_barbers" ON users;

CREATE POLICY "ps_anon_read_barbers" ON users
  FOR SELECT TO anon
  USING (role = 'BARBER');

CREATE POLICY "ps_client_read_barbers" ON users
  FOR SELECT TO authenticated
  USING (NOT public.is_staff() AND role = 'BARBER');
