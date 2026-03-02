-- =========================================
-- CREATE ADMIN USER IN USERS TABLE
-- Execute this in Supabase SQL Editor
-- =========================================

-- Insert admin user (using the Auth ID from the JSON you provided)
INSERT INTO users (id, email, name, role, password, "updatedAt")
VALUES (
    '7a368796-50df-4d3a-aacb-079553e05425',
    'marcos@gmail.com',
    'Marcos Admin',
    'ADMIN',
    '1234ABC',
    NOW()
);

-- Also create team_member entry
INSERT INTO team_members (id, "userId", "baseSalary", "commissionRate", "joinDate", "updatedAt")
VALUES (
    gen_random_uuid(),
    '7a368796-50df-4d3a-aacb-079553e05425',
    0,
    0.20,
    NOW(),
    NOW()
);

-- =========================================
-- Done! Now you can login with:
-- Email: marcos@gmail.com
-- Password: 1234ABC
-- =========================================
