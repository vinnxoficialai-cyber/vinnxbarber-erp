-- =========================================
-- RESET USERS AND CREATE ADMIN
-- Execute this in Supabase SQL Editor
-- =========================================

-- 1. Delete all team_members (foreign key to users)
DELETE FROM team_members;

-- 2. Delete all users from the users table
DELETE FROM users;

-- 3. Delete all auth users (requires admin access)
-- Note: This might need to be done via Supabase Dashboard > Authentication > Users
-- Or you can try:
DELETE FROM auth.users;

-- =========================================
-- AFTER RUNNING THIS SQL:
-- =========================================
-- Go to Supabase Dashboard > Authentication > Users
-- Delete any remaining users manually if the DELETE failed
-- 
-- Then use the ERP panel to create the new admin:
-- Email: marcos@gmail.com
-- Senha: 1234ABC
-- Role: Admin
-- =========================================
