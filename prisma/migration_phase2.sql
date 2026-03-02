-- Create app_settings table (Singleton)
CREATE TABLE IF NOT EXISTS app_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company JSONB DEFAULT '{}'::jsonb,
    hr JSONB DEFAULT '{}'::jsonb,
    financial JSONB DEFAULT '{}'::jsonb,
    projects JSONB DEFAULT '{}'::jsonb,
    notifications JSONB DEFAULT '{}'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ensure only one row exists
CREATE UNIQUE INDEX IF NOT EXISTS app_settings_singleton_idx ON app_settings ((TRUE));

-- Create role_permissions table
CREATE TABLE IF NOT EXISTS role_permissions (
    role TEXT PRIMARY KEY, -- 'ADMIN', 'MANAGER', 'SALES', 'SUPPORT'
    permissions JSONB DEFAULT '{}'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create system_notifications table
CREATE TABLE IF NOT EXISTS system_notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type TEXT NOT NULL, -- 'info', 'warning', 'success', 'error'
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    read BOOLEAN DEFAULT FALSE,
    action_label TEXT,
    action_path TEXT,
    user_id UUID REFERENCES auth.users(id), -- Optional: specific user
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create pipeline_stages table (if not exists)
CREATE TABLE IF NOT EXISTS pipeline_stages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    stage TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(client_id)
);

-- Create pipeline_notes table (if not exists)
CREATE TABLE IF NOT EXISTS pipeline_notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    note TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(client_id)
);

-- Seed initial permissions if empty (Example)
INSERT INTO role_permissions (role, permissions) VALUES
('ADMIN', '{"all": true}'),
('MANAGER', '{"view_financial": true, "edit_team": true}'),
('SALES', '{"view_financial": false, "view_clients": true}'),
('SUPPORT', '{"view_financial": false, "view_tickets": true}')
ON CONFLICT (role) DO NOTHING;

-- Seed initial app_settings if empty
INSERT INTO app_settings (id) VALUES (uuid_generate_v4())
ON CONFLICT DO NOTHING;
