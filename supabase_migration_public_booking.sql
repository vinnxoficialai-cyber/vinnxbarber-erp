-- ===========================================================
-- VINNX BARBER — Public Booking App: Database Migrations
-- Run this script in the Supabase SQL Editor
--
-- ⚠️ IMPORTANT: This enables RLS on existing tables.
-- Staff (ERP) policies are ISOLATED from client policies.
-- ===========================================================

-- 1. ALTER clients — add booking app fields
ALTER TABLE clients ADD COLUMN IF NOT EXISTS "authUserId" UUID REFERENCES auth.users(id);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS "referralCode" TEXT UNIQUE;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS "referralCredits" NUMERIC DEFAULT 0;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS "referralsMade" INTEGER DEFAULT 0;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS "redeemedGoals" JSONB DEFAULT '[]';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS "profilePic" TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS "notificationPreferences" JSONB DEFAULT '{"email":true,"whatsapp":true}';

-- 2. ALTER calendar_events — add client link + booking metadata
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS "clientId" TEXT;
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS "clientName" TEXT;
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS "couponCode" TEXT;
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS "usedInPlan" BOOLEAN DEFAULT false;
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS "usedReferralCredit" BOOLEAN DEFAULT false;
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS "finalPrice" NUMERIC;
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS "rating" INTEGER;
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS "ratingComment" TEXT;

-- 3. CREATE client_reviews table
CREATE TABLE IF NOT EXISTS client_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "clientId" TEXT NOT NULL,
  "barberId" TEXT NOT NULL,
  "calendarEventId" TEXT,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  tags TEXT[],
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE client_reviews ENABLE ROW LEVEL SECURITY;

-- 4. CREATE referral_goals table
CREATE TABLE IF NOT EXISTS referral_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target INTEGER NOT NULL,
  prize TEXT NOT NULL,
  icon TEXT DEFAULT 'gift',
  "serviceId" TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE referral_goals ENABLE ROW LEVEL SECURITY;

-- 5. CREATE coupons table
CREATE TABLE IF NOT EXISTS coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value NUMERIC NOT NULL,
  min_amount NUMERIC DEFAULT 0,
  max_uses INTEGER,
  used_count INTEGER DEFAULT 0,
  valid_from TIMESTAMPTZ DEFAULT NOW(),
  valid_until TIMESTAMPTZ,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;

-- ===========================================================
-- ENABLE RLS on existing tables (safe to run, idempotent)
-- ===========================================================
ALTER TABLE units ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE unit_members ENABLE ROW LEVEL SECURITY;

-- ===========================================================
-- HELPER FUNCTION: is_staff()
-- Returns true if the current authenticated user has a row
-- in the 'users' table (only ERP staff has entries there).
-- Clients are registered in 'clients' table, NOT 'users'.
-- SECURITY DEFINER bypasses RLS for the subquery.
-- ===========================================================
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid()::text);
$$;

-- ===========================================================
-- STAFF POLICIES — Full access ONLY for ERP staff
-- is_staff() ensures clients who sign up via PublicSite
-- cannot modify ERP data (units, services, users, etc.)
-- ===========================================================

DO $$ BEGIN
  -- units: staff full access
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'erp_staff_units') THEN
    CREATE POLICY "erp_staff_units" ON units FOR ALL TO authenticated
      USING (public.is_staff()) WITH CHECK (public.is_staff());
  END IF;
  -- services: staff full access
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'erp_staff_services') THEN
    CREATE POLICY "erp_staff_services" ON services FOR ALL TO authenticated
      USING (public.is_staff()) WITH CHECK (public.is_staff());
  END IF;
  -- users: staff full access
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'erp_staff_users') THEN
    CREATE POLICY "erp_staff_users" ON users FOR ALL TO authenticated
      USING (public.is_staff()) WITH CHECK (public.is_staff());
  END IF;
  -- work_schedules: staff full access
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'erp_staff_schedules') THEN
    CREATE POLICY "erp_staff_schedules" ON work_schedules FOR ALL TO authenticated
      USING (public.is_staff()) WITH CHECK (public.is_staff());
  END IF;
  -- calendar_events: staff full access
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'erp_staff_events') THEN
    CREATE POLICY "erp_staff_events" ON calendar_events FOR ALL TO authenticated
      USING (public.is_staff()) WITH CHECK (public.is_staff());
  END IF;
  -- subscription_plans: staff full access
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'erp_staff_plans') THEN
    CREATE POLICY "erp_staff_plans" ON subscription_plans FOR ALL TO authenticated
      USING (public.is_staff()) WITH CHECK (public.is_staff());
  END IF;
  -- store_settings: staff full access
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'erp_staff_store') THEN
    CREATE POLICY "erp_staff_store" ON store_settings FOR ALL TO authenticated
      USING (public.is_staff()) WITH CHECK (public.is_staff());
  END IF;
  -- clients: staff full access
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'erp_staff_clients') THEN
    CREATE POLICY "erp_staff_clients" ON clients FOR ALL TO authenticated
      USING (public.is_staff()) WITH CHECK (public.is_staff());
  END IF;
  -- subscriptions: staff full access
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'erp_staff_subscriptions') THEN
    CREATE POLICY "erp_staff_subscriptions" ON subscriptions FOR ALL TO authenticated
      USING (public.is_staff()) WITH CHECK (public.is_staff());
  END IF;
  -- client_reviews: staff full access
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'erp_staff_reviews') THEN
    CREATE POLICY "erp_staff_reviews" ON client_reviews FOR ALL TO authenticated
      USING (public.is_staff()) WITH CHECK (public.is_staff());
  END IF;
  -- referral_goals: staff full access
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'erp_staff_goals') THEN
    CREATE POLICY "erp_staff_goals" ON referral_goals FOR ALL TO authenticated
      USING (public.is_staff()) WITH CHECK (public.is_staff());
  END IF;
  -- coupons: staff full access
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'erp_staff_coupons') THEN
    CREATE POLICY "erp_staff_coupons" ON coupons FOR ALL TO authenticated
      USING (public.is_staff()) WITH CHECK (public.is_staff());
  END IF;
  -- unit_members: staff full access
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'erp_staff_unit_members') THEN
    CREATE POLICY "erp_staff_unit_members" ON unit_members FOR ALL TO authenticated
      USING (public.is_staff()) WITH CHECK (public.is_staff());
  END IF;
END $$;

-- ===========================================================
-- PUBLIC (anon) POLICIES — Read-only for booking app
-- These are for the PublicSite when no user is logged in
-- ===========================================================

DO $$ BEGIN
  -- Units: anon can read
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'ps_anon_read_units') THEN
    CREATE POLICY "ps_anon_read_units" ON units FOR SELECT TO anon USING (true);
  END IF;
  -- Services: anon can read active
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'ps_anon_read_services') THEN
    CREATE POLICY "ps_anon_read_services" ON services FOR SELECT TO anon USING (active = true);
  END IF;
  -- Barbers (users table): anon can read barbers only
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'ps_anon_read_barbers') THEN
    CREATE POLICY "ps_anon_read_barbers" ON users FOR SELECT TO anon USING (role = 'BARBER');
  END IF;
  -- Work schedules: anon can read
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'ps_anon_read_schedules') THEN
    CREATE POLICY "ps_anon_read_schedules" ON work_schedules FOR SELECT TO anon USING (true);
  END IF;
  -- Calendar events: anon can read (for availability check)
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'ps_anon_read_events') THEN
    CREATE POLICY "ps_anon_read_events" ON calendar_events FOR SELECT TO anon USING (true);
  END IF;
  -- Subscription plans: anon can read active
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'ps_anon_read_plans') THEN
    CREATE POLICY "ps_anon_read_plans" ON subscription_plans FOR SELECT TO anon
      USING (active = true);
  END IF;
  -- Referral goals: anon can read active
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'ps_anon_read_goals') THEN
    CREATE POLICY "ps_anon_read_goals" ON referral_goals FOR SELECT TO anon USING (active = true);
  END IF;
  -- Store settings: anon can read
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'ps_anon_read_store') THEN
    CREATE POLICY "ps_anon_read_store" ON store_settings FOR SELECT TO anon USING (true);
  END IF;
  -- Coupons: anon can read active
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'ps_anon_read_coupons') THEN
    CREATE POLICY "ps_anon_read_coupons" ON coupons FOR SELECT TO anon USING (active = true);
  END IF;
  -- Unit members: anon can read (for barber-per-unit mapping)
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'ps_anon_read_unit_members') THEN
    CREATE POLICY "ps_anon_read_unit_members" ON unit_members FOR SELECT TO anon USING (true);
  END IF;
END $$;

-- ===========================================================
-- CLIENT POLICIES — Scoped access for signed-up clients
-- Clients (PublicSite users) are NOT staff, so is_staff()=false.
-- These policies give them limited access to their own data.
-- ===========================================================

DO $$ BEGIN
  -- Clients: can INSERT own profile (signup)
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'ps_client_insert_self') THEN
    CREATE POLICY "ps_client_insert_self" ON clients FOR INSERT TO authenticated
      WITH CHECK (
        NOT public.is_staff()
        AND "authUserId" = auth.uid()
      );
  END IF;
  -- Clients: can READ own profile
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'ps_client_read_self') THEN
    CREATE POLICY "ps_client_read_self" ON clients FOR SELECT TO authenticated
      USING (
        NOT public.is_staff()
        AND "authUserId" = auth.uid()
      );
  END IF;
  -- Clients: can UPDATE own profile
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'ps_client_update_self') THEN
    CREATE POLICY "ps_client_update_self" ON clients FOR UPDATE TO authenticated
      USING (
        NOT public.is_staff()
        AND "authUserId" = auth.uid()
      );
  END IF;

  -- Calendar events: client can READ all (needed for availability)
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'ps_client_read_events') THEN
    CREATE POLICY "ps_client_read_events" ON calendar_events FOR SELECT TO authenticated
      USING (NOT public.is_staff());
  END IF;
  -- Calendar events: client can INSERT (create appointment)
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'ps_client_insert_event') THEN
    CREATE POLICY "ps_client_insert_event" ON calendar_events FOR INSERT TO authenticated
      WITH CHECK (NOT public.is_staff());
  END IF;
  -- Calendar events: client can UPDATE own (cancel)
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'ps_client_update_own_event') THEN
    CREATE POLICY "ps_client_update_own_event" ON calendar_events FOR UPDATE TO authenticated
      USING (
        NOT public.is_staff()
        AND "clientId" IN (SELECT id FROM clients WHERE "authUserId" = auth.uid())
      );
  END IF;

  -- Units: client can read (for booking flow)
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'ps_client_read_units') THEN
    CREATE POLICY "ps_client_read_units" ON units FOR SELECT TO authenticated
      USING (NOT public.is_staff());
  END IF;
  -- Services: client can read active (for booking flow)
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'ps_client_read_services') THEN
    CREATE POLICY "ps_client_read_services" ON services FOR SELECT TO authenticated
      USING (NOT public.is_staff() AND active = true);
  END IF;
  -- Barbers: client can read barbers (for booking flow)
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'ps_client_read_barbers') THEN
    CREATE POLICY "ps_client_read_barbers" ON users FOR SELECT TO authenticated
      USING (NOT public.is_staff() AND role = 'BARBER');
  END IF;
  -- Work schedules: client can read (for availability)
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'ps_client_read_schedules') THEN
    CREATE POLICY "ps_client_read_schedules" ON work_schedules FOR SELECT TO authenticated
      USING (NOT public.is_staff());
  END IF;
  -- Subscription plans: client can read active
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'ps_client_read_plans') THEN
    CREATE POLICY "ps_client_read_plans" ON subscription_plans FOR SELECT TO authenticated
      USING (NOT public.is_staff() AND active = true);
  END IF;
  -- Store settings: client can read
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'ps_client_read_store') THEN
    CREATE POLICY "ps_client_read_store" ON store_settings FOR SELECT TO authenticated
      USING (NOT public.is_staff());
  END IF;
  -- Referral goals: client can read active
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'ps_client_read_goals') THEN
    CREATE POLICY "ps_client_read_goals" ON referral_goals FOR SELECT TO authenticated
      USING (NOT public.is_staff() AND active = true);
  END IF;
  -- Coupons: client can read active
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'ps_client_read_coupons') THEN
    CREATE POLICY "ps_client_read_coupons" ON coupons FOR SELECT TO authenticated
      USING (NOT public.is_staff() AND active = true);
  END IF;
  -- Unit members: client can read (for barber-per-unit mapping)
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'ps_client_read_unit_members') THEN
    CREATE POLICY "ps_client_read_unit_members" ON unit_members FOR SELECT TO authenticated
      USING (NOT public.is_staff());
  END IF;

  -- Subscriptions: client can read own
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'ps_client_read_own_sub') THEN
    CREATE POLICY "ps_client_read_own_sub" ON subscriptions FOR SELECT TO authenticated
      USING (
        NOT public.is_staff()
        AND "clientId" IN (SELECT id FROM clients WHERE "authUserId" = auth.uid())
      );
  END IF;

  -- Reviews: client can insert own
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'ps_client_insert_review') THEN
    CREATE POLICY "ps_client_insert_review" ON client_reviews FOR INSERT TO authenticated
      WITH CHECK (
        NOT public.is_staff()
        AND "clientId" IN (SELECT id FROM clients WHERE "authUserId" = auth.uid())
      );
  END IF;
  -- Reviews: client can read own
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'ps_client_read_own_reviews') THEN
    CREATE POLICY "ps_client_read_own_reviews" ON client_reviews FOR SELECT TO authenticated
      USING (
        NOT public.is_staff()
        AND "clientId" IN (SELECT id FROM clients WHERE "authUserId" = auth.uid())
      );
  END IF;
  -- Coupons: client can UPDATE used_count (after booking with coupon)
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'ps_client_update_coupon') THEN
    CREATE POLICY "ps_client_update_coupon" ON coupons FOR UPDATE TO authenticated
      USING (NOT public.is_staff())
      WITH CHECK (NOT public.is_staff());
  END IF;
END $$;

-- ===========================================================
-- INDEXES for performance
-- ===========================================================
CREATE INDEX IF NOT EXISTS idx_clients_auth_user_id ON clients("authUserId");
CREATE INDEX IF NOT EXISTS idx_calendar_events_client_id ON calendar_events("clientId");
CREATE INDEX IF NOT EXISTS idx_calendar_events_date ON calendar_events(date);
CREATE INDEX IF NOT EXISTS idx_client_reviews_client_id ON client_reviews("clientId");
CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(code);
