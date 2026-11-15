  -- Банкны шилжүүлгийн "Хянагдаж буй" төлөв.
  --
  -- Компанийн админ шилжүүлэг хийгээд "Төлбөр хийсэн" дарахад төлбөр pending → review болно
  -- (reported_at — мэдэгдсэн цаг). Багц шууд идэвхжихгүй: платформын админ орлогыг шалгаад
  -- "Орлого орсон" дарахад paid болж багц сунгагдана, эсвэл цуцална.
  --
  -- Шинэ кодыг deploy хийхээс ӨМНӨ ажиллуулна.
  
  BEGIN;
  
  ALTER TABLE mt_payment DROP CONSTRAINT IF EXISTS mt_payment_status_check;
  ALTER TABLE mt_payment ADD CONSTRAINT mt_payment_status_check
    CHECK (status IN ('pending', 'review', 'paid', 'cancelled'));
  
  ALTER TABLE mt_payment ADD COLUMN IF NOT EXISTS reported_at timestamptz;
  
  -- Платформын админы "баталгаажуулах" жагсаалт
  CREATE INDEX IF NOT EXISTS mt_payment_review_idx ON mt_payment (reported_at DESC) WHERE status = 'review';
  
  COMMIT;
