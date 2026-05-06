-- ============================================================
-- Migration: Focus NFe Integration — New Columns
-- Date: 2026-05-05
-- Description: Adds 10 columns across 3 tables to support
--              Focus NFe API tracking, IBGE municipality codes,
--              subscription fiscal flags and tax rate indicators.
-- Safe to run multiple times (IF NOT EXISTS).
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- TABLE: invoices
-- ─────────────────────────────────────────────────────────────
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS "focusNfeRef"   TEXT,        -- Ref usada na chamada da API Focus NFe (idempotência)
  ADD COLUMN IF NOT EXISTS "focusNfeChave" TEXT,        -- Chave NF-e/NFC-e da SEFAZ (44 dígitos)
  ADD COLUMN IF NOT EXISTS "danfeUrl"      TEXT,        -- URL do DANFE gerado pela Focus NFe
  ADD COLUMN IF NOT EXISTS "unitId"        TEXT;        -- FK para units.id (isolamento multi-unidade)

-- Índice para busca de invoice pelo ref Focus NFe (usado pelo webhook)
CREATE INDEX IF NOT EXISTS idx_invoices_focus_nfe_ref ON invoices ("focusNfeRef")
  WHERE "focusNfeRef" IS NOT NULL;

-- ─────────────────────────────────────────────────────────────
-- TABLE: invoice_emitters
-- ─────────────────────────────────────────────────────────────
ALTER TABLE invoice_emitters
  ADD COLUMN IF NOT EXISTS "focusNfeToken"  TEXT,       -- Token individual do emitter na conta master Focus NFe
  ADD COLUMN IF NOT EXISTS "ibgeMunicipio"  TEXT;       -- Código IBGE 7 dígitos do município (obrigatório NFS-e)

-- ─────────────────────────────────────────────────────────────
-- TABLE: fiscal_settings
-- ─────────────────────────────────────────────────────────────
ALTER TABLE fiscal_settings
  ADD COLUMN IF NOT EXISTS "autoEmitOnSubscription" BOOLEAN DEFAULT false,  -- Auto-emitir NFS-e ao receber pgto de assinatura
  ADD COLUMN IF NOT EXISTS "includePlanDetails"     BOOLEAN DEFAULT true,   -- Incluir detalhes do plano na descrição da NFS-e
  ADD COLUMN IF NOT EXISTS "pisRate"                NUMERIC(6,4) DEFAULT 0.0065,  -- Alíquota PIS para indicadores do dashboard
  ADD COLUMN IF NOT EXISTS "cofinsRate"             NUMERIC(6,4) DEFAULT 0.0300;  -- Alíquota COFINS para indicadores do dashboard

-- ─────────────────────────────────────────────────────────────
-- Atualização de registro existente (garante defaults para row existente)
-- ─────────────────────────────────────────────────────────────
UPDATE fiscal_settings
SET
  "autoEmitOnSubscription" = COALESCE("autoEmitOnSubscription", false),
  "includePlanDetails"     = COALESCE("includePlanDetails", true),
  "pisRate"                = COALESCE("pisRate", 0.0065),
  "cofinsRate"             = COALESCE("cofinsRate", 0.0300)
WHERE id IS NOT NULL;
