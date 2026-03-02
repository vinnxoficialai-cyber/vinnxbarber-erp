-- ============================================
-- SCRIPT DEFINITIVO DE CORREÇÃO COMPLETA
-- Execute TUDO no Supabase SQL Editor
-- ============================================

-- ============================================
-- PARTE 1: CRIAR TABELAS FALTANTES
-- ============================================

-- 1. PERSONAL_TASKS (Tarefas Pessoais)
CREATE TABLE IF NOT EXISTS "personal_tasks" (
    "id" SERIAL PRIMARY KEY,
    "text" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'TODAY',
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "assigneeId" TEXT REFERENCES "users"("id") ON DELETE SET NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. SERVICES (Catálogo de Serviços)
CREATE TABLE IF NOT EXISTS "services" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "type" TEXT NOT NULL DEFAULT 'RECURRING',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. PIPELINE_NOTES (Notas do Pipeline CRM)
CREATE TABLE IF NOT EXISTS "pipeline_notes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT NOT NULL REFERENCES "clients"("id") ON DELETE CASCADE,
    "note" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 4. PROJECT_TASKS (Tarefas do Kanban)
CREATE TABLE IF NOT EXISTS "project_tasks" (
    "id" SERIAL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "clientName" TEXT,
    "clientPhone" TEXT,
    "segment" TEXT,
    "deadline" TIMESTAMP(3),
    "daysLeft" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'TODO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- PARTE 2: ADICIONAR COLUNAS FALTANTES EM TABELAS EXISTENTES
-- ============================================

-- Adicionar clientName em projects (se não existir)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='projects' AND column_name='clientName') THEN
        ALTER TABLE "projects" ADD COLUMN "clientName" TEXT;
    END IF;
END $$;

-- Adicionar notes em client_interactions (se não existir, para substituir description)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='client_interactions' AND column_name='notes') THEN
        ALTER TABLE "client_interactions" ADD COLUMN "notes" TEXT;
    END IF;
END $$;

-- Adicionar currentValue em goals (para compatibilidade)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='goals' AND column_name='currentValue') THEN
        ALTER TABLE "goals" ADD COLUMN "currentValue" DECIMAL(12,2) DEFAULT 0;
    END IF;
END $$;

-- Adicionar breakMinutes em time_entries (para compatibilidade)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='time_entries' AND column_name='breakMinutes') THEN
        ALTER TABLE "time_entries" ADD COLUMN "breakMinutes" INTEGER DEFAULT 0;
    END IF;
END $$;

-- Adicionar employeeId como alias para teamMemberId em time_entries
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='time_entries' AND column_name='employeeId') THEN
        ALTER TABLE "time_entries" ADD COLUMN "employeeId" TEXT;
    END IF;
END $$;

-- ============================================
-- PARTE 3: HABILITAR RLS EM TODAS AS TABELAS
-- ============================================

ALTER TABLE personal_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_tasks ENABLE ROW LEVEL SECURITY;

-- ============================================
-- PARTE 4: CRIAR POLÍTICAS RLS PERMISSIVAS
-- ============================================

-- Personal Tasks
DROP POLICY IF EXISTS "Enable all for authenticated users" ON personal_tasks;
CREATE POLICY "Enable all for authenticated users" ON personal_tasks
    FOR ALL USING (auth.role() = 'authenticated');

-- Services
DROP POLICY IF EXISTS "Enable all for authenticated users" ON services;
CREATE POLICY "Enable all for authenticated users" ON services
    FOR ALL USING (auth.role() = 'authenticated');

-- Pipeline Notes
DROP POLICY IF EXISTS "Enable all for authenticated users" ON pipeline_notes;
CREATE POLICY "Enable all for authenticated users" ON pipeline_notes
    FOR ALL USING (auth.role() = 'authenticated');

-- Project Tasks
DROP POLICY IF EXISTS "Enable all for authenticated users" ON project_tasks;
CREATE POLICY "Enable all for authenticated users" ON project_tasks
    FOR ALL USING (auth.role() = 'authenticated');

-- ============================================
-- PARTE 5: GARANTIR QUE TABELAS EXISTENTES TÊM RLS CONFIGURADO
-- ============================================

-- Users
DROP POLICY IF EXISTS "Enable all for authenticated" ON users;
CREATE POLICY "Enable all for authenticated" ON users
    FOR ALL USING (auth.role() = 'authenticated');

-- Clients
DROP POLICY IF EXISTS "Enable all for authenticated" ON clients;
CREATE POLICY "Enable all for authenticated" ON clients
    FOR ALL USING (auth.role() = 'authenticated');

-- Contracts
DROP POLICY IF EXISTS "Enable all for authenticated" ON contracts;
CREATE POLICY "Enable all for authenticated" ON contracts
    FOR ALL USING (auth.role() = 'authenticated');

-- Projects
DROP POLICY IF EXISTS "Enable all for authenticated" ON projects;
CREATE POLICY "Enable all for authenticated" ON projects
    FOR ALL USING (auth.role() = 'authenticated');

-- Transactions
DROP POLICY IF EXISTS "Enable all for authenticated" ON transactions;
CREATE POLICY "Enable all for authenticated" ON transactions
    FOR ALL USING (auth.role() = 'authenticated');

-- Calendar Events
DROP POLICY IF EXISTS "Enable all for authenticated" ON calendar_events;
CREATE POLICY "Enable all for authenticated" ON calendar_events
    FOR ALL USING (auth.role() = 'authenticated');

-- Vacations
DROP POLICY IF EXISTS "Enable all for authenticated" ON vacations;
CREATE POLICY "Enable all for authenticated" ON vacations
    FOR ALL USING (auth.role() = 'authenticated');

-- Time Entries
DROP POLICY IF EXISTS "Enable all for authenticated" ON time_entries;
CREATE POLICY "Enable all for authenticated" ON time_entries
    FOR ALL USING (auth.role() = 'authenticated');

-- Evaluations
DROP POLICY IF EXISTS "Enable all for authenticated" ON evaluations;
CREATE POLICY "Enable all for authenticated" ON evaluations
    FOR ALL USING (auth.role() = 'authenticated');

-- Service Credentials
DROP POLICY IF EXISTS "Enable all for authenticated" ON service_credentials;
CREATE POLICY "Enable all for authenticated" ON service_credentials
    FOR ALL USING (auth.role() = 'authenticated');

-- Goals
DROP POLICY IF EXISTS "Enable all for authenticated" ON goals;
CREATE POLICY "Enable all for authenticated" ON goals
    FOR ALL USING (auth.role() = 'authenticated');

-- Bank Accounts
DROP POLICY IF EXISTS "Enable all for authenticated" ON bank_accounts;
CREATE POLICY "Enable all for authenticated" ON bank_accounts
    FOR ALL USING (auth.role() = 'authenticated');

-- Budgets
DROP POLICY IF EXISTS "Enable all for authenticated" ON budgets;
CREATE POLICY "Enable all for authenticated" ON budgets
    FOR ALL USING (auth.role() = 'authenticated');

-- Commissions
DROP POLICY IF EXISTS "Enable all for authenticated" ON commissions;
CREATE POLICY "Enable all for authenticated" ON commissions
    FOR ALL USING (auth.role() = 'authenticated');

-- Withdrawals
DROP POLICY IF EXISTS "Enable all for authenticated" ON withdrawals;
CREATE POLICY "Enable all for authenticated" ON withdrawals
    FOR ALL USING (auth.role() = 'authenticated');

-- Pipeline Stages
DROP POLICY IF EXISTS "Enable all for authenticated" ON pipeline_stages;
CREATE POLICY "Enable all for authenticated" ON pipeline_stages
    FOR ALL USING (auth.role() = 'authenticated');

-- Client Interactions
DROP POLICY IF EXISTS "Enable all for authenticated" ON client_interactions;
CREATE POLICY "Enable all for authenticated" ON client_interactions
    FOR ALL USING (auth.role() = 'authenticated');

-- Team Members
DROP POLICY IF EXISTS "Enable all for authenticated" ON team_members;
CREATE POLICY "Enable all for authenticated" ON team_members
    FOR ALL USING (auth.role() = 'authenticated');

-- Tasks
DROP POLICY IF EXISTS "Enable all for authenticated" ON tasks;
CREATE POLICY "Enable all for authenticated" ON tasks
    FOR ALL USING (auth.role() = 'authenticated');

-- ============================================
-- PRONTO! Execute e depois faça logout/login
-- ============================================
