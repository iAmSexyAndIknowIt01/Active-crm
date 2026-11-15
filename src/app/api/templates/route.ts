import { NextResponse } from 'next/server';
import { requireAuth } from '@/src/lib/session';
import { pool } from '@/src/lib/db';
import { parseTemplateInput } from '@/src/lib/form-templates';
import { withTransaction } from '@/src/lib/reservations';

// Анкетын жагсаалт ба шинэ анкет үүсгэх (зөвхөн админ).
// Анкет бүр /active-crm/form/<company_id>?t=<анкетын id> холбоостой. ID-гүй холбоос үндсэн анкетыг нээнэ.

// GET: устгаагүй бүх анкет, асуулт болон ирсэн хариултын тоотой
export async function GET() {
  try {
    const { session, error } = await requireAuth({ admin: true });
    if (error) return error;
    const { companyId } = session;

    const { rows } = await pool.query(
      `
        SELECT t.id, t.title, t.description, t.is_active, t.is_default, t.created_at, t.updated_at,
               CASE WHEN jsonb_typeof(t.questions) = 'array' THEN jsonb_array_length(t.questions) ELSE 0 END AS question_count,
               COALESCE(s.submission_count, 0)::int AS submission_count,
               s.last_submitted_at
        FROM mt_templates t
        LEFT JOIN LATERAL (
          -- Хуучин хувилбаруудад (superseded_by = энэ анкет) ирсэн хариултыг хамт тоолно
          SELECT count(*) AS submission_count, max(fs.submitted_at) AS last_submitted_at
          FROM form_submissions fs
          WHERE fs.form_template_id = t.id
             OR fs.form_template_id IN (SELECT v.id FROM mt_templates v WHERE v.superseded_by = t.id)
        ) s ON true
        WHERE t.company_id = $1 AND t.deleted_at IS NULL
        ORDER BY t.is_default DESC, t.created_at DESC
      `,
      [companyId]
    );

    return NextResponse.json({ success: true, data: { companyId, templates: rows } });
  } catch (error) {
    console.error('Template List Error:', error);
    return NextResponse.json({ success: false, error: 'Серверт алдаа гарлаа.' }, { status: 500 });
  }
}

// POST: шинэ анкет. Компанийн анхны анкет бол үндсэн анкет болно.
export async function POST(request: Request) {
  try {
    const { session, error: authError } = await requireAuth({ admin: true });
    if (authError) return authError;
    const { companyId } = session;

    const parsed = parseTemplateInput(await request.json().catch(() => null));
    if (!parsed.ok) return NextResponse.json({ success: false, error: parsed.error }, { status: 400 });
    const { title, description, questions } = parsed.value;

    const id = await withTransaction(async (client) => {
      // Зэрэг үүсгэсэн хоёр анкет хоёулаа үндсэн болохоос сэргийлнэ
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`templates:${companyId}`]);
      const { rows } = await client.query(
        `
          INSERT INTO mt_templates (company_id, title, description, questions, is_active, is_default)
          VALUES ($1, $2, $3, $4::jsonb, true,
                  NOT EXISTS (SELECT 1 FROM mt_templates WHERE company_id = $1 AND is_default AND deleted_at IS NULL))
          RETURNING id
        `,
        [companyId, title, description, JSON.stringify(questions)]
      );
      return rows[0].id as string;
    });

    return NextResponse.json({ success: true, message: 'Анкет амжилттай үүслээ.', data: { id } }, { status: 201 });
  } catch (error) {
    console.error('Template Create Error:', error);
    return NextResponse.json({ success: false, error: 'Серверт алдаа гарлаа.' }, { status: 500 });
  }
}
