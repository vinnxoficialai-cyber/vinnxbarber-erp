-- ============================================================
-- VINNX Barber — Billing Gateway + Subscription Enhancements
-- Migration para gestão de assinaturas com gateway de pagamento
-- ============================================================

-- 1. billing_gateway_config (dados sensíveis — RLS ADMIN only)
CREATE TABLE IF NOT EXISTS billing_gateway_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider TEXT NOT NULL DEFAULT 'asaas',
    environment TEXT NOT NULL DEFAULT 'sandbox'
        CHECK (environment IN ('sandbox', 'production')),
    "apiKey" TEXT NOT NULL,
    "webhookSecret" TEXT,
    "webhookUrl" TEXT,
    active BOOLEAN DEFAULT true,
    "autoCreateCustomer" BOOLEAN DEFAULT true,
    "autoCharge" BOOLEAN DEFAULT true,
    "sendNotifications" BOOLEAN DEFAULT true,
    "daysBeforeDue" INT DEFAULT 5,
    "maxRetries" INT DEFAULT 3,
    "finePercent" DECIMAL(5,2) DEFAULT 2.00,
    "interestPercent" DECIMAL(5,2) DEFAULT 1.00,
    "enableCredit" BOOLEAN DEFAULT true,
    "enableBoleto" BOOLEAN DEFAULT true,
    "enablePix" BOOLEAN DEFAULT true,
    "unitId" TEXT,
    "createdAt" TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    "updatedAt" TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
ALTER TABLE billing_gateway_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "bgc_select" ON billing_gateway_config;
CREATE POLICY "bgc_select" ON billing_gateway_config FOR SELECT
    USING (get_user_role(auth.uid()) = 'ADMIN');
DROP POLICY IF EXISTS "bgc_insert" ON billing_gateway_config;
CREATE POLICY "bgc_insert" ON billing_gateway_config FOR INSERT
    WITH CHECK (get_user_role(auth.uid()) = 'ADMIN');
DROP POLICY IF EXISTS "bgc_update" ON billing_gateway_config;
CREATE POLICY "bgc_update" ON billing_gateway_config FOR UPDATE
    USING (get_user_role(auth.uid()) = 'ADMIN');
DROP POLICY IF EXISTS "bgc_delete" ON billing_gateway_config;
CREATE POLICY "bgc_delete" ON billing_gateway_config FOR DELETE
    USING (get_user_role(auth.uid()) = 'ADMIN');

-- 2. billing_events (log de webhook — leitura geral)
CREATE TABLE IF NOT EXISTS billing_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "subscriptionId" UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
    "clientId" TEXT,
    "asaasPaymentId" TEXT,
    event TEXT NOT NULL,
    status TEXT NOT NULL,
    amount DECIMAL(10,2),
    "billingType" TEXT,
    "dueDate" DATE,
    "paymentDate" DATE,
    "invoiceUrl" TEXT,
    "bankSlipUrl" TEXT,
    "pixQrCode" TEXT,
    raw JSONB,
    "processedAt" TIMESTAMPTZ DEFAULT NOW(),
    "createdAt" TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
ALTER TABLE billing_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "be_all" ON billing_events;
CREATE POLICY "be_all" ON billing_events FOR ALL
    USING (auth.role() = 'authenticated');
CREATE INDEX IF NOT EXISTS idx_be_subscription ON billing_events("subscriptionId");
CREATE INDEX IF NOT EXISTS idx_be_asaas_payment ON billing_events("asaasPaymentId");

-- 3. subscription_usage_log (rastreio granular — ON DELETE CASCADE em comandaId)
CREATE TABLE IF NOT EXISTS subscription_usage_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "subscriptionId" UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    "comandaId" UUID REFERENCES comandas(id) ON DELETE CASCADE,
    "comandaItemId" UUID,
    "itemId" TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('service', 'product')),
    "discountApplied" DECIMAL(5,2) NOT NULL,
    "originalPrice" DECIMAL(10,2),
    "finalPrice" DECIMAL(10,2),
    "usedAt" TIMESTAMPTZ DEFAULT NOW(),
    "createdAt" TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
ALTER TABLE subscription_usage_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sul_all" ON subscription_usage_log;
CREATE POLICY "sul_all" ON subscription_usage_log FOR ALL
    USING (auth.role() = 'authenticated');
CREATE INDEX IF NOT EXISTS idx_sul_sub_item
    ON subscription_usage_log("subscriptionId", "itemId");
CREATE INDEX IF NOT EXISTS idx_sul_month ON subscription_usage_log("usedAt");

-- 4. Novos campos em subscriptions (unitId + billing lifecycle)
ALTER TABLE subscriptions
    ADD COLUMN IF NOT EXISTS "unitId" TEXT,
    ADD COLUMN IF NOT EXISTS "currentInvoiceUrl" TEXT,
    ADD COLUMN IF NOT EXISTS "currentBankSlipUrl" TEXT,
    ADD COLUMN IF NOT EXISTS "currentPixQrCode" TEXT,
    ADD COLUMN IF NOT EXISTS "lastWebhookAt" TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS "failedAttempts" INT DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "pausedAt" TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_subscriptions_unit ON subscriptions("unitId");

-- 5. asaasCustomerId no clients
ALTER TABLE clients ADD COLUMN IF NOT EXISTS "asaasCustomerId" TEXT;
CREATE INDEX IF NOT EXISTS idx_clients_asaas ON clients("asaasCustomerId");

-- 6. unitScope em subscription_plans (FIX #3 — não existia)
ALTER TABLE subscription_plans
    ADD COLUMN IF NOT EXISTS "unitScope" TEXT DEFAULT 'all',
    ADD COLUMN IF NOT EXISTS "allowedUnitIds" TEXT[] DEFAULT '{}';

-- 7. Campos de desconto em comanda_items (FIX #5)
ALTER TABLE comanda_items
    ADD COLUMN IF NOT EXISTS "subscriptionDiscount" DECIMAL(5,2),
    ADD COLUMN IF NOT EXISTS "originalPrice" DECIMAL(10,2);

-- 8. RPC: Incremento atômico de usesThisMonth (Errata E1)
CREATE OR REPLACE FUNCTION increment_subscription_uses(sub_id UUID, delta INT)
RETURNS void LANGUAGE sql AS $$
    UPDATE subscriptions
    SET "usesThisMonth" = GREATEST(0, COALESCE("usesThisMonth", 0) + delta)
    WHERE id = sub_id;
$$;

SELECT 'Billing gateway + subscription enhancements applied!' as result;
