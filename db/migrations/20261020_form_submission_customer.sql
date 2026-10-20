-- QR анкетыг харилцагчтай холбох.
--   * form_submissions.customer_id: анкетаас үүссэн / тулгагдсан харилцагч
--   * mt_customer.source: харилцагч хаанаас бүртгэгдсэн ('manual' гараар, 'form' QR анкет, 'import' файлаас)
--
-- Шинэ кодыг deploy хийхээс ӨМНӨ ажиллуулна (анкет хадгалах API эдгээр баганыг ашиглана).
-- Өмнө ирсэн анкетуудыг "Миний анкет" хуудасны "Хуучин анкетуудыг харилцагч болгох" товчоор холбоно.

BEGIN;

ALTER TABLE mt_customer ADD COLUMN IF NOT EXISTS source varchar(20) NOT NULL DEFAULT 'manual';
ALTER TABLE mt_customer DROP CONSTRAINT IF EXISTS mt_customer_source_check;
ALTER TABLE mt_customer
  ADD CONSTRAINT mt_customer_source_check CHECK (source IN ('manual', 'form', 'import'));

ALTER TABLE form_submissions
  ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES mt_customer(customer_id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS form_submissions_customer_idx ON form_submissions (customer_id) WHERE customer_id IS NOT NULL;

COMMIT;
