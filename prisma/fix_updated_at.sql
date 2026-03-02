-- ============================================
-- FIX URGENTE: Adicionar DEFAULT em updatedAt
-- Execute IMEDIATAMENTE no Supabase SQL Editor
-- ============================================

-- Este script corrige o problema de "null value in column 'updatedAt' violates not-null constraint"
-- Adiciona DEFAULT CURRENT_TIMESTAMP em TODAS as tabelas que têm updatedAt

-- USERS
ALTER TABLE users ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;
UPDATE users SET "updatedAt" = CURRENT_TIMESTAMP WHERE "updatedAt" IS NULL;

-- CLIENTS
ALTER TABLE clients ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;
UPDATE clients SET "updatedAt" = CURRENT_TIMESTAMP WHERE "updatedAt" IS NULL;

-- CONTRACTS
ALTER TABLE contracts ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;
UPDATE contracts SET "updatedAt" = CURRENT_TIMESTAMP WHERE "updatedAt" IS NULL;

-- PROJECTS
ALTER TABLE projects ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;
UPDATE projects SET "updatedAt" = CURRENT_TIMESTAMP WHERE "updatedAt" IS NULL;

-- TASKS
ALTER TABLE tasks ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;
UPDATE tasks SET "updatedAt" = CURRENT_TIMESTAMP WHERE "updatedAt" IS NULL;

-- TRANSACTIONS
ALTER TABLE transactions ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;
UPDATE transactions SET "updatedAt" = CURRENT_TIMESTAMP WHERE "updatedAt" IS NULL;

-- CALENDAR_EVENTS
ALTER TABLE calendar_events ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;
UPDATE calendar_events SET "updatedAt" = CURRENT_TIMESTAMP WHERE "updatedAt" IS NULL;

-- VACATIONS
ALTER TABLE vacations ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;
UPDATE vacations SET "updatedAt" = CURRENT_TIMESTAMP WHERE "updatedAt" IS NULL;

-- TIME_ENTRIES
ALTER TABLE time_entries ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;
UPDATE time_entries SET "updatedAt" = CURRENT_TIMESTAMP WHERE "updatedAt" IS NULL;

-- SERVICE_CREDENTIALS
ALTER TABLE service_credentials ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;
UPDATE service_credentials SET "updatedAt" = CURRENT_TIMESTAMP WHERE "updatedAt" IS NULL;

-- TEAM_MEMBERS
ALTER TABLE team_members ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;
UPDATE team_members SET "updatedAt" = CURRENT_TIMESTAMP WHERE "updatedAt" IS NULL;

-- GOALS (se tiver updatedAt)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name='goals' AND column_name='updatedAt') THEN
        EXECUTE 'ALTER TABLE goals ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP';
    END IF;
END $$;

-- BANK_ACCOUNTS
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name='bank_accounts' AND column_name='updatedAt') THEN
        EXECUTE 'ALTER TABLE bank_accounts ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP';
    END IF;
END $$;

-- BUDGETS
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name='budgets' AND column_name='updatedAt') THEN
        EXECUTE 'ALTER TABLE budgets ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP';
    END IF;
END $$;

-- COMMISSIONS
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name='commissions' AND column_name='updatedAt') THEN
        EXECUTE 'ALTER TABLE commissions ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP';
    END IF;
END $$;

-- WITHDRAWALS
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name='withdrawals' AND column_name='updatedAt') THEN
        EXECUTE 'ALTER TABLE withdrawals ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP';
    END IF;
END $$;

-- PIPELINE_STAGES
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name='pipeline_stages' AND column_name='updatedAt') THEN
        EXECUTE 'ALTER TABLE pipeline_stages ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP';
    END IF;
END $$;

-- CLIENT_INTERACTIONS
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name='client_interactions' AND column_name='updatedAt') THEN
        EXECUTE 'ALTER TABLE client_interactions ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP';
    END IF;
END $$;

-- ============================================
-- PRONTO! Todas as tabelas agora têm DEFAULT
-- ============================================
