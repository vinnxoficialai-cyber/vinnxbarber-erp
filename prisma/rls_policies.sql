-- ============================================
-- VINNX ERP - Row Level Security (RLS) Policies
-- ============================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE vacations ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_interactions ENABLE ROW LEVEL SECURITY;

-- ============================================
-- USERS TABLE POLICIES
-- ============================================

-- Users can read all users (for team visibility)
CREATE POLICY "Users can view all users" ON users
  FOR SELECT USING (true);

-- Users can update their own profile
CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (auth.uid()::text = id);

-- Only admins can insert new users
CREATE POLICY "Admins can insert users" ON users
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid()::text AND role = 'ADMIN'
    )
  );

-- Only admins can delete users
CREATE POLICY "Admins can delete users" ON users
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid()::text AND role = 'ADMIN'
    )
  );

-- ============================================
-- CLIENTS TABLE POLICIES
-- ============================================

-- All authenticated users can view clients
CREATE POLICY "Users can view all clients" ON clients
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- All authenticated users can insert clients
CREATE POLICY "Users can insert clients" ON clients
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- All authenticated users can update clients
CREATE POLICY "Users can update clients" ON clients
  FOR UPDATE USING (auth.uid() IS NOT NULL);

-- Only admins and managers can delete clients
CREATE POLICY "Admins and managers can delete clients" ON clients
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid()::text AND role IN ('ADMIN', 'MANAGER')
    )
  );

-- ============================================
-- CONTRACTS TABLE POLICIES
-- ============================================

CREATE POLICY "Users can view all contracts" ON contracts
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can insert contracts" ON contracts
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update contracts" ON contracts
  FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins and managers can delete contracts" ON contracts
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid()::text AND role IN ('ADMIN', 'MANAGER')
    )
  );

-- ============================================
-- TRANSACTIONS TABLE POLICIES
-- ============================================

CREATE POLICY "Users can view all transactions" ON transactions
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can insert transactions" ON transactions
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update transactions" ON transactions
  FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can delete transactions" ON transactions
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid()::text AND role = 'ADMIN'
    )
  );

-- ============================================
-- PROJECTS TABLE POLICIES
-- ============================================

CREATE POLICY "Users can view all projects" ON projects
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can insert projects" ON projects
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update projects" ON projects
  FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins and managers can delete projects" ON projects
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid()::text AND role IN ('ADMIN', 'MANAGER')
    )
  );

-- ============================================
-- TASKS TABLE POLICIES
-- ============================================

CREATE POLICY "Users can view all tasks" ON tasks
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can insert tasks" ON tasks
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update tasks" ON tasks
  FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete own tasks" ON tasks
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- ============================================
-- TEAM MEMBERS TABLE POLICIES
-- ============================================

CREATE POLICY "Users can view all team members" ON team_members
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can insert team members" ON team_members
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid()::text AND role = 'ADMIN'
    )
  );

CREATE POLICY "Admins can update team members" ON team_members
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid()::text AND role = 'ADMIN'
    )
  );

CREATE POLICY "Admins can delete team members" ON team_members
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid()::text AND role = 'ADMIN'
    )
  );

-- ============================================
-- OTHER TABLES - Basic Authenticated Access
-- ============================================

-- Calendar Events
CREATE POLICY "Authenticated access to calendar_events" ON calendar_events
  FOR ALL USING (auth.uid() IS NOT NULL);

-- Vacations
CREATE POLICY "Authenticated access to vacations" ON vacations
  FOR ALL USING (auth.uid() IS NOT NULL);

-- Time Entries
CREATE POLICY "Authenticated access to time_entries" ON time_entries
  FOR ALL USING (auth.uid() IS NOT NULL);

-- Evaluations
CREATE POLICY "Authenticated access to evaluations" ON evaluations
  FOR ALL USING (auth.uid() IS NOT NULL);

-- Service Credentials
CREATE POLICY "Authenticated access to service_credentials" ON service_credentials
  FOR ALL USING (auth.uid() IS NOT NULL);

-- Goals
CREATE POLICY "Authenticated access to goals" ON goals
  FOR ALL USING (auth.uid() IS NOT NULL);

-- Bank Accounts
CREATE POLICY "Authenticated access to bank_accounts" ON bank_accounts
  FOR ALL USING (auth.uid() IS NOT NULL);

-- Budgets
CREATE POLICY "Authenticated access to budgets" ON budgets
  FOR ALL USING (auth.uid() IS NOT NULL);

-- Commissions
CREATE POLICY "Authenticated access to commissions" ON commissions
  FOR ALL USING (auth.uid() IS NOT NULL);

-- Withdrawals
CREATE POLICY "Authenticated access to withdrawals" ON withdrawals
  FOR ALL USING (auth.uid() IS NOT NULL);

-- Pipeline Stages
CREATE POLICY "Authenticated access to pipeline_stages" ON pipeline_stages
  FOR ALL USING (auth.uid() IS NOT NULL);

-- Client Interactions
CREATE POLICY "Authenticated access to client_interactions" ON client_interactions
  FOR ALL USING (auth.uid() IS NOT NULL);
