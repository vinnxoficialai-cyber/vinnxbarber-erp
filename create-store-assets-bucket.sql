-- =====================================================================
-- VINNX BARBER — Criar bucket 'store-assets' no Supabase Storage
-- Execute este script no SQL Editor do Supabase Dashboard
-- =====================================================================
--
-- ⚠️ IMPORTANTE: O Supabase NÃO permite INSERT direto na tabela
-- storage.buckets via SQL. O bucket DEVE ser criado manualmente
-- pelo Dashboard ANTES de executar este script.
--
-- PASSO 1 (MANUAL — faça antes de rodar este SQL):
--   1. Vá em Storage → New Bucket
--   2. Nome: store-assets
--   3. Public bucket: SIM (marcar checkbox)
--   4. Additional configuration:
--      - File size limit: 5 MB
--      - Allowed MIME types: image/jpeg, image/png, image/webp, image/svg+xml, image/gif, video/mp4
--   5. Clique em "Create bucket"
--
-- PASSO 2: Execute este SQL para criar as policies de acesso.
-- =====================================================================

-- 1. Verificar se o bucket existe (deve retornar 1 linha)
-- Se retornar 0 linhas, volte ao PASSO 1 e crie o bucket manualmente.
SELECT id, name, public, file_size_limit, allowed_mime_types
FROM storage.buckets
WHERE id = 'store-assets';

-- 2. Policies de Storage — Leitura pública
DROP POLICY IF EXISTS "store_assets_public_read" ON storage.objects;
CREATE POLICY "store_assets_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'store-assets');

-- 3. Policies de Storage — Upload para autenticados
DROP POLICY IF EXISTS "store_assets_auth_upload" ON storage.objects;
CREATE POLICY "store_assets_auth_upload"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'store-assets'
    AND auth.role() = 'authenticated'
  );

-- 4. Policies de Storage — Update para autenticados
DROP POLICY IF EXISTS "store_assets_auth_update" ON storage.objects;
CREATE POLICY "store_assets_auth_update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'store-assets'
    AND auth.role() = 'authenticated'
  );

-- 5. Policies de Storage — Delete para autenticados
DROP POLICY IF EXISTS "store_assets_auth_delete" ON storage.objects;
CREATE POLICY "store_assets_auth_delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'store-assets'
    AND auth.role() = 'authenticated'
  );

-- 6. Verificação final — deve retornar 4 policies
SELECT 'POLICIES CRIADAS' AS status, policyname, cmd
FROM pg_policies
WHERE tablename = 'objects' AND schemaname = 'storage'
AND policyname LIKE 'store_assets%'
ORDER BY policyname;
