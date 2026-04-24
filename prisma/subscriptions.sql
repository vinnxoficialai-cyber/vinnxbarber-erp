-- ============================================================
-- VINNX Barber — Subscription Plans & Subscriptions
-- Planos de assinatura e gestão de assinantes
-- ============================================================

-- 1. Subscription Plans (planos disponíveis)
CREATE TABLE IF NOT EXISTS subscription_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL DEFAULT 0,
    "servicesIncluded" TEXT[] DEFAULT '{}',
    "maxUsesPerMonth" INT,
    "durationDays" INT DEFAULT 30,
    active BOOLEAN DEFAULT true,
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "subscription_plans_select" ON subscription_plans;
CREATE POLICY "subscription_plans_select" ON subscription_plans
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "subscription_plans_insert" ON subscription_plans;
CREATE POLICY "subscription_plans_insert" ON subscription_plans
    FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "subscription_plans_update" ON subscription_plans;
CREATE POLICY "subscription_plans_update" ON subscription_plans
    FOR UPDATE TO authenticated USING (true);

DROP POLICY IF EXISTS "subscription_plans_delete" ON subscription_plans;
CREATE POLICY "subscription_plans_delete" ON subscription_plans
    FOR DELETE TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_subscription_plans_active ON subscription_plans(active);

-- 2. Subscriptions (clientes assinantes)
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "planId" UUID NOT NULL REFERENCES subscription_plans(id) ON DELETE CASCADE,
    "clientId" TEXT NOT NULL,
    "clientName" TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'cancelled', 'overdue', 'pending_payment')),
    "startDate" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "endDate" TIMESTAMPTZ,
    "usesThisMonth" INT DEFAULT 0,
    "paymentDay" INT DEFAULT 5,
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "subscriptions_select" ON subscriptions;
CREATE POLICY "subscriptions_select" ON subscriptions
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "subscriptions_insert" ON subscriptions;
CREATE POLICY "subscriptions_insert" ON subscriptions
    FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "subscriptions_update" ON subscriptions;
CREATE POLICY "subscriptions_update" ON subscriptions
    FOR UPDATE TO authenticated USING (true);

DROP POLICY IF EXISTS "subscriptions_delete" ON subscriptions;
CREATE POLICY "subscriptions_delete" ON subscriptions
    FOR DELETE TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_subscriptions_plan ON subscriptions("planId");
CREATE INDEX IF NOT EXISTS idx_subscriptions_client ON subscriptions("clientId");
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

SELECT 'Subscription tables created successfully!' as result;
