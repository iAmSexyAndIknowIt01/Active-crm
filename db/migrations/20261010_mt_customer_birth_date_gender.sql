-- Хувь хүн харилцагч (mt_customer): төрсөн огноо болон хүйсийн хязгаарлалт
--   * birth_date: төрсөн огноо (заавал биш). Ирээдүйн огноог API шалгана
--     (CHECK дотор CURRENT_DATE ашиглавал dump/restore үед асуудал гардаг).
--   * male: зөвхөн 'Эрэгтэй' / 'Эмэгтэй'. Хуучин буруу утгууд ('Э', 'М', NULL) байгаа тул
--     NOT VALID-аар нэмнэ: шинээр нэмэх, засах мөр бүрд шалгагдана, хуучин мөрийг одоохондоо шалгахгүй.
--     Буруу мөрүүдийг db/scripts/20261010_delete_invalid_gender_customers.sql-ээр цэвэрлэсний дараа VALIDATE хийнэ.
--
-- Шинэ кодыг deploy хийхээс ӨМНӨ ажиллуулна (API нь birth_date баганыг уншдаг).

BEGIN;

ALTER TABLE mt_customer ADD COLUMN IF NOT EXISTS birth_date date;

ALTER TABLE mt_customer DROP CONSTRAINT IF EXISTS mt_customer_birth_date_check;
ALTER TABLE mt_customer
  ADD CONSTRAINT mt_customer_birth_date_check CHECK (birth_date >= DATE '1900-01-01');

ALTER TABLE mt_customer DROP CONSTRAINT IF EXISTS mt_customer_male_check;
ALTER TABLE mt_customer
  ADD CONSTRAINT mt_customer_male_check CHECK (male IN ('Эрэгтэй', 'Эмэгтэй')) NOT VALID;

COMMIT;
