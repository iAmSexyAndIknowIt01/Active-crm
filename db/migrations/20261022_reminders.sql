-- Сануулга илгээх систем.
--   * mt_reminder_settings: компанийн сануулгын тохиргоо (компанид нэг мөр)
--       - reservation_*: маргааш цаг захиалсан харилцагчид урьдчилан сануулах
--       - followup_*: сүүлд үйлчлүүлснээс хойш followup_days хоног болсон харилцагчийг дахин урих
--   * mt_reminder_log: илгээсэн (оролдсон) сануулга бүр. Unique индекс нь нэг захиалга /
--     нэг ажилд сануулга давхар илгээгдэхээс хамгаална (илгээхээс ӨМНӨ мөр нөөцөлнө).
--
-- Шинэ кодыг deploy хийхээс ӨМНӨ ажиллуулна.

BEGIN;

CREATE TABLE IF NOT EXISTS mt_reminder_settings (
  company_id           uuid PRIMARY KEY REFERENCES mt_company(company_id) ON DELETE CASCADE,
  reservation_enabled  boolean NOT NULL DEFAULT false,
  reservation_template text,
  followup_enabled     boolean NOT NULL DEFAULT false,
  followup_days        integer NOT NULL DEFAULT 90 CHECK (followup_days BETWEEN 7 AND 730),
  followup_template    text,
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mt_reminder_log (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id     uuid NOT NULL REFERENCES mt_company(company_id) ON DELETE CASCADE,
  kind           varchar(20) NOT NULL CHECK (kind IN ('reservation', 'followup')),
  reservation_id uuid REFERENCES mt_reservation(reservation_id) ON DELETE SET NULL,
  work_id        uuid REFERENCES mt_works(work_id) ON DELETE SET NULL,
  customer_name  varchar(255),
  channel        varchar(10) CHECK (channel IN ('email', 'sms')),
  recipient      varchar(255),
  status         varchar(10) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'skipped')),
  error          text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- Нэг захиалгад нэг сануулга, нэг (сүүлийн) ажилд нэг дахин урих сануулга
CREATE UNIQUE INDEX IF NOT EXISTS mt_reminder_log_reservation_key
  ON mt_reminder_log (reservation_id) WHERE kind = 'reservation' AND reservation_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS mt_reminder_log_followup_key
  ON mt_reminder_log (work_id) WHERE kind = 'followup' AND work_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS mt_reminder_log_company_idx ON mt_reminder_log (company_id, created_at DESC);

ALTER TABLE mt_reminder_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE mt_reminder_log ENABLE ROW LEVEL SECURITY;

COMMIT;
