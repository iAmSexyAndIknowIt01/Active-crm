-- Хуучин анкетын хувилбаруудыг (mt_templates) бүрмөсөн устгах. Migration биш — гараар нэг удаа ажиллуулна.
--
-- 20261116_multiple_form_templates migration нь өмнө хадгалах бүрт үүсдэг байсан хуучин хувилбаруудыг
-- нууж (deleted_at), одоогийн анкеттай нь холбосон (superseded_by). Энэ скрипт тэдгээрийг устгана.
--
--   * Ирсэн хариулт (form_submissions, form_submission_answers) УСТАХГҮЙ: хуучин хувилбарт ирсэн
--     илгээлтүүдийг одоогийн анкет руу шилжүүлнэ. Хариулт бүр асуултын нэрээ (question_label)
--     хадгалдаг тул өгөгдөл, экспорт, харилцагчийн хуудас хэвээр харагдана; зөвхөн анкетын гарчиг
--     одоогийн анкетын гарчиг болно.
--   * Зөвхөн superseded_by-тэй (хуучин хувилбар) мөрийг устгана. Хэрэглэгч "Устгах" товчоор
--     устгасан анкетуудад хүрэхгүй.
--
-- Ажиллуулах: эхлээд 1-р алхмын SELECT-ээр шалгаад, бүх скриптийг нэг дор ажиллуулна (transaction).
-- Буцаах боломжгүй тул ажиллуулахаас өмнө нөөц (backup) авна уу.

-- 1. Шалгах: компани бүрээр хэдэн хувилбар устах, хэдэн илгээлт шилжих
SELECT t.company_id,
       count(DISTINCT t.id)  AS versions_to_delete,
       count(s.id)           AS submissions_to_move
FROM mt_templates t
LEFT JOIN form_submissions s ON s.form_template_id = t.id
WHERE t.deleted_at IS NOT NULL AND t.superseded_by IS NOT NULL
GROUP BY t.company_id;

BEGIN;

-- 2. Хуучин хувилбарт ирсэн илгээлтүүдийг одоогийн анкет руу шилжүүлэх
UPDATE form_submissions s
SET form_template_id = t.superseded_by
FROM mt_templates t
WHERE s.form_template_id = t.id
  AND t.deleted_at IS NOT NULL
  AND t.superseded_by IS NOT NULL;

-- 3. Хуучин хувилбаруудыг устгах
DELETE FROM mt_templates
WHERE deleted_at IS NOT NULL
  AND superseded_by IS NOT NULL;

-- 4. Шалгах: хуучин хувилбар үлдээгүй (0), илгээлт бүр загвартайгаа холбоотой хэвээр
SELECT
  (SELECT count(*) FROM mt_templates WHERE superseded_by IS NOT NULL)                       AS superseded_left,
  (SELECT count(*) FROM form_submissions WHERE form_template_id IS NULL)                    AS submissions_without_template;

COMMIT;
