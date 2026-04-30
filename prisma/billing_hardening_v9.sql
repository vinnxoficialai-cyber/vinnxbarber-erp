-- ============================================================
-- VINNX Barber — Billing Hardening v9
-- Adiciona campos financeiros ao billing_events + health report
-- EXECUTAR NO SUPABASE SQL EDITOR
-- ============================================================

-- 1. Campos financeiros em billing_events
--    netValue: valor líquido após taxas ASAAS (ex: R$5.00 → R$4.37)
--    transactionReceiptUrl: link do comprovante ASAAS
--    creditDate: data que o dinheiro cai na conta
--    confirmedDate: data de confirmação do pagamento
--    invoiceNumber: número da fatura ASAAS
ALTER TABLE billing_events
    ADD COLUMN IF NOT EXISTS "netValue" DECIMAL(10,2),
    ADD COLUMN IF NOT EXISTS "transactionReceiptUrl" TEXT,
    ADD COLUMN IF NOT EXISTS "creditDate" DATE,
    ADD COLUMN IF NOT EXISTS "confirmedDate" DATE,
    ADD COLUMN IF NOT EXISTS "invoiceNumber" TEXT;

-- 2. Health report no billing_gateway_config
--    lastReconcileReport: JSON com resultado do último reconcile + health check
ALTER TABLE billing_gateway_config
    ADD COLUMN IF NOT EXISTS "lastReconcileReport" JSONB;

-- 3. Índice para queries de dashboard financeiro
CREATE INDEX IF NOT EXISTS idx_be_event_date ON billing_events("processedAt" DESC);
CREATE INDEX IF NOT EXISTS idx_be_client ON billing_events("clientId");

SELECT 'Billing hardening v9 migration applied!' as result;
