import { NextResponse } from 'next/server';
import { pool } from '@/src/lib/db';
import { requireAuth } from '@/src/lib/session';
import { validateCompanyInput, validateIndividualInput } from '@/src/lib/customer-validation';
import { DUPLICATE_LABELS, findDuplicateCompany, findDuplicateIndividual, type DuplicateCustomer } from '@/src/lib/customer-duplicates';
import { logAudit } from '@/src/lib/audit';

const PAGE_SIZE_MAX = 100;

// GET: Харилцагчдыг хуудаслаж татах (хувь хүн + байгууллага нэг жагсаалтад, шинэ нь эхэндээ).
// Query: type=all|company|individual, q=хайлт (нэр, имэйл, утас, регистр), page=1.., pageSize (≤100)
export async function GET(request: Request) {
  try {
    const { session, error: authError } = await requireAuth({ admin: true });
    if (authError) return authError;
    const { companyId } = session;

    const { searchParams } = new URL(request.url);
    const typeParam = searchParams.get('type');
    const type = typeParam === 'company' || typeParam === 'individual' ? typeParam : 'all';
    const q = (searchParams.get('q') ?? '').trim().slice(0, 100);
    const page = Math.max(1, Number.parseInt(searchParams.get('page') ?? '1', 10) || 1);
    const pageSize = Math.min(PAGE_SIZE_MAX, Math.max(1, Number.parseInt(searchParams.get('pageSize') ?? '20', 10) || 20));
    // LIKE-ийн тусгай тэмдэгтүүдийг escape хийнэ
    const pattern = q ? `%${q.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%` : '';

    const { rows } = await pool.query(
      `
        WITH c AS (
          SELECT customer_id, NULL::varchar AS name, first_name, last_name, email, phone, address,
                 NULL::varchar AS tax_number, male, to_char(birth_date, 'YYYY-MM-DD') AS birth_date,
                 status, source, create_date, 'individual' AS customer_type
          FROM mt_customer
          WHERE company_id = $1 AND $2 IN ('all', 'individual')
          UNION ALL
          SELECT company_customer_id, name, NULL, NULL, email, phone, address,
                 tax_number, NULL, NULL, status, source, create_date, 'company'
          FROM mt_customercompany
          WHERE company_id = $1 AND $2 IN ('all', 'company')
        )
        SELECT *, COUNT(*) OVER () AS total_count
        FROM c
        WHERE $3 = '' OR concat_ws(' ', name, last_name, first_name, email, phone, tax_number) ILIKE $3
        ORDER BY create_date DESC NULLS LAST, customer_id
        LIMIT $4 OFFSET $5
      `,
      [companyId, type, pattern, pageSize, (page - 1) * pageSize]
    );

    const total = rows.length > 0 ? Number(rows[0].total_count) : 0;
    const data = rows.map((row) => {
      const copy = { ...row };
      delete copy.total_count;
      return copy;
    });
    return NextResponse.json({ success: true, data, total, page, pageSize });
  } catch (error) {
    console.error('Fetch Customers Error:', error);
    return NextResponse.json(
      { success: false, error: 'Харилцагчийн мэдээлэл авахад алдаа гарлаа' },
      { status: 500 }
    );
  }
}

// POST: Харилцагчийн төрлөөс хамааран mt_customer эсвэл mt_customerCompany рүү хадгалах.
// Ижил утас/имэйл (хувь хүн) эсвэл регистр (байгууллага)-тэй харилцагч байвал 409 буцааж,
// хэрэглэгч баталгаажуулсан (allow_duplicate: true) үед л давхар бүртгэнэ.
export async function POST(request: Request) {
  try {
    const { session, error: authError } = await requireAuth({ admin: true });
    if (authError) return authError;
    const { companyId } = session;

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ success: false, error: 'Хүсэлтийн формат буруу байна.' }, { status: 400 });
    }
    const allowDuplicate = body.allow_duplicate === true;

    if (body.customer_type === 'individual') {
      const input = validateIndividualInput(body);
      if ('error' in input) return NextResponse.json({ success: false, error: input.error }, { status: 400 });
      const c = input.value;

      if (!allowDuplicate) {
        const duplicate = await findDuplicateIndividual(companyId, c);
        if (duplicate) return duplicateResponse(duplicate);
      }

      const { rows } = await pool.query(
        `INSERT INTO mt_customer (company_id, first_name, last_name, email, phone, address, male, birth_date)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8::date)
         RETURNING customer_id`,
        [companyId, c.first_name, c.last_name, c.email, c.phone, c.address, c.male, c.birth_date]
      );
      await logAudit({ session, action: 'customer.create', entityType: 'customer', entityId: rows[0].customer_id, summary: `${c.last_name ?? ''} ${c.first_name}`.trim() });
    } else if (body.customer_type === 'company') {
      const input = validateCompanyInput(body);
      if ('error' in input) return NextResponse.json({ success: false, error: input.error }, { status: 400 });
      const c = input.value;

      if (!allowDuplicate) {
        const duplicate = await findDuplicateCompany(companyId, c.tax_number);
        if (duplicate) return duplicateResponse(duplicate);
      }

      const { rows } = await pool.query(
        `INSERT INTO mt_customerCompany (company_id, name, tax_number, email, phone, address)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING company_customer_id`,
        [companyId, c.name, c.tax_number, c.email, c.phone, c.address]
      );
      await logAudit({ session, action: 'customer.create', entityType: 'customer_company', entityId: rows[0].company_customer_id, summary: c.name });
    } else {
      return NextResponse.json({ success: false, error: 'Харилцагчийн төрөл буруу байна.' }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: 'Харилцагч амжилттай хадгалагдлаа' });
  } catch (error) {
    console.error('Create Customer Error:', error);
    return NextResponse.json({ success: false, error: 'Харилцагч хадгалахад алдаа гарлаа' }, { status: 500 });
  }
}

function duplicateResponse(duplicate: DuplicateCustomer) {
  return NextResponse.json(
    {
      success: false,
      error: `Энэ ${DUPLICATE_LABELS[duplicate.matched_by]} харилцагч бүртгэлтэй байна: ${duplicate.name ?? '(нэргүй)'}.`,
      duplicate,
    },
    { status: 409 }
  );
}
