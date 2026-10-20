import 'server-only';
import { pool } from './db';
import { PHONE_KEY_SQL, normalizePhone } from './form-customer';

export interface DuplicateCustomer {
  customer_id: string;
  customer_type: 'individual' | 'company';
  name: string;
  matched_by: 'phone' | 'email' | 'tax_number';
}

// Ижил утас (+976, зай үл хамааран) эсвэл имэйлтэй өөр хувь хүн харилцагч
export async function findDuplicateIndividual(
  companyId: string,
  { phone, email }: { phone: string | null; email: string | null },
  excludeId?: string
): Promise<DuplicateCustomer | null> {
  const phoneKey = normalizePhone(phone);
  if (phoneKey.length < 6 && !email) return null;

  const { rows } = await pool.query(
    `
      SELECT customer_id,
             NULLIF(TRIM(CONCAT(last_name, ' ', first_name)), '') AS name,
             CASE WHEN $2 <> '' AND ${PHONE_KEY_SQL('phone')} = $2 THEN 'phone' ELSE 'email' END AS matched_by
      FROM mt_customer
      WHERE company_id = $1
        AND ($4::text IS NULL OR customer_id::text <> $4)
        AND (($2 <> '' AND ${PHONE_KEY_SQL('phone')} = $2) OR ($3::text IS NOT NULL AND LOWER(email) = $3))
      ORDER BY create_date
      LIMIT 1
    `,
    [companyId, phoneKey.length >= 6 ? phoneKey : '', email?.toLowerCase() ?? null, excludeId ?? null]
  );
  return rows[0] ? { ...rows[0], customer_type: 'individual' } : null;
}

// Ижил регистр / татварын дугаартай (зай, том жижиг үсэг үл хамааран) өөр байгууллага харилцагч
export async function findDuplicateCompany(
  companyId: string,
  taxNumber: string,
  excludeId?: string
): Promise<DuplicateCustomer | null> {
  const { rows } = await pool.query(
    `
      SELECT company_customer_id AS customer_id, name, 'tax_number' AS matched_by
      FROM mt_customercompany
      WHERE company_id = $1
        AND ($3::text IS NULL OR company_customer_id::text <> $3)
        AND UPPER(regexp_replace(COALESCE(tax_number, ''), '\\s', '', 'g')) = $2
      ORDER BY create_date
      LIMIT 1
    `,
    [companyId, taxNumber.replace(/\s/g, '').toUpperCase(), excludeId ?? null]
  );
  return rows[0] ? { ...rows[0], customer_type: 'company' } : null;
}

export const DUPLICATE_LABELS: Record<DuplicateCustomer['matched_by'], string> = {
  phone: 'утасны дугаартай',
  email: 'имэйлтэй',
  tax_number: 'регистрийн дугаартай',
};
