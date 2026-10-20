-- Үндсэн хүснэгтүүд (baseline).
--
-- Эдгээр хүснэгтийг анх Supabase-ийн UI-аар үүсгэсэн тул repo-д SQL байгаагүй.
-- Энэ файлыг аппын кодонд ашиглагдаж буй багана, төрлөөс сэргээн бичсэн бөгөөд
-- шинэ (хоосон) мэдээллийн сан дээр бусад migration-ыг ажиллуулахын өмнө эхэлж ажиллуулна.
--
-- Бүх CREATE нь IF NOT EXISTS тул одоо ажиллаж байгаа production DB дээр ажиллуулбал юу ч өөрчлөхгүй.
-- Production-ий бүтэцтэй яг тааруулах бол дараахаар шалгаж, зөрүүг энд засна:
--   pg_dump --schema-only --no-owner --no-privileges "$DATABASE_URL" > prod_schema.sql
--
-- Ажиллуулах дараалал: db/migrations доторх файлуудыг нэрийн дарааллаар (энэ файл хамгийн эхэнд).

BEGIN;

CREATE TABLE IF NOT EXISTS mt_company (
  company_id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name        varchar(255) NOT NULL,
  email               varchar(255),
  phone_number        varchar(50),
  address             text,
  subscription_status varchar(30) DEFAULT 'trial',
  created_at          timestamptz DEFAULT CURRENT_TIMESTAMP,
  updated_at          timestamptz DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS mt_user (
  user_id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    uuid NOT NULL REFERENCES mt_company(company_id) ON DELETE CASCADE,
  email         varchar(255) NOT NULL,
  password_hash varchar(255) NOT NULL,
  first_name    varchar(100),
  last_name     varchar(100),
  male          varchar(20),
  phone         varchar(50),
  address       text,
  role          varchar(20) NOT NULL DEFAULT 'employee',
  position      varchar(100),
  is_active     boolean DEFAULT true,
  create_date   timestamptz DEFAULT CURRENT_TIMESTAMP,
  update_date   timestamptz DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS mt_user_email_lower_key ON mt_user (LOWER(email));
CREATE INDEX IF NOT EXISTS mt_user_company_idx ON mt_user (company_id);

CREATE TABLE IF NOT EXISTS mt_customer (
  customer_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  uuid NOT NULL REFERENCES mt_company(company_id) ON DELETE CASCADE,
  first_name  varchar(100) NOT NULL,
  last_name   varchar(100),
  email       varchar(255),
  phone       varchar(50),
  address     text,
  male        varchar(20),
  status      varchar(20) DEFAULT 'active',
  create_date timestamptz DEFAULT CURRENT_TIMESTAMP,
  update_date timestamptz DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS mt_customer_company_idx ON mt_customer (company_id, create_date DESC);

CREATE TABLE IF NOT EXISTS mt_customercompany (
  company_customer_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          uuid NOT NULL REFERENCES mt_company(company_id) ON DELETE CASCADE,
  name                varchar(255) NOT NULL,
  tax_number          varchar(50),
  email               varchar(255),
  phone               varchar(50),
  address             text,
  status              varchar(20) DEFAULT 'active',
  create_date         timestamptz DEFAULT CURRENT_TIMESTAMP,
  update_date         timestamptz DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS mt_customercompany_company_idx ON mt_customercompany (company_id, create_date DESC);

CREATE TABLE IF NOT EXISTS mt_services (
  service_id  serial PRIMARY KEY,
  company_id  uuid NOT NULL REFERENCES mt_company(company_id) ON DELETE CASCADE,
  name        varchar(255) NOT NULL,
  category    varchar(100),
  price       numeric DEFAULT 0,
  duration    integer,
  description text,
  status      varchar(20) DEFAULT 'active',
  created_at  timestamptz DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS mt_services_company_idx ON mt_services (company_id);

CREATE TABLE IF NOT EXISTS mt_works (
  work_id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          uuid NOT NULL REFERENCES mt_company(company_id) ON DELETE CASCADE,
  customer_type       varchar(20),
  customer_id         uuid REFERENCES mt_customer(customer_id) ON DELETE SET NULL,
  company_customer_id uuid REFERENCES mt_customercompany(company_customer_id) ON DELETE SET NULL,
  service_id          integer REFERENCES mt_services(service_id) ON DELETE SET NULL,
  assigned_employee   uuid REFERENCES mt_user(user_id) ON DELETE SET NULL,
  title               varchar(255) NOT NULL,
  description         text,
  price               numeric DEFAULT 0,
  status              varchar(20) NOT NULL DEFAULT 'pending',
  priority            varchar(20) DEFAULT 'medium',
  due_date            timestamptz,
  create_date         timestamptz DEFAULT CURRENT_TIMESTAMP,
  update_date         timestamptz DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS mt_works_company_idx ON mt_works (company_id, create_date DESC);

-- Нийтийн QR анкетын загвар (компанид нэг идэвхтэй хувилбар)
CREATE TABLE IF NOT EXISTS mt_templates (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  uuid NOT NULL REFERENCES mt_company(company_id) ON DELETE CASCADE,
  title       varchar(200) NOT NULL,
  description text,
  questions   jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz DEFAULT CURRENT_TIMESTAMP,
  updated_at  timestamptz DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS mt_templates_company_active_idx ON mt_templates (company_id) WHERE is_active;

CREATE TABLE IF NOT EXISTS form_submissions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_template_id uuid REFERENCES mt_templates(id) ON DELETE SET NULL,
  company_id       uuid NOT NULL REFERENCES mt_company(company_id) ON DELETE CASCADE,
  submitted_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS form_submissions_company_idx ON form_submissions (company_id, submitted_at DESC);

CREATE TABLE IF NOT EXISTS form_submission_answers (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id  uuid NOT NULL REFERENCES form_submissions(id) ON DELETE CASCADE,
  question_id    varchar(100) NOT NULL,
  question_label text,
  answer_value   text
);
CREATE INDEX IF NOT EXISTS form_submission_answers_submission_idx ON form_submission_answers (submission_id);

CREATE TABLE IF NOT EXISTS mt_password_reset (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES mt_user(user_id) ON DELETE CASCADE,
  code_hash  varchar(255) NOT NULL,
  expires_at timestamptz NOT NULL,
  attempts   integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mt_rate_limit (
  key          varchar(255) PRIMARY KEY,
  window_start timestamptz NOT NULL DEFAULT now(),
  count        integer NOT NULL DEFAULT 0
);

-- Supabase REST API (anon/authenticated)-аар хандахыг хаана. Апп BYPASSRLS эрхтэй хэрэглэгчээр холбогддог.
ALTER TABLE mt_company ENABLE ROW LEVEL SECURITY;
ALTER TABLE mt_user ENABLE ROW LEVEL SECURITY;
ALTER TABLE mt_customer ENABLE ROW LEVEL SECURITY;
ALTER TABLE mt_customercompany ENABLE ROW LEVEL SECURITY;
ALTER TABLE mt_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE mt_works ENABLE ROW LEVEL SECURITY;
ALTER TABLE mt_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_submission_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE mt_password_reset ENABLE ROW LEVEL SECURITY;
ALTER TABLE mt_rate_limit ENABLE ROW LEVEL SECURITY;

COMMIT;
