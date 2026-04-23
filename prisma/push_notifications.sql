-- ============================================================
-- VINNX Barber ERP — Push Notifications Migration
-- Execute no Supabase SQL Editor
-- IDEMPOTENTE: pode ser executado múltiplas vezes
-- ============================================================

-- ══════════════════════════════════════════════════
-- 1. EXTENSÕES
-- ══════════════════════════════════════════════════
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pgsodium;

-- ══════════════════════════════════════════════════
-- 2. TABELAS
-- ══════════════════════════════════════════════════

-- 2.1 Push Subscriptions (dispositivos inscritos)
CREATE TABLE IF NOT EXISTS push_subscriptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    "clientId" TEXT NOT NULL,
    "authUserId" TEXT NOT NULL,
    endpoint TEXT NOT NULL UNIQUE,
    keys JSONB NOT NULL,
    "userAgent" TEXT,
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_push_subs_client ON push_subscriptions ("clientId");
CREATE INDEX IF NOT EXISTS idx_push_subs_auth ON push_subscriptions ("authUserId");

-- 2.2 Push Campaigns (campanhas e agendamentos)
CREATE TABLE IF NOT EXISTS push_campaigns (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    type TEXT NOT NULL DEFAULT 'campaign',
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    "imageUrl" TEXT,
    "targetUrl" TEXT DEFAULT '/#/site',
    segment TEXT DEFAULT 'all',
    "targetClientId" TEXT,
    "filterCriteria" JSONB,
    schedule TEXT,
    recurrence TEXT,
    enabled BOOLEAN DEFAULT true,
    status TEXT DEFAULT 'draft',
    "sentCount" INT DEFAULT 0,
    "failedCount" INT DEFAULT 0,
    "scheduledAt" TIMESTAMPTZ,
    "sentAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "createdBy" TEXT
);

-- 2.3 Push Log (histórico de envios)
CREATE TABLE IF NOT EXISTS push_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    "campaignId" UUID,
    "clientId" TEXT,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT,
    status TEXT DEFAULT 'sent',
    "errorDetail" TEXT,
    "createdAt" TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_push_log_client ON push_log ("clientId");
CREATE INDEX IF NOT EXISTS idx_push_log_campaign ON push_log ("campaignId");
CREATE INDEX IF NOT EXISTS idx_push_log_created ON push_log ("createdAt");

-- 2.4 Push Automation Config (configurações dos fluxos automáticos)
CREATE TABLE IF NOT EXISTS push_automation_config (
    id TEXT PRIMARY KEY,
    enabled BOOLEAN DEFAULT true,
    config JSONB NOT NULL,
    "messageTemplate" TEXT NOT NULL,
    "imageUrl" TEXT,
    "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- ══════════════════════════════════════════════════
-- 3. COLUNAS EXTRAS EM TABELAS EXISTENTES
-- ══════════════════════════════════════════════════
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS "reminderSent" BOOLEAN DEFAULT false;
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS "ratingRequested" BOOLEAN DEFAULT false;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS "profileNudgeCount" INT DEFAULT 0;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS "lastProfileNudge" TIMESTAMPTZ;

-- ══════════════════════════════════════════════════
-- 4. RLS POLICIES
-- ══════════════════════════════════════════════════

-- 4.1 push_subscriptions: cliente gerencia suas próprias
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "push_subs_own" ON push_subscriptions;
CREATE POLICY "push_subs_own" ON push_subscriptions
    FOR ALL TO authenticated
    USING (auth.uid()::text = "authUserId")
    WITH CHECK (auth.uid()::text = "authUserId");

-- 4.2 push_campaigns: staff (users.email = JWT email)
ALTER TABLE push_campaigns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "push_campaigns_staff" ON push_campaigns;
CREATE POLICY "push_campaigns_staff" ON push_campaigns
    FOR ALL TO authenticated
    USING (
      EXISTS (SELECT 1 FROM users WHERE email = (auth.jwt()->>'email'))
    );

-- 4.3 push_log: staff read
ALTER TABLE push_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "push_log_staff_read" ON push_log;
CREATE POLICY "push_log_staff_read" ON push_log
    FOR SELECT TO authenticated
    USING (
      EXISTS (SELECT 1 FROM users WHERE email = (auth.jwt()->>'email'))
    );

-- 4.4 push_automation_config: staff read/write
ALTER TABLE push_automation_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "push_auto_config_staff" ON push_automation_config;
CREATE POLICY "push_auto_config_staff" ON push_automation_config
    FOR ALL TO authenticated
    USING (
      EXISTS (SELECT 1 FROM users WHERE email = (auth.jwt()->>'email'))
    );

-- ══════════════════════════════════════════════════
-- 5. SEED AUTOMATION CONFIGS
-- ══════════════════════════════════════════════════
INSERT INTO push_automation_config (id, enabled, config, "messageTemplate") VALUES
  ('reminder', true,
   '{"hoursBeforeAppointment": 2}',
   'Lembrete: {servico} às {hora} hoje! Estamos esperando você 💈'),
  ('review', true,
   '{"hoursAfterCompletion": 3}',
   'Como foi seu {servico}? Avalie e ajude a melhorar nosso atendimento ⭐'),
  ('incomplete', true,
   '{"requiredFields": ["birthday", "phone", "gender"], "intervalDays": 7, "maxAttempts": 3}',
   'Complete seu perfil e ganhe desconto de aniversário! 🎁'),
  ('birthday', true,
   '{"discountPercent": 15, "sendHour": 9}',
   'Feliz aniversário, {nome}! 🎂 Ganhe {desconto}% no próximo corte!'),
  ('inactive', true,
   '{"inactiveDays": 30, "maxNudgesPerMonth": 1}',
   'Faz tempo que não te vemos! 💈 Que tal agendar um horário?')
ON CONFLICT (id) DO NOTHING;

-- ══════════════════════════════════════════════════
-- 6. VAULT SECRET (para o trigger)
-- ══════════════════════════════════════════════════
-- Gera um secret FIXO para autenticação trigger→API
-- ⚠️ ESTE MESMO VALOR ESTÁ CONFIGURADO COMO PUSH_API_SECRET NO VERCEL
DO $$
BEGIN
  -- Tenta criar, ignora se já existe
  PERFORM vault.create_secret(
    '61f77e82ed30a3d19aabd8b895430ef98672c66a49840226cbdb0743c750e11f',
    'push_api_secret',
    'Secret para autenticação push trigger/cron → Vercel API'
  );
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Vault secret push_api_secret já existe ou vault não disponível: %', SQLERRM;
END;
$$;

-- ══════════════════════════════════════════════════
-- 7. TRIGGER: notify_push_on_event_change
-- ══════════════════════════════════════════════════
-- Envia push automaticamente via pg_net quando eventos são
-- criados (confirmação), cancelados, ou reagendados.
-- O frontend NÃO envia push manualmente — o trigger cuida de tudo.
CREATE OR REPLACE FUNCTION notify_push_on_event_change()
RETURNS TRIGGER AS $$
DECLARE
  _client_id TEXT;
  _title TEXT;
  _body TEXT;
  _tag TEXT;
  _api_url TEXT := 'https://vinnxbarber-erp.vercel.app/api/push-send';
  _secret TEXT;
BEGIN
  -- Busca o secret do Vault
  SELECT decrypted_secret INTO _secret
  FROM vault.decrypted_secrets
  WHERE name = 'push_api_secret'
  LIMIT 1;

  _client_id := COALESCE(NEW."clientId", OLD."clientId");
  IF _client_id IS NULL THEN RETURN NEW; END IF;

  -- date é TIMESTAMPTZ, startTime é TEXT
  IF TG_OP = 'INSERT' AND NEW.status = 'confirmed' THEN
    _title := '✅ Agendamento Confirmado!';
    _body := COALESCE(NEW."serviceName", 'Serviço') || ' - ' ||
             TO_CHAR(NEW.date, 'DD/MM') || ' às ' || NEW."startTime";
    _tag := 'booking-' || NEW.id;

  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'cancelled'
        AND OLD.status IS DISTINCT FROM 'cancelled' THEN
    _title := '❌ Agendamento Cancelado';
    _body := COALESCE(NEW."serviceName", 'Serviço') || ' - ' ||
             TO_CHAR(NEW.date, 'DD/MM') || ' às ' || NEW."startTime";
    _tag := 'cancel-' || NEW.id;

  ELSIF TG_OP = 'UPDATE' AND NEW."startTime" IS DISTINCT FROM OLD."startTime"
        AND NEW.status IS DISTINCT FROM 'cancelled' THEN
    _title := '🔄 Horário Alterado';
    _body := COALESCE(NEW."serviceName", 'Serviço') || ' reagendado para ' ||
             TO_CHAR(NEW.date, 'DD/MM') || ' às ' || NEW."startTime";
    _tag := 'reschedule-' || NEW.id;

  ELSE
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := _api_url,
    body := jsonb_build_object(
      'clientId', _client_id, 'title', _title, 'body', _body, 'tag', _tag
    ),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-push-secret', COALESCE(_secret, '')
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_push_on_calendar_event ON calendar_events;
CREATE TRIGGER trg_push_on_calendar_event
  AFTER INSERT OR UPDATE ON calendar_events
  FOR EACH ROW
  EXECUTE FUNCTION notify_push_on_event_change();

-- ══════════════════════════════════════════════════
-- 8. PG_CRON SCHEDULES
-- ══════════════════════════════════════════════════

-- 8.1 Hourly: lembretes + avaliações + campanhas agendadas
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'push-hourly') THEN
    PERFORM cron.unschedule('push-hourly');
  END IF;
END $$;

SELECT cron.schedule('push-hourly', '0 * * * *', $$
  SELECT net.http_post(
    url := 'https://vinnxbarber-erp.vercel.app/api/push-cron',
    body := '{"type":"hourly"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-push-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'push_api_secret' LIMIT 1)
    )
  );
$$);

-- 8.2 Daily 9h BRT (12h UTC): cadastro incompleto + aniversário
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'push-daily') THEN
    PERFORM cron.unschedule('push-daily');
  END IF;
END $$;

SELECT cron.schedule('push-daily', '0 12 * * *', $$
  SELECT net.http_post(
    url := 'https://vinnxbarber-erp.vercel.app/api/push-cron',
    body := '{"type":"daily"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-push-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'push_api_secret' LIMIT 1)
    )
  );
$$);

-- 8.3 Monthly: cleanup push_log > 90 dias
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'push-log-cleanup') THEN
    PERFORM cron.unschedule('push-log-cleanup');
  END IF;
END $$;

SELECT cron.schedule('push-log-cleanup', '0 3 1 * *', $$
  DELETE FROM push_log WHERE "createdAt" < NOW() - interval '90 days';
$$);

-- ══════════════════════════════════════════════════
-- 9. VERIFICAÇÃO
-- ══════════════════════════════════════════════════
SELECT 'Push Notifications migration complete!' AS result;
SELECT COUNT(*) AS automation_configs FROM push_automation_config;
SELECT jobname, schedule FROM cron.job WHERE jobname LIKE 'push%';
