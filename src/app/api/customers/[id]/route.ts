import { NextResponse } from 'next/server';
import { requireAuth } from '@/src/lib/session';
import { pool } from '@/src/lib/db';
import { validateCompanyInput, validateIndividualInput } from '@/src/lib/customer-validation';
import { DUPLICATE_LABELS, findDuplicateCompany, findDuplicateIndividual } from '@/src/lib/customer-duplicates';
import { diffFields, logAudit } from '@/src/lib/audit';
import { normalizePhone } from '@/src/lib/form-customer';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const COMPANY_COLUMNS = `
  company_customer_id AS customer_id, company_id, name, tax_number, email, phone, address,
  status, source, create_date, update_date, 'company' AS customer_type
`;
const INDIVIDUAL_COLUMNS = `
  customer_id, company_id, first_name, last_name, email, phone, male,
  to_char(birth_date, 'YYYY-MM-DD') AS birth_date, address, status, source, create_date, update_date,
  'individual' AS customer_type
`;

function notFound(type: string | null) {
  return NextResponse.json(
    { success: false, error: type === 'company' ? 'Компанийн харилцагч олдсонгүй' : 'Хувь хүний харилцагч олдсонгүй' },
    { status: 404 }
  );
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { session, error: authError } = await requireAuth({ admin: true });
    if (authError) return authError;
    const { companyId } = session;
    const { id: customerId } = await params;
    const type = new URL(request.url).searchParams.get('type');
    if (!UUID_RE.test(customerId)) return notFound(type);

    if (type === 'company') {
      const { rows } = await pool.query(
        `SELECT ${COMPANY_COLUMNS} FROM mt_customercompany WHERE company_customer_id = $1 AND company_id = $2`,
        [customerId, companyId]
      );
      if (rows.length === 0) return notFound(type);
      return NextResponse.json({ success: true, data: rows[0] });
    }

    const { rows } = await pool.query(
      `SELECT ${INDIVIDUAL_COLUMNS} FROM mt_customer WHERE customer_id = $1 AND company_id = $2`,
      [customerId, companyId]
    );
    if (rows.length === 0) return notFound(type);

    // Энэ харилцагчийн бөглөсөн QR анкетууд (сүүлийн 20)
    const { rows: submissions } = await pool.query(
      `
        SELECT s.id, s.submitted_at, t.title AS template_title,
               COALESCE(json_agg(json_build_object('label', a.question_label, 'value', a.answer_value)
                        ORDER BY a.question_label) FILTER (WHERE a.id IS NOT NULL), '[]'::json) AS answers
        FROM form_submissions s
        LEFT JOIN mt_templates t ON t.id = s.form_template_id
        LEFT JOIN form_submission_answers a ON a.submission_id = s.id
        WHERE s.customer_id = $1 AND s.company_id = $2
        GROUP BY s.id, s.submitted_at, t.title
        ORDER BY s.submitted_at DESC
        LIMIT 20
      `,
      [customerId, companyId]
    );

    return NextResponse.json({ success: true, data: { ...rows[0], submissions } });
  } catch (error) {
    console.error('Fetch Customer Detail Error:', error);
    return NextResponse.json({ success: false, error: 'Харилцагчийн мэдээлэл авахад алдаа гарлаа' }, { status: 500 });
  }
}

// Засах: шалгалт нь нэмэхтэй ижил. Өөр харилцагчийн утас/имэйл/регистртэй давхцвал 409 (allow_duplicate-аар үргэлжилнэ)
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { session, error: authError } = await requireAuth({ admin: true });
    if (authError) return authError;
    const { companyId } = session;
    const { id: customerId } = await params;
    const type = new URL(request.url).searchParams.get('type');
    if (!UUID_RE.test(customerId)) return notFound(type);

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ success: false, error: 'Хүсэлтийн формат буруу байна.' }, { status: 400 });
    }
    const allowDuplicate = body.allow_duplicate === true;

    if (type === 'company') {
      const input = validateCompanyInput(body);
      if ('error' in input) return NextResponse.json({ success: false, error: input.error }, { status: 400 });
      const c = input.value;

      const before = await pool.query(`SELECT ${COMPANY_COLUMNS} FROM mt_customercompany WHERE company_customer_id = $1 AND company_id = $2`, [
        customerId,
        companyId,
      ]);
      if (before.rows.length === 0) return notFound(type);

      if (!allowDuplicate) {
        const duplicate = await findDuplicateCompany(companyId, c.tax_number, customerId);
        if (duplicate) {
          return NextResponse.json(
            { success: false, error: `Энэ ${DUPLICATE_LABELS[duplicate.matched_by]} өөр харилцагч бүртгэлтэй байна: ${duplicate.name}.`, duplicate },
            { status: 409 }
          );
        }
      }

      const { rows } = await pool.query(
        `
          UPDATE mt_customercompany
          SET name = $1, tax_number = $2, email = $3, phone = $4, address = $5, update_date = CURRENT_TIMESTAMP
          WHERE company_customer_id = $6 AND company_id = $7
          RETURNING ${COMPANY_COLUMNS}
        `,
        [c.name, c.tax_number, c.email, c.phone, c.address, customerId, companyId]
      );
      const changes = diffFields(before.rows[0], rows[0], ['name', 'tax_number', 'email', 'phone', 'address']);
      if (Object.keys(changes).length > 0) {
        await logAudit({ session, action: 'customer.update', entityType: 'customer_company', entityId: customerId, summary: c.name, details: changes });
      }
      return NextResponse.json({ success: true, data: rows[0] });
    }

    const input = validateIndividualInput(body);
    if ('error' in input) return NextResponse.json({ success: false, error: input.error }, { status: 400 });
    const c = input.value;

    const before = await pool.query(`SELECT ${INDIVIDUAL_COLUMNS} FROM mt_customer WHERE customer_id = $1 AND company_id = $2`, [
      customerId,
      companyId,
    ]);
    if (before.rows.length === 0) return notFound(type);

    if (!allowDuplicate) {
      const duplicate = await findDuplicateIndividual(companyId, c, customerId);
      if (duplicate) {
        return NextResponse.json(
          { success: false, error: `Энэ ${DUPLICATE_LABELS[duplicate.matched_by]} өөр харилцагч бүртгэлтэй байна: ${duplicate.name ?? '(нэргүй)'}.`, duplicate },
          { status: 409 }
        );
      }
    }

    const { rows } = await pool.query(
      `
        UPDATE mt_customer
        SET first_name = $1, last_name = $2, email = $3, phone = $4, male = $5, address = $6, birth_date = $7::date,
            update_date = CURRENT_TIMESTAMP
        WHERE customer_id = $8 AND company_id = $9
        RETURNING ${INDIVIDUAL_COLUMNS}
      `,
      [c.first_name, c.last_name, c.email, c.phone, c.male, c.address, c.birth_date, customerId, companyId]
    );
    const changes = diffFields(before.rows[0], rows[0], ['first_name', 'last_name', 'email', 'phone', 'male', 'address', 'birth_date']);
    if (Object.keys(changes).length > 0) {
      await logAudit({
        session,
        action: 'customer.update',
        entityType: 'customer',
        entityId: customerId,
        summary: `${c.last_name ?? ''} ${c.first_name}`.trim(),
        details: changes,
      });
    }
    return NextResponse.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('Update Customer Error:', error);
    return NextResponse.json({ success: false, error: 'Харилцагчийн мэдээллийг шинэчлэхэд алдаа гарлаа' }, { status: 500 });
  }
}

// Харилцагчийг устгах (зөвхөн админ). Хувь хүний мэдээллийг хамгаалах үүднээс тухайн хүний
// бөглөсөн QR анкет, сануулгын лог дахь нэр/холбоо барих мэдээллийг хамт устгана.
// Ажил, цаг захиалгын түүх (дүн, огноо) хадгалагдаж, харилцагчийн холбоос нь хоосорно.
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { session, error: authError } = await requireAuth({ admin: true });
    if (authError) return authError;
    const { companyId } = session;
    const { id: customerId } = await params;
    const type = new URL(request.url).searchParams.get('type');
    if (!UUID_RE.test(customerId)) return notFound(type);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      if (type === 'company') {
        const { rows } = await client.query(
          `SELECT name, phone, email FROM mt_customercompany WHERE company_customer_id = $1 AND company_id = $2 FOR UPDATE`,
          [customerId, companyId]
        );
        if (rows.length === 0) {
          await client.query('ROLLBACK');
          return notFound(type);
        }
        await client.query(`UPDATE mt_works SET company_customer_id = NULL WHERE company_customer_id = $1 AND company_id = $2`, [customerId, companyId]);
        await client.query(
          `UPDATE mt_reservation SET company_customer_id = NULL, customer_name = 'Устгагдсан харилцагч', customer_phone = NULL,
                  customer_email = NULL, customer_address = NULL, customer_register = NULL
           WHERE company_customer_id = $1 AND company_id = $2`,
          [customerId, companyId]
        );
        await anonymizeReminderLog(client, companyId, rows[0].phone, rows[0].email);
        await client.query(`DELETE FROM mt_customercompany WHERE company_customer_id = $1 AND company_id = $2`, [customerId, companyId]);
        await logAudit({ session, action: 'customer.delete', entityType: 'customer_company', entityId: customerId, summary: rows[0].name }, client);
      } else {
        const { rows } = await client.query(
          `SELECT NULLIF(TRIM(CONCAT(last_name, ' ', first_name)), '') AS name, phone, email
           FROM mt_customer WHERE customer_id = $1 AND company_id = $2 FOR UPDATE`,
          [customerId, companyId]
        );
        if (rows.length === 0) {
          await client.query('ROLLBACK');
          return notFound(type);
        }
        await client.query(`DELETE FROM form_submissions WHERE customer_id = $1 AND company_id = $2`, [customerId, companyId]);
        await client.query(`UPDATE mt_works SET customer_id = NULL WHERE customer_id = $1 AND company_id = $2`, [customerId, companyId]);
        await client.query(
          `UPDATE mt_reservation SET customer_id = NULL, customer_name = 'Устгагдсан харилцагч', customer_phone = NULL,
                  customer_email = NULL, customer_address = NULL
           WHERE customer_id = $1 AND company_id = $2`,
          [customerId, companyId]
        );
        await anonymizeReminderLog(client, companyId, rows[0].phone, rows[0].email);
        await client.query(`DELETE FROM mt_customer WHERE customer_id = $1 AND company_id = $2`, [customerId, companyId]);
        await logAudit({ session, action: 'customer.delete', entityType: 'customer', entityId: customerId, summary: rows[0].name }, client);
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    return NextResponse.json({ success: true, message: 'Харилцагч устгагдлаа.' });
  } catch (error) {
    console.error('Delete Customer Error:', error);
    return NextResponse.json({ success: false, error: 'Харилцагч устгахад алдаа гарлаа' }, { status: 500 });
  }
}

// Сануулгын логт хадгалагдсан нэр, утас/имэйлийг арилгана (илгээсэн тоо, огноо үлдэнэ)
async function anonymizeReminderLog(
  client: import('pg').PoolClient,
  companyId: string,
  phone: string | null,
  email: string | null
) {
  const recipients = [normalizePhone(phone), email?.toLowerCase()].filter((r): r is string => !!r && r.length > 0);
  if (recipients.length === 0) return;
  await client.query(
    `UPDATE mt_reminder_log SET customer_name = NULL, recipient = NULL
     WHERE company_id = $1 AND LOWER(recipient) = ANY($2::text[])`,
    [companyId, recipients]
  );
}
