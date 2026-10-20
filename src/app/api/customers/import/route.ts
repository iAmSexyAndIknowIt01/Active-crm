import { NextResponse } from 'next/server';
import type { PoolClient } from 'pg';
import { requireAuth } from '@/src/lib/session';
import { pool } from '@/src/lib/db';
import { checkRateLimits } from '@/src/lib/rate-limit';
import { upsertIndividualCustomer } from '@/src/lib/form-customer';
import { logAudit } from '@/src/lib/audit';
import {
  IMPORT_MAX_ROWS,
  isImportType,
  validateImportRow,
  type CompanyImportRow,
  type ImportType,
} from '@/src/lib/customer-import';

// Нэг transaction-д хадгалах мөрийн тоо: мөр бүр advisory lock авдаг тул
// бүх файлыг нэг transaction-д хийвэл DB-ийн lock table дүүрч болзошгүй
const CHUNK_SIZE = 100;

interface RowError {
  line: number;
  error: string;
}

// Excel / CSV-ээс уншсан харилцагчдыг бөөнөөр нь хадгалах (зөвхөн админ).
// Body: { type: 'individual' | 'company', rows: [{ line, ...талбарууд }] }
// Утас/имэйл (хувь хүн) эсвэл регистр (байгууллага)-ээр өмнөх бүртгэлтэй тулгаж,
// давхардвал шинээр үүсгэхгүй, зөвхөн хоосон талбарыг нөхнө.
export async function POST(request: Request) {
  try {
    const { session, error: authError } = await requireAuth({ admin: true });
    if (authError) return authError;
    const { companyId } = session;

    const limited = await checkRateLimits([{ key: `import:company:${companyId}`, limit: 30, windowSeconds: 60 * 60 }]);
    if (limited) return limited;

    const body = await request.json().catch(() => null);
    const type: unknown = body?.type;
    const rows: unknown = body?.rows;
    if (!isImportType(type)) {
      return NextResponse.json({ success: false, error: 'Харилцагчийн төрөл буруу байна.' }, { status: 400 });
    }
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Оруулах мөр алга.' }, { status: 400 });
    }
    if (rows.length > IMPORT_MAX_ROWS) {
      return NextResponse.json(
        { success: false, error: `Нэг удаад хамгийн ихдээ ${IMPORT_MAX_ROWS} мөр оруулна.` },
        { status: 400 }
      );
    }

    // Эхлээд бүх мөрийг шалгана: алдаатай мөрийг алгасаж, үлдсэнийг хадгална
    const errors: RowError[] = [];
    const valid: { line: number; row: Record<string, unknown> }[] = [];
    rows.forEach((raw, index) => {
      const input = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
      const line = Number.isInteger(input.line) ? (input.line as number) : index + 2;
      const result = validateImportRow(type, input);
      if ('error' in result) errors.push({ line, error: result.error });
      else valid.push({ line, row: result.row as unknown as Record<string, unknown> });
    });

    let created = 0;
    let merged = 0;
    const client = await pool.connect();
    try {
      for (let i = 0; i < valid.length; i += CHUNK_SIZE) {
        const chunk = valid.slice(i, i + CHUNK_SIZE);
        await client.query('BEGIN');
        try {
          for (const { line, row } of chunk) {
            const result = await saveRow(client, companyId, type, row);
            if (!result) errors.push({ line, error: 'Хадгалж чадсангүй.' });
            else if (result.created) created++;
            else merged++;
          }
          await client.query('COMMIT');
        } catch (error) {
          await client.query('ROLLBACK');
          throw error;
        }
      }
    } finally {
      client.release();
    }

    errors.sort((a, b) => a.line - b.line);
    await logAudit({
      session,
      action: 'customer.import',
      entityType: type === 'company' ? 'customer_company' : 'customer',
      summary: `${rows.length} мөр файлаас оруулсан`,
      details: { created, merged, failed: errors.length },
    });
    return NextResponse.json({
      success: true,
      data: { total: rows.length, created, merged, failed: errors.length, errors: errors.slice(0, 200) },
    });
  } catch (error) {
    console.error('Customer Import Error:', error);
    return NextResponse.json({ success: false, error: 'Өгөгдөл оруулахад алдаа гарлаа.' }, { status: 500 });
  }
}

async function saveRow(client: PoolClient, companyId: string, type: ImportType, row: Record<string, unknown>) {
  if (type === 'individual') {
    return upsertIndividualCustomer(
      client,
      companyId,
      {
        first_name: row.first_name as string,
        last_name: (row.last_name as string | null) ?? null,
        phone: (row.phone as string | null) ?? null,
        email: (row.email as string | null) ?? null,
        address: (row.address as string | null) ?? null,
        birth_date: (row.birth_date as string | null) ?? null,
        male: (row.male as string | null) ?? null,
      },
      { source: 'import', requireContact: false }
    );
  }
  return upsertCompanyCustomer(client, companyId, row as unknown as CompanyImportRow);
}

// Регистр / татварын дугаараар (зай, том жижиг үсэг үл хамааран) тулгана
async function upsertCompanyCustomer(client: PoolClient, companyId: string, row: CompanyImportRow) {
  const taxKey = row.tax_number.replace(/\s/g, '').toUpperCase();
  await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`customer-company:${companyId}:${taxKey}`]);

  const existing = await client.query(
    `SELECT company_customer_id FROM mt_customercompany
     WHERE company_id = $1 AND UPPER(regexp_replace(COALESCE(tax_number, ''), '\\s', '', 'g')) = $2
     ORDER BY create_date LIMIT 1`,
    [companyId, taxKey]
  );

  if (existing.rows.length > 0) {
    await client.query(
      `
        UPDATE mt_customercompany SET
          phone   = COALESCE(NULLIF(phone, ''), $3),
          email   = COALESCE(NULLIF(email, ''), $4),
          address = COALESCE(NULLIF(address, ''), $5),
          update_date = CURRENT_TIMESTAMP
        WHERE company_customer_id = $1 AND company_id = $2
      `,
      [existing.rows[0].company_customer_id, companyId, row.phone, row.email, row.address]
    );
    return { created: false };
  }

  await client.query(
    `INSERT INTO mt_customercompany (company_id, name, tax_number, email, phone, address, source)
     VALUES ($1, $2, $3, $4, $5, $6, 'import')`,
    [companyId, row.name, row.tax_number, row.email, row.phone, row.address]
  );
  return { created: true };
}
