-- ============================================================
-- Fix: Add DEFAULT gen_random_uuid()::TEXT to ALL tables
-- that have "id" TEXT NOT NULL without a default value.
-- Only includes tables confirmed to exist in the database.
-- ============================================================

-- Users
ALTER TABLE users
  ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::TEXT;

-- Clients
ALTER TABLE clients
  ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::TEXT;

-- Contracts
ALTER TABLE contracts
  ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::TEXT;

-- Transactions
ALTER TABLE transactions
  ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::TEXT;

-- Projects
ALTER TABLE projects
  ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::TEXT;

-- Tasks
ALTER TABLE tasks
  ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::TEXT;

-- Calendar Events
ALTER TABLE calendar_events
  ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::TEXT;

-- Team Members
ALTER TABLE team_members
  ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::TEXT;

-- Budgets
ALTER TABLE budgets
  ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::TEXT;

-- Bank Accounts
ALTER TABLE bank_accounts
  ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::TEXT;

-- Vacations
ALTER TABLE vacations
  ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::TEXT;

-- Time Entries
ALTER TABLE time_entries
  ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::TEXT;

-- Evaluations
ALTER TABLE evaluations
  ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::TEXT;

-- Service Credentials
ALTER TABLE service_credentials
  ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::TEXT;

-- Goals
ALTER TABLE goals
  ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::TEXT;

-- Commissions
ALTER TABLE commissions
  ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::TEXT;

-- Withdrawals
ALTER TABLE withdrawals
  ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::TEXT;

-- Pipeline Stages
ALTER TABLE pipeline_stages
  ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::TEXT;

-- Client Interactions
ALTER TABLE client_interactions
  ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::TEXT;
