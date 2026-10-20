import { NextResponse } from 'next/server';
import { requireAuth } from '@/src/lib/session';
import { pool } from '@/src/lib/db';
import { extractCustomerFields, upsertCustomerFromForm, type FormQuestion } from '@/src/lib/form-customer';

// Нэг удаад боловсруулах анкетын дээд тоо (serverless хугацааны хязгаараас хэтрэхгүйн тулд)
const BATCH_SIZE = 500;

// Харилцагчтай холбогдоогүй өмнөх анкетуудыг утас/имэйлээр нь харилцагч болгох (зөвхөн админ).
// Дахин дуудахад аюулгүй: аль хэдийн холбогдсон анкетыг алгасна.
// Олон анкеттай бол хариуны `nextCursor`-ийг дараагийн хүсэлтийн `cursor` болгон дамжуулж үргэлжлүүлнэ.
export async function POST(request: Request) {
  try {
    const { session, error: authError } = await requireAuth({ admin: true });
    if (authError) return authError;
    const { companyId } = session;

    const body = await request.json().catch(() => ({}));
    const cursor = parseCursor(body?.cursor);

    const { rows: submissions } = await pool.query(
      `
        SELECT s.id, s.submitted_at::text AS cursor_ts, t.questions,
               COALESCE(json_agg(json_build_object(
                 'question_id', a.question_id, 'question_label', a.question_label, 'answer_value', a.answer_value
               )) FILTER (WHERE a.id IS NOT NULL), '[]'::json) AS answers
        FROM form_submissions s
        LEFT JOIN mt_templates t ON t.id = s.form_template_id
        LEFT JOIN form_submission_answers a ON a.submission_id = s.id
        WHERE s.company_id = $1 AND s.customer_id IS NULL
          AND ($3::timestamptz IS NULL OR (s.submitted_at, s.id) > ($3::timestamptz, $4::uuid))
        GROUP BY s.id, t.questions, s.submitted_at
        ORDER BY s.submitted_at, s.id
        LIMIT $2
      `,
      [companyId, BATCH_SIZE, cursor?.submittedAt ?? null, cursor?.id ?? null]
    );

    let linked = 0;
    let created = 0;
    const client = await pool.connect();
    try {
      for (const submission of submissions) {
        const answers: { question_id: string; question_label: string | null; answer_value: string | null }[] =
          submission.answers;
        // Загвар устсан бол хариултад хадгалсан асуултын нэрээр таамаглана
        const questions: FormQuestion[] = Array.isArray(submission.questions)
          ? submission.questions
          : answers.map((a) => ({ id: a.question_id, label: a.question_label ?? '' }));
        const answerMap = Object.fromEntries(answers.map((a) => [String(a.question_id), a.answer_value ?? '']));

        await client.query('BEGIN');
        try {
          const customer = await upsertCustomerFromForm(client, companyId, extractCustomerFields(questions, answerMap));
          if (customer) {
            await client.query('UPDATE form_submissions SET customer_id = $1 WHERE id = $2 AND company_id = $3', [
              customer.customerId,
              submission.id,
              companyId,
            ]);
            linked++;
            if (customer.created) created++;
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

    return NextResponse.json({
      success: true,
      data: {
        processed: submissions.length,
        linked,
        created,
        skipped: submissions.length - linked,
        nextCursor:
          submissions.length === BATCH_SIZE
            ? `${submissions[submissions.length - 1].cursor_ts}|${submissions[submissions.length - 1].id}`
            : null,
      },
    });
  } catch (error) {
    console.error('Sync Form Customers Error:', error);
    return NextResponse.json({ success: false, error: 'Серверт алдаа гарлаа.' }, { status: 500 });
  }
}

const TIMESTAMP_RE = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(\.\d+)?([+-]\d{2}(:?\d{2})?|Z)?$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// "огноо|uuid" хэлбэрийн курсор (огноог DB-ийн нарийвчлалаар нь хадгална)
function parseCursor(value: unknown): { submittedAt: string; id: string } | null {
  if (typeof value !== 'string') return null;
  const [submittedAt, id] = value.split('|');
  if (!id || !UUID_RE.test(id) || !TIMESTAMP_RE.test(submittedAt)) return null;
  return { submittedAt, id };
}
