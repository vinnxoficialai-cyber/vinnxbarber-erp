-- ============================================================
-- VINNX Barber — Subscription Plans V2 (Enterprise Upgrade)
-- Expande subscription_plans com configurações avançadas
-- ============================================================

-- 1. Adicionar novas colunas à tabela existente
ALTER TABLE subscription_plans
    ADD COLUMN IF NOT EXISTS recurrence TEXT DEFAULT 'monthly'
        CHECK (recurrence IN ('monthly', 'quarterly', 'semiannual', 'annual')),
    ADD COLUMN IF NOT EXISTS "availableForSale" BOOLEAN DEFAULT true,
    ADD COLUMN IF NOT EXISTS "creditEnabled" BOOLEAN DEFAULT true,
    ADD COLUMN IF NOT EXISTS "creditPrice" DECIMAL(10,2),
    ADD COLUMN IF NOT EXISTS "boletoEnabled" BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS "boletoPrice" DECIMAL(10,2),
    ADD COLUMN IF NOT EXISTS benefits TEXT[] DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS "planServices" JSONB DEFAULT '[]',
    ADD COLUMN IF NOT EXISTS "planProducts" JSONB DEFAULT '[]',
    ADD COLUMN IF NOT EXISTS "disabledDays" INT[] DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS "excludedProfessionals" TEXT[] DEFAULT '{}';

-- planServices JSONB format:
-- [{ "serviceId": "uuid", "discount": 100, "monthlyLimit": null, "commissionType": "default", "customCommission": null }]

-- planProducts JSONB format:
-- [{ "productId": "uuid", "discount": 10, "monthlyLimit": 2, "commission": 5 }]

-- disabledDays format:
-- {0, 6} = Domingo e Sábado desabilitados

-- excludedProfessionals format:
-- {"member-id-1", "member-id-2"} = Profissionais que NÃO atendem esse plano

SELECT 'Subscription plans V2 columns added successfully!' as result;

-- 2. Adicionar campos billing/gateway à tabela subscriptions
ALTER TABLE subscriptions
    ADD COLUMN IF NOT EXISTS "paymentMethod" TEXT
        CHECK ("paymentMethod" IN ('credit', 'boleto', 'pix')),
    ADD COLUMN IF NOT EXISTS "gatewayCustomerId" TEXT,
    ADD COLUMN IF NOT EXISTS "gatewaySubscriptionId" TEXT,
    ADD COLUMN IF NOT EXISTS "lastPaymentDate" TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS "nextPaymentDate" TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS "invoiceUrl" TEXT,
    -- Card details
    ADD COLUMN IF NOT EXISTS "cardBrand" TEXT,
    ADD COLUMN IF NOT EXISTS "cardLast4" TEXT,
    ADD COLUMN IF NOT EXISTS "billingEmail" TEXT,
    -- Sales / Commission
    ADD COLUMN IF NOT EXISTS "soldBy" TEXT,
    ADD COLUMN IF NOT EXISTS "soldByName" TEXT,
    ADD COLUMN IF NOT EXISTS "saleChannel" TEXT,
    ADD COLUMN IF NOT EXISTS "saleCommission" DECIMAL(10,2),
    ADD COLUMN IF NOT EXISTS "saleCommissionType" TEXT
        CHECK ("saleCommissionType" IN ('fixed', 'percentage')),
    -- Contract
    ADD COLUMN IF NOT EXISTS "autoRenew" BOOLEAN DEFAULT true,
    ADD COLUMN IF NOT EXISTS "cancellationReason" TEXT,
    ADD COLUMN IF NOT EXISTS notes TEXT;

SELECT 'Subscriptions enterprise columns added successfully!' as result;
