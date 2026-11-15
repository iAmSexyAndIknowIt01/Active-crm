-- Олон анкет (QR анкетын загвар).
--
-- Өмнө нь компани бүр нэг л идэвхтэй анкеттай байж, хадгалах бүрт шинэ хувилбар (мөр) үүсгэж,
-- хуучныг is_active = false болгодог байсан. Одоо компани олон анкеттай болж, анкет бүрийг
-- байранд нь засна:
--
--   is_active     — анкет хариулт хүлээн авч байгаа эсэх (идэвхтэй / идэвхгүй)
--   is_default    — компанийн үндсэн анкет. Анкетын ID-гүй хуучин холбоос, QR код
--                   (/active-crm/form/<company_id>) үүнийг нээнэ. Компанид нэгээс илүүгүй.
--   deleted_at    — устгасан анкет (жагсаалт, нийтийн холбоосонд гарахгүй). Өмнөх илгээлтүүд
--                   асуултын нэрээ хадгалахын тулд мөрийг өөрийг нь устгахгүй.
--   superseded_by — хуучин хувилбарын оронд гарсан анкет. Хуучин хувилбарт ирсэн хариултуудыг
--                   жагсаалтад тэр анкетын хариулт гэж тоолно (илгээлтийн өгөгдлийг өөрчлөхгүй).
--
-- Одоо байгаа өгөгдөл (зөвхөн is_default багана анх нэмэгдэх үед нэг удаа):
--   компани бүрийн идэвхтэй анкет нь үндсэн анкет болж, хуучин (идэвхгүй) хувилбарууд нь
--   устгасан гэж тэмдэглэгдэн superseded_by-оор үндсэн анкетдаа холбогдоно.
--
-- Шинэ кодыг deploy хийхээс ӨМНӨ ажиллуулна.

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'mt_templates' AND column_name = 'is_default'
  ) THEN
    ALTER TABLE mt_templates ADD COLUMN is_default boolean NOT NULL DEFAULT false;
    ALTER TABLE mt_templates ADD COLUMN deleted_at timestamptz;
    ALTER TABLE mt_templates ADD COLUMN superseded_by uuid REFERENCES mt_templates(id) ON DELETE SET NULL;

    -- Компани бүрийн хамгийн сүүлийн идэвхтэй анкетыг үндсэн болгоно
    UPDATE mt_templates
    SET is_default = true
    WHERE id IN (
      SELECT DISTINCT ON (company_id) id
      FROM mt_templates
      WHERE is_active
      ORDER BY company_id, updated_at DESC NULLS LAST, created_at DESC NULLS LAST
    );

    -- Хуучин хувилбаруудыг нууж, үндсэн анкеттай нь холбоно
    UPDATE mt_templates old
    SET deleted_at = COALESCE(old.updated_at, now()),
        superseded_by = d.id
    FROM mt_templates d
    WHERE d.company_id = old.company_id
      AND d.is_default
      AND old.id <> d.id
      AND old.is_active = false;

    -- Идэвхтэй анкетгүй компанийн хуучин хувилбаруудыг мөн нууна (шинэ анкет үүсгэнэ)
    UPDATE mt_templates
    SET deleted_at = COALESCE(updated_at, now())
    WHERE is_active = false AND deleted_at IS NULL;
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS mt_templates_company_default_key
  ON mt_templates (company_id) WHERE is_default AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS mt_templates_company_list_idx
  ON mt_templates (company_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS mt_templates_superseded_by_idx
  ON mt_templates (superseded_by) WHERE superseded_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS form_submissions_template_idx
  ON form_submissions (form_template_id);

COMMIT;
