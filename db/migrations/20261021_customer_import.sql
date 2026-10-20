-- Excel / CSV-ээс харилцагч оруулах.
--   * mt_customercompany.source: байгууллага харилцагч хаанаас бүртгэгдсэн ('manual' гараар, 'import' файлаас)
--
-- Шинэ кодыг deploy хийхээс ӨМНӨ ажиллуулна (20261020_form_submission_customer.sql-ийн дараа).

BEGIN;

ALTER TABLE mt_customercompany ADD COLUMN IF NOT EXISTS source varchar(20) NOT NULL DEFAULT 'manual';
ALTER TABLE mt_customercompany DROP CONSTRAINT IF EXISTS mt_customercompany_source_check;
ALTER TABLE mt_customercompany
  ADD CONSTRAINT mt_customercompany_source_check CHECK (source IN ('manual', 'import'));

COMMIT;
