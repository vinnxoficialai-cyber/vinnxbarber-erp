-- ============================================================
-- VINNX Barber — Enterprise: Client Reviews
-- ============================================================
-- ALREADY APPLIED TO SUPABASE (2026-02-27)

-- 1. Client Reviews Table
CREATE TABLE IF NOT EXISTS client_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "clientId" TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    "barberId" TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    "comandaId" TEXT,
    rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment TEXT,
    tags TEXT[] DEFAULT '{}',
    "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Enable RLS
ALTER TABLE client_reviews ENABLE ROW LEVEL SECURITY;

-- 3. Policies
DROP POLICY IF EXISTS "Authenticated users can read client_reviews" ON client_reviews;
CREATE POLICY "Authenticated users can read client_reviews"
  ON client_reviews FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert client_reviews" ON client_reviews;
CREATE POLICY "Authenticated users can insert client_reviews"
  ON client_reviews FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_client_reviews_barber ON client_reviews("barberId");
CREATE INDEX IF NOT EXISTS idx_client_reviews_client ON client_reviews("clientId");
