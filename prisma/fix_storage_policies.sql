-- =========================================
-- FIX SUPABASE STORAGE FOR IMAGE UPLOADS
-- Execute this in Supabase SQL Editor
-- =========================================

-- 1. Create the 'avatars' bucket if it doesn't exist
-- Note: This needs to be done via Supabase Dashboard or API
-- Go to Storage > Create new bucket > Name: avatars > Public: true

-- 2. Drop existing policies (if any)
DROP POLICY IF EXISTS "Allow authenticated uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated deletes" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated updates" ON storage.objects;
DROP POLICY IF EXISTS "avatars_insert_policy" ON storage.objects;
DROP POLICY IF EXISTS "avatars_select_policy" ON storage.objects;
DROP POLICY IF EXISTS "avatars_update_policy" ON storage.objects;
DROP POLICY IF EXISTS "avatars_delete_policy" ON storage.objects;

-- 3. Create new policies for the 'avatars' bucket

-- Allow anyone to READ images (public bucket)
CREATE POLICY "avatars_select_policy"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

-- Allow authenticated users to INSERT (upload) images
CREATE POLICY "avatars_insert_policy"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'avatars' 
    AND auth.role() = 'authenticated'
);

-- Allow authenticated users to UPDATE their images
CREATE POLICY "avatars_update_policy"
ON storage.objects FOR UPDATE
USING (
    bucket_id = 'avatars' 
    AND auth.role() = 'authenticated'
);

-- Allow authenticated users to DELETE images
CREATE POLICY "avatars_delete_policy"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'avatars' 
    AND auth.role() = 'authenticated'
);

-- =========================================
-- MANUAL STEP REQUIRED:
-- =========================================
-- 1. Go to Supabase Dashboard > Storage
-- 2. Click "New bucket"
-- 3. Name: avatars
-- 4. Check "Public bucket"
-- 5. Click "Create bucket"
-- 6. Then run this SQL script
-- =========================================
