-- ============================================================
-- VINNX Barber — Subscription Interests
-- Registra interesse de clientes em planos de assinatura
-- Execute no Supabase SQL Editor
-- IDEMPOTENTE: pode ser executado múltiplas vezes
-- ============================================================

CREATE TABLE IF NOT EXISTS subscription_interests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "clientId" TEXT NOT NULL,
    "clientName" TEXT,
    "planId" UUID REFERENCES subscription_plans(id) ON DELETE SET NULL,
    "planName" TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'contacted', 'converted', 'dismissed')),
    "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE subscription_interests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "si_auth_all" ON subscription_interests;
CREATE POLICY "si_auth_all" ON subscription_interests
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_si_client ON subscription_interests("clientId");
CREATE INDEX IF NOT EXISTS idx_si_status ON subscription_interests(status);

SELECT 'Subscription interests table created successfully!' AS result;
