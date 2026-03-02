-- ============================================
-- AUDIT LOG & SOFT DELETE MIGRATIONS
-- Execute este script no Supabase SQL Editor
-- ============================================

-- ============================================
-- 1. AUDIT LOG TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT,  -- TEXT to match users.id type
    user_email TEXT,
    action TEXT NOT NULL, -- 'CREATE', 'UPDATE', 'DELETE'
    table_name TEXT NOT NULL,
    record_id TEXT NOT NULL,
    old_data JSONB,
    new_data JSONB,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table ON audit_logs(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);

-- RLS for audit logs (only admins can read, system can write)
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_logs_select" ON audit_logs FOR SELECT
USING (get_user_role(auth.uid()) = 'ADMIN');

-- Allow insert for all authenticated (needed for logging)
CREATE POLICY "audit_logs_insert" ON audit_logs FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

-- ============================================
-- 2. SOFT DELETE - Add deleted_at columns
-- ============================================

-- Users
ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

-- Team Members
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

-- Clients
ALTER TABLE clients ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

-- Contracts
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

-- Projects
ALTER TABLE projects ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

-- Transactions
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

-- ============================================
-- 3. SOFT DELETE INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_users_deleted ON users(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_team_members_deleted ON team_members(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_clients_deleted ON clients(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_contracts_deleted ON contracts(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_projects_deleted ON projects(deleted_at) WHERE deleted_at IS NULL;

-- ============================================
-- 4. AUDIT TRIGGER FUNCTION
-- ============================================
CREATE OR REPLACE FUNCTION log_audit_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO audit_logs (user_id, action, table_name, record_id, new_data)
        VALUES (auth.uid()::text, 'CREATE', TG_TABLE_NAME, NEW.id::text, to_jsonb(NEW));
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO audit_logs (user_id, action, table_name, record_id, old_data, new_data)
        VALUES (auth.uid()::text, 'UPDATE', TG_TABLE_NAME, NEW.id::text, to_jsonb(OLD), to_jsonb(NEW));
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO audit_logs (user_id, action, table_name, record_id, old_data)
        VALUES (auth.uid()::text, 'DELETE', TG_TABLE_NAME, OLD.id::text, to_jsonb(OLD));
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$;

-- ============================================
-- 5. APPLY TRIGGERS TO CRITICAL TABLES
-- ============================================

-- Users audit
DROP TRIGGER IF EXISTS users_audit ON users;
CREATE TRIGGER users_audit
    AFTER INSERT OR UPDATE OR DELETE ON users
    FOR EACH ROW EXECUTE FUNCTION log_audit_event();

-- Team Members audit
DROP TRIGGER IF EXISTS team_members_audit ON team_members;
CREATE TRIGGER team_members_audit
    AFTER INSERT OR UPDATE OR DELETE ON team_members
    FOR EACH ROW EXECUTE FUNCTION log_audit_event();

-- Clients audit
DROP TRIGGER IF EXISTS clients_audit ON clients;
CREATE TRIGGER clients_audit
    AFTER INSERT OR UPDATE OR DELETE ON clients
    FOR EACH ROW EXECUTE FUNCTION log_audit_event();

-- Contracts audit
DROP TRIGGER IF EXISTS contracts_audit ON contracts;
CREATE TRIGGER contracts_audit
    AFTER INSERT OR UPDATE OR DELETE ON contracts
    FOR EACH ROW EXECUTE FUNCTION log_audit_event();

-- Transactions audit
DROP TRIGGER IF EXISTS transactions_audit ON transactions;
CREATE TRIGGER transactions_audit
    AFTER INSERT OR UPDATE OR DELETE ON transactions
    FOR EACH ROW EXECUTE FUNCTION log_audit_event();

-- App Settings audit
DROP TRIGGER IF EXISTS app_settings_audit ON app_settings;
CREATE TRIGGER app_settings_audit
    AFTER INSERT OR UPDATE OR DELETE ON app_settings
    FOR EACH ROW EXECUTE FUNCTION log_audit_event();

-- ============================================
-- VERIFICATION
-- ============================================
SELECT 'Audit log and soft delete migrations completed!' as result;
