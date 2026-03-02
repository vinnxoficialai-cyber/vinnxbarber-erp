-- =========================================
-- DELETE USER FROM AUTH
-- Execute this in Supabase SQL Editor
-- =========================================

-- Delete a specific user from Supabase Auth by email
DELETE FROM auth.users WHERE email = 'gleyse@gmail.com';

-- =========================================
-- NOTE: After running this, you can recreate 
-- the user "Gleyse" with the same email
-- =========================================
