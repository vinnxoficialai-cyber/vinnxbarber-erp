-- ============================================================
-- VINNX Barber — Push Trigger FINAL (canonical version)
-- Based on V2 + improvements
-- Execute no Supabase SQL Editor
-- IDEMPOTENTE: pode ser executado múltiplas vezes
-- ============================================================
-- This is the CANONICAL trigger definition. Previous versions:
-- - push_notifications.sql (v1) — original, handles INSERT+UPDATE
-- - push_trigger_v2.sql (v2) — added date change + barber change
-- This version is identical to V2 and serves as the single source of truth.

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

  -- 1. Novo agendamento confirmado
  IF TG_OP = 'INSERT' AND NEW.status = 'confirmed' THEN
    _title := '✅ Agendamento Confirmado!';
    _body := COALESCE(NEW."serviceName", 'Serviço') || ' - ' ||
             TO_CHAR(NEW.date, 'DD/MM') || ' às ' || NEW."startTime";
    _tag := 'booking-' || NEW.id;

  -- 2. Cancelamento
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'cancelled'
        AND OLD.status IS DISTINCT FROM 'cancelled' THEN
    _title := '❌ Agendamento Cancelado';
    _body := COALESCE(NEW."serviceName", 'Serviço') || ' - ' ||
             TO_CHAR(NEW.date, 'DD/MM') || ' às ' || NEW."startTime";
    _tag := 'cancel-' || NEW.id;

  -- 3. Reagendamento: data OU horário mudou
  ELSIF TG_OP = 'UPDATE'
        AND (NEW."startTime" IS DISTINCT FROM OLD."startTime"
             OR NEW.date IS DISTINCT FROM OLD.date)
        AND NEW.status IS DISTINCT FROM 'cancelled' THEN
    _title := '🔄 Horário Alterado';
    _body := COALESCE(NEW."serviceName", 'Serviço') || ' reagendado para ' ||
             TO_CHAR(NEW.date, 'DD/MM') || ' às ' || NEW."startTime";
    _tag := 'reschedule-' || NEW.id;

  -- 4. Profissional alterado (sem mudança de data/horário)
  ELSIF TG_OP = 'UPDATE'
        AND NEW."barberId" IS DISTINCT FROM OLD."barberId"
        AND NEW.status IS DISTINCT FROM 'cancelled'
        AND NEW."startTime" IS NOT DISTINCT FROM OLD."startTime"
        AND NEW.date IS NOT DISTINCT FROM OLD.date THEN
    _title := '👤 Profissional Alterado';
    _body := COALESCE(NEW."serviceName", 'Serviço') || ' agora com ' ||
             COALESCE(NEW."barberName", 'outro profissional');
    _tag := 'barber-change-' || NEW.id;

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

-- Recriar trigger (mesmo nome, substitui o anterior)
DROP TRIGGER IF EXISTS trg_push_on_calendar_event ON calendar_events;
CREATE TRIGGER trg_push_on_calendar_event
  AFTER INSERT OR UPDATE ON calendar_events
  FOR EACH ROW
  EXECUTE FUNCTION notify_push_on_event_change();

SELECT 'Push trigger FINAL deployed successfully!' AS result;
