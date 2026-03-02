-- ============================================
-- FIX RLS (Row Level Security) POLICIES
-- ============================================
-- Execute este script no SQL Editor do Supabase:
-- https://supabase.com/dashboard/project/auvqsjbtgtwklqzwxqce/sql

-- IMPORTANTE: Este script configura políticas permissivas para desenvolvimento.
-- Em produção, você deve usar políticas mais restritivas baseadas no usuário logado.

-- ============================================
-- CALENDAR_EVENTS
-- ============================================
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

-- Remove políticas existentes
DROP POLICY IF EXISTS "Allow all for calendar_events" ON calendar_events;
DROP POLICY IF EXISTS "Enable all for authenticated users" ON calendar_events;

-- Cria política permissiva para todas as operações
CREATE POLICY "Allow all for calendar_events" ON calendar_events
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- ============================================
-- BANK_ACCOUNTS
-- ============================================
ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for bank_accounts" ON bank_accounts;
DROP POLICY IF EXISTS "Enable all for authenticated users" ON bank_accounts;

CREATE POLICY "Allow all for bank_accounts" ON bank_accounts
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- ============================================
-- PERSONAL_TASKS (já deve funcionar, mas garantir)
-- ============================================
ALTER TABLE personal_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for personal_tasks" ON personal_tasks;

CREATE POLICY "Allow all for personal_tasks" ON personal_tasks
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- ============================================
-- TRANSACTIONS
-- ============================================
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for transactions" ON transactions;

CREATE POLICY "Allow all for transactions" ON transactions
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- ============================================
-- TEAM_MEMBERS
-- ============================================
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for team_members" ON team_members;

CREATE POLICY "Allow all for team_members" ON team_members
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- ============================================
-- CLIENTS
-- ============================================
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for clients" ON clients;

CREATE POLICY "Allow all for clients" ON clients
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- ============================================
-- CONTRACTS
-- ============================================
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for contracts" ON contracts;

CREATE POLICY "Allow all for contracts" ON contracts
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- ============================================
-- PROJECTS
-- ============================================
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for projects" ON projects;

CREATE POLICY "Allow all for projects" ON projects
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- ============================================
-- TASKS
-- ============================================
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for tasks" ON tasks;

CREATE POLICY "Allow all for tasks" ON tasks
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- ============================================
-- BUDGETS
-- ============================================
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for budgets" ON budgets;

CREATE POLICY "Allow all for budgets" ON budgets
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- ============================================
-- VACATIONS
-- ============================================
ALTER TABLE vacations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for vacations" ON vacations;

CREATE POLICY "Allow all for vacations" ON vacations
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- ============================================
-- TIME_ENTRIES
-- ============================================
ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for time_entries" ON time_entries;

CREATE POLICY "Allow all for time_entries" ON time_entries
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- ============================================
-- EVALUATIONS
-- ============================================
ALTER TABLE evaluations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for evaluations" ON evaluations;

CREATE POLICY "Allow all for evaluations" ON evaluations
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- ============================================
-- GOALS
-- ============================================
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for goals" ON goals;

CREATE POLICY "Allow all for goals" ON goals
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- ============================================
-- COMMISSIONS
-- ============================================
ALTER TABLE commissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for commissions" ON commissions;

CREATE POLICY "Allow all for commissions" ON commissions
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- ============================================
-- WITHDRAWALS
-- ============================================
ALTER TABLE withdrawals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for withdrawals" ON withdrawals;

CREATE POLICY "Allow all for withdrawals" ON withdrawals
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- ============================================
-- SERVICE_CREDENTIALS
-- ============================================
ALTER TABLE service_credentials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for service_credentials" ON service_credentials;

CREATE POLICY "Allow all for service_credentials" ON service_credentials
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- ============================================
-- SYSTEM_NOTIFICATIONS
-- ============================================
ALTER TABLE system_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for system_notifications" ON system_notifications;

CREATE POLICY "Allow all for system_notifications" ON system_notifications
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- ============================================
-- APP_SETTINGS
-- ============================================
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for app_settings" ON app_settings;

CREATE POLICY "Allow all for app_settings" ON app_settings
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- ============================================
-- ROLE_PERMISSIONS
-- ============================================
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for role_permissions" ON role_permissions;

CREATE POLICY "Allow all for role_permissions" ON role_permissions
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- ============================================
-- PIPELINE_STAGES
-- ============================================
ALTER TABLE pipeline_stages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for pipeline_stages" ON pipeline_stages;

CREATE POLICY "Allow all for pipeline_stages" ON pipeline_stages
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- ============================================
-- CLIENT_INTERACTIONS
-- ============================================
ALTER TABLE client_interactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for client_interactions" ON client_interactions;

CREATE POLICY "Allow all for client_interactions" ON client_interactions
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- ============================================
-- USERS (especial - garante que auth funcione)
-- ============================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for users" ON users;

CREATE POLICY "Allow all for users" ON users
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Verificação final
SELECT 'RLS policies created successfully!' as result;
