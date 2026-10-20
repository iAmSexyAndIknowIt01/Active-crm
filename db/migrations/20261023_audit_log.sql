-- Үйлдлийн түүх (audit log): хэн, хэзээ, юуг өөрчилсөн.
--   Харилцагч нэмэх/засах/устгах, ажлын үнэ/төлөв өөрчлөх, ажилтны эрх өөрчлөх,
--   өгөгдөл экспорт/импорт хийх зэрэг үйлдлүүдийг бичнэ. Админ "Тохиргоо → Үйлдлийн түүх"-ээс харна.
--   user_name нь тухайн үеийн нэрийг хадгална (ажилтан устсан ч түүх хэвээр).
--
-- Шинэ кодыг deploy хийхээс ӨМНӨ ажиллуулна.

BEGIN;

CREATE TABLE IF NOT EXISTS mt_audit_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  uuid NOT NULL REFERENCES mt_company(company_id) ON DELETE CASCADE,
  user_id     uuid REFERENCES mt_user(user_id) ON DELETE SET NULL,
  user_name   varchar(255),
  action      varchar(50) NOT NULL,
  entity_type varchar(30) NOT NULL,
  entity_id   varchar(100),
  summary     varchar(500),
  details     jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mt_audit_log_company_idx ON mt_audit_log (company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS mt_audit_log_entity_idx ON mt_audit_log (company_id, entity_type, entity_id);

ALTER TABLE mt_audit_log ENABLE ROW LEVEL SECURITY;

COMMIT;
