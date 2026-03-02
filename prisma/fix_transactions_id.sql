-- Fix: transactions.id has no DEFAULT, causing null constraint violations
-- when inserting without an explicit id.
-- Add gen_random_uuid()::TEXT as the default so Postgres auto-generates IDs.

ALTER TABLE transactions
  ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::TEXT;
