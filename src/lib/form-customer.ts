import type { PoolClient } from 'pg';
import { isGender, parseBirthDate } from './customer-fields';

// QR анкетын хариултаас харилцагч (mt_customer) үүсгэх / өмнөх бүртгэлтэй холбох.
//
// Анкетын асуулт бүр `maps_to`-оор харилцагчийн аль талбарт хадгалагдахыг заана.
// `maps_to` огт байхгүй (хуучин загвар) бол асуултын нэрээс таамаглана.

export const CUSTOMER_FIELD_OPTIONS = [
  { value: '', label: 'Холбохгүй' },
  { value: 'full_name', label: 'Овог, нэр' },
  { value: 'last_name', label: 'Овог' },
  { value: 'first_name', label: 'Нэр' },
  { value: 'phone', label: 'Утас' },
  { value: 'email', label: 'Имэйл' },
  { value: 'address', label: 'Хаяг' },
  { value: 'birth_date', label: 'Төрсөн огноо' },
  { value: 'gender', label: 'Хүйс' },
] as const;

export type CustomerField = Exclude<(typeof CUSTOMER_FIELD_OPTIONS)[number]['value'], ''>;

const CUSTOMER_FIELDS = new Set<string>(CUSTOMER_FIELD_OPTIONS.map((o) => o.value).filter(Boolean));

export function isCustomerField(value: unknown): value is CustomerField {
  return typeof value === 'string' && CUSTOMER_FIELDS.has(value);
}

export interface FormQuestion {
  id: string | number;
  label: string;
  type?: string;
  maps_to?: string | null;
}

// Асуултын нэрээс харилцагчийн талбарыг таамаглах (maps_to тохируулаагүй хуучин загварт)
export function inferCustomerField(label: string): CustomerField | null {
  const text = label.toLowerCase();
  if (/утас|phone|гар утас/.test(text)) return 'phone';
  if (/имэйл|и-мэйл|email|e-mail|цахим шуудан/.test(text)) return 'email';
  if (/төрсөн/.test(text)) return 'birth_date';
  if (/хүйс/.test(text)) return 'gender';
  if (/овог/.test(text) && /нэр/.test(text)) return 'full_name';
  if (/овог/.test(text)) return 'last_name';
  if (/нэр/.test(text) && !/үйлчилгээ|байгууллага|компани|машин|бараа/.test(text)) return 'full_name';
  if (/хаяг/.test(text)) return 'address';
  return null;
}

// Асуулт харилцагчийн аль талбартай холбогдохыг тодорхойлно.
// maps_to талбар байгаа бол (хоосон ч гэсэн) түүнийг дагана: админ "Холбохгүй" сонгосон байж болно.
export function resolveCustomerField(question: FormQuestion): CustomerField | null {
  if (question.maps_to !== undefined && question.maps_to !== null) {
    return isCustomerField(question.maps_to) ? question.maps_to : null;
  }
  return inferCustomerField(question.label ?? '');
}

// Утасны дугаарыг тулгахад зориулж зөвхөн цифр үлдээнэ. +976 улсын кодыг хасна.
export function normalizePhone(phone: string | null | undefined): string {
  const digits = (phone ?? '').replace(/\D/g, '');
  return digits.length === 11 && digits.startsWith('976') ? digits.slice(3) : digits;
}

// "Овог Нэр" / "Овог, Нэр" → { last_name, first_name }. Монголд овгийг түрүүлж бичдэг.
export function splitFullName(fullName: string): { first_name: string; last_name: string | null } {
  const parts = fullName.split(/[\s,]+/).filter(Boolean);
  if (parts.length <= 1) return { first_name: parts[0] ?? '', last_name: null };
  return { last_name: parts[0], first_name: parts.slice(1).join(' ') };
}

export interface ExtractedCustomer {
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  birth_date: string | null;
  male: string | null;
}

// Анкетын хариултуудаас харилцагчийн мэдээллийг гаргана.
// answers: асуултын id → хариулт
export function extractCustomerFields(
  questions: FormQuestion[],
  answers: Record<string, string>
): ExtractedCustomer {
  const result: ExtractedCustomer = {
    first_name: null,
    last_name: null,
    phone: null,
    email: null,
    address: null,
    birth_date: null,
    male: null,
  };

  for (const question of questions) {
    const field = resolveCustomerField(question);
    const value = (answers[String(question.id)] ?? '').trim();
    if (!field || !value) continue;

    switch (field) {
      case 'full_name': {
        const { first_name, last_name } = splitFullName(value);
        result.first_name ??= first_name.slice(0, 100) || null;
        result.last_name ??= last_name?.slice(0, 100) ?? null;
        break;
      }
      case 'first_name':
        result.first_name ??= value.slice(0, 100);
        break;
      case 'last_name':
        result.last_name ??= value.slice(0, 100);
        break;
      case 'phone':
        result.phone ??= value.slice(0, 50);
        break;
      case 'email':
        if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) result.email ??= value.slice(0, 255).toLowerCase();
        break;
      case 'address':
        result.address ??= value;
        break;
      case 'birth_date': {
        const parsed = parseBirthDate(value);
        if (!('error' in parsed)) result.birth_date ??= parsed.value;
        break;
      }
      case 'gender':
        if (isGender(value)) result.male ??= value;
        break;
    }
  }

  return result;
}

// QR анкетаас: утас/имэйлийн аль нь ч байхгүй бол (тулгах боломжгүй) харилцагч үүсгэхгүй.
// allowCreate: false бол (багцын хязгаар) зөвхөн байгаа харилцагчтай холбоно.
export function upsertCustomerFromForm(client: PoolClient, companyId: string, fields: ExtractedCustomer, allowCreate = true) {
  return upsertIndividualCustomer(client, companyId, fields, { source: 'form', requireContact: true, allowCreate });
}

// Утас эсвэл имэйлээр тухайн компанийн өмнөх харилцагчийг хайж, байхгүй бол шинээр үүсгэнэ.
// Өмнөх харилцагчийн хоосон талбарыг л нөхнө (байгаа мэдээллийг дарж бичихгүй).
// Нэргүй бол, эсвэл requireContact үед утас/имэйл байхгүй бол харилцагч үүсгэхгүй (null).
// Transaction доторх client-ээр дуудна.
export async function upsertIndividualCustomer(
  client: PoolClient,
  companyId: string,
  fields: ExtractedCustomer,
  options: { source: 'form' | 'import'; requireContact: boolean; allowCreate?: boolean }
): Promise<{ customerId: string; created: boolean } | null> {
  const phoneKey = normalizePhone(fields.phone);
  const email = fields.email;
  const hasContact = phoneKey.length >= 6 || !!email;
  if (!hasContact && options.requireContact) return null;

  if (hasContact) {
    const match = await findCustomerByContact(client, companyId, phoneKey, email);
    if (match) {
      await fillBlankCustomerFields(client, companyId, match, fields);
      return { customerId: match, created: false };
    }
  }

  if (!fields.first_name || options.allowCreate === false) return null;

  const inserted = await client.query(
    `
      INSERT INTO mt_customer (company_id, first_name, last_name, email, phone, address, male, birth_date, source)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8::date, $9)
      RETURNING customer_id
    `,
    [companyId, fields.first_name, fields.last_name, email, fields.phone, fields.address, fields.male, fields.birth_date, options.source]
  );
  return { customerId: inserted.rows[0].customer_id, created: true };
}

// Утас (+976, зай, зураасгүйгээр) эсвэл имэйлээр харилцагч хайна.
// Нэг дугаараар зэрэг ирсэн хоёр хүсэлт давхар харилцагч үүсгэхээс сэргийлж transaction-ы түгжээ авна.
async function findCustomerByContact(
  client: PoolClient,
  companyId: string,
  phoneKey: string,
  email: string | null
): Promise<string | null> {
  await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
    `customer-contact:${companyId}:${phoneKey.length >= 6 ? phoneKey : email}`,
  ]);

  const existing = await client.query(
    `
      SELECT customer_id
      FROM mt_customer
      WHERE company_id = $1
        AND (
          ($2 <> '' AND ${PHONE_KEY_SQL('phone')} = $2)
          OR ($3::text IS NOT NULL AND LOWER(email) = $3)
        )
      ORDER BY (${PHONE_KEY_SQL('phone')} = $2) DESC, create_date
      LIMIT 1
    `,
    [companyId, phoneKey.length >= 6 ? phoneKey : '', email]
  );

  return existing.rows[0]?.customer_id ?? null;
}

async function fillBlankCustomerFields(
  client: PoolClient,
  companyId: string,
  customerId: string,
  fields: ExtractedCustomer
) {
  const email = fields.email;
  await client.query(
    `
      UPDATE mt_customer SET
        first_name = COALESCE(NULLIF(first_name, ''), $3),
        last_name  = COALESCE(NULLIF(last_name, ''), $4),
        phone      = COALESCE(NULLIF(phone, ''), $5),
        email      = COALESCE(NULLIF(email, ''), $6),
        address    = COALESCE(NULLIF(address, ''), $7),
        birth_date = COALESCE(birth_date, $8::date),
        male       = COALESCE(male, $9),
        update_date = CURRENT_TIMESTAMP
      WHERE customer_id = $1 AND company_id = $2
    `,
    [customerId, companyId, fields.first_name, fields.last_name, fields.phone, email, fields.address, fields.birth_date, fields.male]
  );
}

// normalizePhone()-тэй ижил дүрмээр SQL дээр утасны түлхүүр гаргана
export function PHONE_KEY_SQL(column: string) {
  return `(CASE WHEN regexp_replace(COALESCE(${column}, ''), '\\D', '', 'g') ~ '^976\\d{8}$'
            THEN substr(regexp_replace(${column}, '\\D', '', 'g'), 4)
            ELSE regexp_replace(COALESCE(${column}, ''), '\\D', '', 'g') END)`;
}
