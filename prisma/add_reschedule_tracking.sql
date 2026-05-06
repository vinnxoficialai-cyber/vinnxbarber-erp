-- Migration: Rastreamento de remarcação em calendar_events
-- IDEMPOTENTE — IF NOT EXISTS em todas as operações
-- Executar no Supabase SQL Editor ANTES de deploy do frontend

-- 1. Novas colunas
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS "originalStartTime" TEXT;
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS "originalEndTime" TEXT;
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS "lastModifiedBy" TEXT;
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS "lastModifiedByName" TEXT;

-- 2. Comentários descritivos
COMMENT ON COLUMN calendar_events."originalStartTime"
  IS 'Horário de início anterior à última remarcação (HH:MM)';
COMMENT ON COLUMN calendar_events."originalEndTime"
  IS 'Horário de término anterior à última remarcação (HH:MM)';
COMMENT ON COLUMN calendar_events."lastModifiedBy"
  IS 'ID do usuário que fez a última alteração, ou "client" se foi cliente';
COMMENT ON COLUMN calendar_events."lastModifiedByName"
  IS 'Nome cacheado do responsável pela última alteração';

-- 3. Verificação
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'calendar_events'
  AND column_name IN ('originalStartTime', 'originalEndTime', 'lastModifiedBy', 'lastModifiedByName')
ORDER BY column_name;
