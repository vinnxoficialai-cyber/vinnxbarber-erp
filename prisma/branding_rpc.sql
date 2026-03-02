-- ============================================
-- FUNÇÃO RPC PÚBLICA: Branding da Empresa
-- Retorna nome e logo da empresa SEM precisar de login
-- Execute este script no Supabase SQL Editor
-- ============================================

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS get_company_branding();

-- Create function with SECURITY DEFINER to bypass RLS
CREATE OR REPLACE FUNCTION get_company_branding()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COALESCE(
    jsonb_build_object(
      'name', COALESCE(company->>'name', 'VINNX ERP'),
      'logo', COALESCE(company->>'logo', '')
    ),
    '{"name": "VINNX ERP", "logo": ""}'::jsonb
  )
  FROM app_settings
  LIMIT 1;
$$;

-- Grant access to anonymous users (before login)
GRANT EXECUTE ON FUNCTION get_company_branding() TO anon;
-- Also grant to authenticated users
GRANT EXECUTE ON FUNCTION get_company_branding() TO authenticated;

-- Verify
SELECT get_company_branding() as branding;
