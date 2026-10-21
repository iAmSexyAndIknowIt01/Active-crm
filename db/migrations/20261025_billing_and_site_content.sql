-- Багц / төлбөр ба нүүр хуудасны контент.
--
--   mt_company.plan          — 'trial' | 'standard' | 'pro'
--   mt_company.trial_ends_at — туршилтын хугацаа дуусах огноо (шинэ компанид 14 хоног)
--   mt_company.paid_until    — төлсөн багцын хугацаа дуусах огноо
--   Одоо байгаа компаниудад 30 хоногийн туршилт өгнө (гэнэт түгжигдэхгүйн тулд).
--
--   mt_payment       — багцын төлбөр (банкны шилжүүлэг эсвэл QPay). Платформын админ шилжүүлгийг
--                      баталгаажуулах, QPay төлөгдөхөд багцын хугацаа автоматаар сунгагдана.
--   mt_site_content  — нүүр хуудасны сэтгэгдэл, холбоо барих мэдээлэл, багцын үнэ, банкны данс
--                      (платформын админ "Платформ → Контент"-оос засна).
--
-- Шинэ кодыг deploy хийхээс ӨМНӨ ажиллуулна.

BEGIN;

ALTER TABLE mt_company ADD COLUMN IF NOT EXISTS plan varchar(20) NOT NULL DEFAULT 'trial';
ALTER TABLE mt_company DROP CONSTRAINT IF EXISTS mt_company_plan_check;
ALTER TABLE mt_company ADD CONSTRAINT mt_company_plan_check CHECK (plan IN ('trial', 'standard', 'pro'));
ALTER TABLE mt_company ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz;
ALTER TABLE mt_company ADD COLUMN IF NOT EXISTS paid_until timestamptz;
UPDATE mt_company SET trial_ends_at = now() + interval '30 days' WHERE trial_ends_at IS NULL;
ALTER TABLE mt_company ALTER COLUMN trial_ends_at SET DEFAULT (now() + interval '14 days');

CREATE TABLE IF NOT EXISTS mt_payment (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      uuid NOT NULL REFERENCES mt_company(company_id) ON DELETE CASCADE,
  plan            varchar(20) NOT NULL CHECK (plan IN ('standard', 'pro')),
  months          integer NOT NULL CHECK (months BETWEEN 1 AND 12),
  amount          numeric NOT NULL CHECK (amount >= 0),
  method          varchar(10) NOT NULL CHECK (method IN ('bank', 'qpay', 'manual')),
  status          varchar(10) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled')),
  reference       varchar(30) NOT NULL,
  qpay_invoice_id varchar(100),
  note            text,
  created_by      uuid REFERENCES mt_user(user_id) ON DELETE SET NULL,
  confirmed_by    varchar(255),
  paid_at         timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS mt_payment_reference_key ON mt_payment (reference);
CREATE INDEX IF NOT EXISTS mt_payment_company_idx ON mt_payment (company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS mt_payment_pending_idx ON mt_payment (created_at DESC) WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS mt_site_content (
  key        varchar(50) PRIMARY KEY,
  value      jsonb NOT NULL,
  updated_by varchar(255),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE mt_payment ENABLE ROW LEVEL SECURITY;
ALTER TABLE mt_site_content ENABLE ROW LEVEL SECURITY;

COMMIT;
