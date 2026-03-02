-- ============================================
-- POLÍTICAS RLS SEGURAS PARA PRODUÇÃO
-- Execute este script no Supabase SQL Editor
-- ============================================

-- ⚠️ IMPORTANTE: Este script substitui as políticas permissivas 
-- por políticas baseadas em roles e ownership

-- ============================================
-- HELPER FUNCTION: Get user role from users table
-- Cast uuid to text since users.id is stored as TEXT
-- ============================================
CREATE OR REPLACE FUNCTION get_user_role(p_user_id uuid)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT role FROM users WHERE id = p_user_id::text LIMIT 1;
$$;


-- ============================================
-- USERS TABLE
-- ============================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for users" ON users;
DROP POLICY IF EXISTS "users_select" ON users;
DROP POLICY IF EXISTS "users_insert" ON users;
DROP POLICY IF EXISTS "users_update" ON users;
DROP POLICY IF EXISTS "users_delete" ON users;

-- Users can read their own data, Admins can read all
CREATE POLICY "users_select" ON users FOR SELECT
USING (
  auth.uid()::text = id 
  OR get_user_role(auth.uid()) = 'ADMIN'
);

-- Only Admins can create users
CREATE POLICY "users_insert" ON users FOR INSERT
WITH CHECK (get_user_role(auth.uid()) = 'ADMIN');

-- Users can update their own profile, Admins can update anyone
CREATE POLICY "users_update" ON users FOR UPDATE
USING (
  auth.uid()::text = id 
  OR get_user_role(auth.uid()) = 'ADMIN'
);

-- Only Admins can delete users
CREATE POLICY "users_delete" ON users FOR DELETE
USING (get_user_role(auth.uid()) = 'ADMIN');

-- ============================================
-- TEAM_MEMBERS TABLE
-- ============================================
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for team_members" ON team_members;
DROP POLICY IF EXISTS "team_members_select" ON team_members;
DROP POLICY IF EXISTS "team_members_insert" ON team_members;
DROP POLICY IF EXISTS "team_members_update" ON team_members;
DROP POLICY IF EXISTS "team_members_delete" ON team_members;

-- Everyone authenticated can see team members (for UI display)
CREATE POLICY "team_members_select" ON team_members FOR SELECT
USING (auth.role() = 'authenticated');

-- Only Admins can create team members
CREATE POLICY "team_members_insert" ON team_members FOR INSERT
WITH CHECK (get_user_role(auth.uid()) = 'ADMIN');

-- Team members can update their own, Admins can update all
CREATE POLICY "team_members_update" ON team_members FOR UPDATE
USING (
  "userId" = auth.uid()::text 
  OR get_user_role(auth.uid()) = 'ADMIN'
);

-- Only Admins can delete team members
CREATE POLICY "team_members_delete" ON team_members FOR DELETE
USING (get_user_role(auth.uid()) = 'ADMIN');

-- ============================================
-- CLIENTS TABLE
-- ============================================
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for clients" ON clients;
DROP POLICY IF EXISTS "clients_select" ON clients;
DROP POLICY IF EXISTS "clients_insert" ON clients;
DROP POLICY IF EXISTS "clients_update" ON clients;
DROP POLICY IF EXISTS "clients_delete" ON clients;

-- All authenticated users can see clients
CREATE POLICY "clients_select" ON clients FOR SELECT
USING (auth.role() = 'authenticated');

-- Anyone can create clients (Sales, Managers, Admins)
CREATE POLICY "clients_insert" ON clients FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

-- Anyone can update clients
CREATE POLICY "clients_update" ON clients FOR UPDATE
USING (auth.role() = 'authenticated');

-- Only Admins/Managers can delete
CREATE POLICY "clients_delete" ON clients FOR DELETE
USING (get_user_role(auth.uid()) IN ('ADMIN', 'MANAGER'));

-- ============================================
-- CONTRACTS TABLE
-- ============================================
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for contracts" ON contracts;
DROP POLICY IF EXISTS "contracts_select" ON contracts;
DROP POLICY IF EXISTS "contracts_insert" ON contracts;
DROP POLICY IF EXISTS "contracts_update" ON contracts;
DROP POLICY IF EXISTS "contracts_delete" ON contracts;

CREATE POLICY "contracts_select" ON contracts FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "contracts_insert" ON contracts FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "contracts_update" ON contracts FOR UPDATE
USING (auth.role() = 'authenticated');

CREATE POLICY "contracts_delete" ON contracts FOR DELETE
USING (get_user_role(auth.uid()) IN ('ADMIN', 'MANAGER'));

-- ============================================
-- TRANSACTIONS TABLE (Sensitive - Finance)
-- ============================================
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for transactions" ON transactions;
DROP POLICY IF EXISTS "transactions_select" ON transactions;
DROP POLICY IF EXISTS "transactions_insert" ON transactions;
DROP POLICY IF EXISTS "transactions_update" ON transactions;
DROP POLICY IF EXISTS "transactions_delete" ON transactions;

-- Only Admins and Managers can see transactions
CREATE POLICY "transactions_select" ON transactions FOR SELECT
USING (get_user_role(auth.uid()) IN ('ADMIN', 'MANAGER'));

CREATE POLICY "transactions_insert" ON transactions FOR INSERT
WITH CHECK (get_user_role(auth.uid()) IN ('ADMIN', 'MANAGER'));

CREATE POLICY "transactions_update" ON transactions FOR UPDATE
USING (get_user_role(auth.uid()) IN ('ADMIN', 'MANAGER'));

CREATE POLICY "transactions_delete" ON transactions FOR DELETE
USING (get_user_role(auth.uid()) = 'ADMIN');

-- ============================================
-- BANK_ACCOUNTS TABLE (Sensitive)
-- ============================================
ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for bank_accounts" ON bank_accounts;
DROP POLICY IF EXISTS "bank_accounts_select" ON bank_accounts;
DROP POLICY IF EXISTS "bank_accounts_insert" ON bank_accounts;
DROP POLICY IF EXISTS "bank_accounts_update" ON bank_accounts;
DROP POLICY IF EXISTS "bank_accounts_delete" ON bank_accounts;

-- Only Admins and Managers can see/manage bank accounts
CREATE POLICY "bank_accounts_select" ON bank_accounts FOR SELECT
USING (get_user_role(auth.uid()) IN ('ADMIN', 'MANAGER'));

CREATE POLICY "bank_accounts_insert" ON bank_accounts FOR INSERT
WITH CHECK (get_user_role(auth.uid()) = 'ADMIN');

CREATE POLICY "bank_accounts_update" ON bank_accounts FOR UPDATE
USING (get_user_role(auth.uid()) = 'ADMIN');

CREATE POLICY "bank_accounts_delete" ON bank_accounts FOR DELETE
USING (get_user_role(auth.uid()) = 'ADMIN');

-- ============================================
-- SERVICE_CREDENTIALS TABLE (Very Sensitive)
-- ============================================
ALTER TABLE service_credentials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for service_credentials" ON service_credentials;
DROP POLICY IF EXISTS "credentials_select" ON service_credentials;
DROP POLICY IF EXISTS "credentials_insert" ON service_credentials;
DROP POLICY IF EXISTS "credentials_update" ON service_credentials;
DROP POLICY IF EXISTS "credentials_delete" ON service_credentials;

-- Only Admins can manage credentials
CREATE POLICY "credentials_select" ON service_credentials FOR SELECT
USING (get_user_role(auth.uid()) = 'ADMIN');

CREATE POLICY "credentials_insert" ON service_credentials FOR INSERT
WITH CHECK (get_user_role(auth.uid()) = 'ADMIN');

CREATE POLICY "credentials_update" ON service_credentials FOR UPDATE
USING (get_user_role(auth.uid()) = 'ADMIN');

CREATE POLICY "credentials_delete" ON service_credentials FOR DELETE
USING (get_user_role(auth.uid()) = 'ADMIN');

-- ============================================
-- APP_SETTINGS TABLE (Admin only)
-- ============================================
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for app_settings" ON app_settings;
DROP POLICY IF EXISTS "settings_select" ON app_settings;
DROP POLICY IF EXISTS "settings_insert" ON app_settings;
DROP POLICY IF EXISTS "settings_update" ON app_settings;

-- All authenticated can read settings
CREATE POLICY "settings_select" ON app_settings FOR SELECT
USING (auth.role() = 'authenticated');

-- Only Admins can modify settings
CREATE POLICY "settings_insert" ON app_settings FOR INSERT
WITH CHECK (get_user_role(auth.uid()) = 'ADMIN');

CREATE POLICY "settings_update" ON app_settings FOR UPDATE
USING (get_user_role(auth.uid()) = 'ADMIN');

-- ============================================
-- ROLE_PERMISSIONS TABLE (Admin only)
-- ============================================
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for role_permissions" ON role_permissions;
DROP POLICY IF EXISTS "permissions_select" ON role_permissions;
DROP POLICY IF EXISTS "permissions_update" ON role_permissions;

-- All authenticated can read permissions
CREATE POLICY "permissions_select" ON role_permissions FOR SELECT
USING (auth.role() = 'authenticated');

-- Only Admins can modify permissions
CREATE POLICY "permissions_update" ON role_permissions FOR ALL
USING (get_user_role(auth.uid()) = 'ADMIN');

-- ============================================
-- COMMISSIONS TABLE (Sensitive)
-- ============================================
ALTER TABLE commissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for commissions" ON commissions;
DROP POLICY IF EXISTS "commissions_select" ON commissions;
DROP POLICY IF EXISTS "commissions_all" ON commissions;

-- Users can see their own commissions, Admins/Managers see all
CREATE POLICY "commissions_select" ON commissions FOR SELECT
USING (
  "employeeId" = auth.uid()::text
  OR get_user_role(auth.uid()) IN ('ADMIN', 'MANAGER')
);

-- Only Admins can manage commissions
CREATE POLICY "commissions_all" ON commissions FOR ALL
USING (get_user_role(auth.uid()) = 'ADMIN');

-- ============================================
-- WITHDRAWALS TABLE (Sensitive)
-- ============================================
ALTER TABLE withdrawals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for withdrawals" ON withdrawals;
DROP POLICY IF EXISTS "withdrawals_select" ON withdrawals;
DROP POLICY IF EXISTS "withdrawals_all" ON withdrawals;

-- Users can see their own withdrawals, Admins/Managers see all
CREATE POLICY "withdrawals_select" ON withdrawals FOR SELECT
USING (
  "employeeId" = auth.uid()::text
  OR get_user_role(auth.uid()) IN ('ADMIN', 'MANAGER')
);

-- Only Admins can manage withdrawals
CREATE POLICY "withdrawals_all" ON withdrawals FOR ALL
USING (get_user_role(auth.uid()) = 'ADMIN');

-- ============================================
-- OTHER TABLES (General authenticated access)
-- ============================================

-- Calendar Events, Personal Tasks, Projects, etc - general access
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for calendar_events" ON calendar_events;
CREATE POLICY "calendar_events_all" ON calendar_events FOR ALL
USING (auth.role() = 'authenticated');

ALTER TABLE personal_tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for personal_tasks" ON personal_tasks;
CREATE POLICY "personal_tasks_all" ON personal_tasks FOR ALL
USING (auth.role() = 'authenticated');

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for projects" ON projects;
CREATE POLICY "projects_all" ON projects FOR ALL
USING (auth.role() = 'authenticated');

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for tasks" ON tasks;
CREATE POLICY "tasks_all" ON tasks FOR ALL
USING (auth.role() = 'authenticated');

ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for budgets" ON budgets;
CREATE POLICY "budgets_all" ON budgets FOR ALL
USING (auth.role() = 'authenticated');

ALTER TABLE vacations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for vacations" ON vacations;
CREATE POLICY "vacations_all" ON vacations FOR ALL
USING (auth.role() = 'authenticated');

ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for time_entries" ON time_entries;
CREATE POLICY "time_entries_all" ON time_entries FOR ALL
USING (auth.role() = 'authenticated');

ALTER TABLE evaluations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for evaluations" ON evaluations;
CREATE POLICY "evaluations_all" ON evaluations FOR ALL
USING (auth.role() = 'authenticated');

ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for goals" ON goals;
CREATE POLICY "goals_all" ON goals FOR ALL
USING (auth.role() = 'authenticated');

ALTER TABLE system_notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for system_notifications" ON system_notifications;
CREATE POLICY "notifications_all" ON system_notifications FOR ALL
USING (auth.role() = 'authenticated');

ALTER TABLE pipeline_stages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for pipeline_stages" ON pipeline_stages;
CREATE POLICY "pipeline_stages_all" ON pipeline_stages FOR ALL
USING (auth.role() = 'authenticated');

ALTER TABLE client_interactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for client_interactions" ON client_interactions;
CREATE POLICY "client_interactions_all" ON client_interactions FOR ALL
USING (auth.role() = 'authenticated');

-- ============================================
-- ADD INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_team_members_userid ON team_members("userId");
CREATE INDEX IF NOT EXISTS idx_commissions_employeeid ON commissions("employeeId");
CREATE INDEX IF NOT EXISTS idx_withdrawals_employeeid ON withdrawals("employeeId");
CREATE INDEX IF NOT EXISTS idx_contracts_clientid ON contracts("clientId");
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions("date");

-- ============================================
-- VERIFY
-- ============================================
SELECT 'Secure RLS policies created successfully!' as result;
