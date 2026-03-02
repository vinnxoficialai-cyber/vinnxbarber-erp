-- Migration: Add contract-related columns to team_members table
-- This fixes the issue where contractType, paymentPreference, etc. are not persisted

-- Add columns with appropriate defaults
ALTER TABLE team_members 
ADD COLUMN IF NOT EXISTS "contractType" TEXT DEFAULT 'CLT';

ALTER TABLE team_members 
ADD COLUMN IF NOT EXISTS "paymentPreference" TEXT DEFAULT 'Mensal';

ALTER TABLE team_members 
ADD COLUMN IF NOT EXISTS "pixKey" TEXT;

ALTER TABLE team_members 
ADD COLUMN IF NOT EXISTS "bankInfo" JSONB;

ALTER TABLE team_members 
ADD COLUMN IF NOT EXISTS "admissionDate" TIMESTAMP(3);

-- Verify the columns were added
DO $$
BEGIN
    RAISE NOTICE 'Migration complete. Added columns to team_members:';
    RAISE NOTICE '  - contractType (TEXT, default CLT)';
    RAISE NOTICE '  - paymentPreference (TEXT, default Mensal)';
    RAISE NOTICE '  - pixKey (TEXT, nullable)';
    RAISE NOTICE '  - bankInfo (JSONB, nullable)';
    RAISE NOTICE '  - admissionDate (TIMESTAMP, nullable)';
END $$;
