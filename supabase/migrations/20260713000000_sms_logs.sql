-- ============================================================
-- Salone Transit — SMS Logs
-- ============================================================

CREATE TABLE sms_logs (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone                TEXT NOT NULL,
  message              TEXT NOT NULL,
  purpose              TEXT NOT NULL DEFAULT 'general',
  status               TEXT NOT NULL CHECK (status IN ('sent', 'failed')),
  provider_message_id  TEXT,
  provider_status      TEXT,
  provider_response    TEXT,
  cost                 TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sms_logs_phone      ON sms_logs (phone);
CREATE INDEX idx_sms_logs_purpose    ON sms_logs (purpose);
CREATE INDEX idx_sms_logs_status     ON sms_logs (status);
CREATE INDEX idx_sms_logs_created_at ON sms_logs (created_at);
