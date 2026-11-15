import type { PoolClient } from 'pg';

// Харилцагчийг утас/имэйлээр нь тулгаж үүсгэх / өмнөх бүртгэлтэй холбох
// (Excel/CSV-ээс харилцагч оруулахад ашиглагдана) ба утасны дугаар тулгах туслах функцууд.
// QR анкет нь зөвхөн асуулт хариулт тул харилцагч үүсгэдэггүй.

// Утасны дугаарыг тулгахад зориулж зөвхөн цифр үлдээнэ. +976 улсын кодыг хасна.
export function normalizePhone(phone: string | null | undefined): string {
  const digits = (phone ?? '').replace(/D/g, '');
  return digits.length === 11 && digits.startsWith('976') ? digits.slice(3) : digits;
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
