-- mt_customer: хүйс нь 'Эрэгтэй' / 'Эмэгтэй'-ээс өөр (жишээ нь 'Э', 'М', NULL) харилцагчдыг устгах
--
-- ⚠ Устгасан мөрийг автоматаар сэргээхгүй. Эхлээд 1-р алхмыг ажиллуулж юу устахыг шалгана уу.
-- Өмнө нь db/migrations/20261010_mt_customer_birth_date_gender.sql ажилласан байх ёстой.
--
-- Анхаарах зүйл:
--   * mt_works.customer_id нь mt_customer руу FK-гүй тул харилцагчийг устгахад ажлууд нь автоматаар өөрчлөгдөхгүй:
--     - customer_type = 'individual' ажил: эзэн нь энэ харилцагч тул хамт устгана
--       (mt_work_services нь ON DELETE CASCADE-аар хамт устна).
--     - customer_type = 'company' ажил: эзэн нь байгууллага харилцагч (company_customer_id) бөгөөд customer_id нь
--       илүүдэл утга тул устгахгүй, зөвхөн customer_id-г NULL болгоно.
--   * mt_reservation.customer_id нь ON DELETE SET NULL. Захиалга нь харилцагчийн нэр, утсыг өөртөө
--     хуулж хадгалдаг тул устахгүй, зөвхөн холбоос нь салгагдана.
--   * Өөрчлөхөөс өмнө бүх мөрийг "backup" схемд хуулна. Энэ схем Supabase API-д ил гарахгүй.

-- 1. Урьдчилан харах: юу өөрчлөгдөхийг шалгах --------------------------------------------------------
SELECT
  c.company_id,
  COALESCE(c.male, '(хоосон)') AS male,
  count(*) AS customers_to_delete,
  sum((SELECT count(*) FROM mt_works w
       WHERE w.customer_id = c.customer_id AND w.customer_type = 'individual')) AS works_to_delete,
  sum((SELECT count(*) FROM mt_works w
       WHERE w.customer_id = c.customer_id AND w.customer_type IS DISTINCT FROM 'individual')) AS company_works_unlinked,
  sum((SELECT count(*) FROM mt_reservation r WHERE r.customer_id = c.customer_id)) AS reservations_unlinked
FROM mt_customer c
WHERE c.male IS NULL OR c.male NOT IN ('Эрэгтэй', 'Эмэгтэй')
GROUP BY c.company_id, c.male
ORDER BY c.company_id, c.male;


-- 2. Нөөцлөөд устгах ---------------------------------------------------------------------------------
BEGIN;

CREATE SCHEMA IF NOT EXISTS backup;

CREATE TABLE backup.mt_customer_invalid_gender_20261010 AS
SELECT * FROM mt_customer
WHERE male IS NULL OR male NOT IN ('Эрэгтэй', 'Эмэгтэй');

-- Устгах болон customer_id-г NULL болгох бүх ажил (хоёр төрөл хоёулаа)
CREATE TABLE backup.mt_works_invalid_gender_20261010 AS
SELECT w.* FROM mt_works w
WHERE w.customer_id IN (SELECT customer_id FROM backup.mt_customer_invalid_gender_20261010);

CREATE TABLE backup.mt_work_services_invalid_gender_20261010 AS
SELECT ws.* FROM mt_work_services ws
WHERE ws.work_id IN (
  SELECT work_id FROM backup.mt_works_invalid_gender_20261010 WHERE customer_type = 'individual'
);

CREATE TABLE backup.mt_reservation_customer_link_20261010 AS
SELECT reservation_id, customer_id FROM mt_reservation
WHERE customer_id IN (SELECT customer_id FROM backup.mt_customer_invalid_gender_20261010);

DELETE FROM mt_works
WHERE customer_type = 'individual'
  AND work_id IN (SELECT work_id FROM backup.mt_works_invalid_gender_20261010);

UPDATE mt_works SET customer_id = NULL
WHERE customer_type IS DISTINCT FROM 'individual'
  AND work_id IN (SELECT work_id FROM backup.mt_works_invalid_gender_20261010);

DELETE FROM mt_customer
WHERE customer_id IN (SELECT customer_id FROM backup.mt_customer_invalid_gender_20261010);

-- Хуучин буруу мөр үлдээгүй тул хязгаарлалтыг бүрэн идэвхжүүлж, хүйсийг заавал болгоно
ALTER TABLE mt_customer VALIDATE CONSTRAINT mt_customer_male_check;
ALTER TABLE mt_customer ALTER COLUMN male SET NOT NULL;

COMMIT;


-- 3. Шалгах: зөвхөн 'Эрэгтэй' / 'Эмэгтэй' үлдсэн байх ёстой ----------------------------------------
SELECT male, count(*) FROM mt_customer GROUP BY male ORDER BY male;

-- Бүх зүйл хэвийн бол нөөцийг дараа нь устгаж болно:
-- DROP SCHEMA backup CASCADE;
