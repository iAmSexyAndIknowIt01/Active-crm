import { NextResponse } from 'next/server';
import { requireAuth } from '@/src/lib/session';
import { pool } from '@/src/lib/db';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Хуудсанд нэг дор харуулах хариултын дээд тоо (хамгийн сүүлийнх нь)
const MAX_RESPONSES = 1000;

// GET: нэг анкетын ирсэн хариултууд (зөвхөн админ).
// Анкетын хуучин хувилбаруудад (superseded_by = энэ анкет) ирсэн хариултыг хамт буцаана.
// Хариулт бүр асуултын ID, тухайн үеийн асуултын нэрээ хадгалдаг тул асуулт өөрчлөгдсөн ч харагдана.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { session, error } = await requireAuth({ admin: true });
    if (error) return error;
    const { id } = await params;
    if (!UUID_RE.test(id)) return NextResponse.json({ success: false, error: 'Анкет олдсонгүй.' }, { status: 404 });

    const { rows: templates } = await pool.query(
      `SELECT id, title, description, questions FROM mt_templates WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL`,
      [id, session.companyId]
    );
    if (!templates[0]) return NextResponse.json({ success: false, error: 'Анкет олдсонгүй.' }, { status: 404 });

    const sourceFilter = `s.company_id = $2
          AND (s.form_template_id = $1
               OR s.form_template_id IN (SELECT v.id FROM mt_templates v WHERE v.superseded_by = $1 AND v.company_id = $2))`;

    const [{ rows: totalRows }, { rows: responses }] = await Promise.all([
      pool.query(`SELECT count(*)::int AS total FROM form_submissions s WHERE ${sourceFilter}`, [id, session.companyId]),
      pool.query(
        `
          SELECT s.id, s.submitted_at,
                 COALESCE(json_agg(json_build_object(
                   'question_id', a.question_id, 'question_label', a.question_label, 'value', a.answer_value
                 ) ORDER BY a.id) FILTER (WHERE a.id IS NOT NULL), '[]'::json) AS answers
          FROM form_submissions s
          LEFT JOIN form_submission_answers a ON a.submission_id = s.id
          WHERE ${sourceFilter}
          GROUP BY s.id, s.submitted_at
          ORDER BY s.submitted_at DESC
          LIMIT $3
        `,
        [id, session.companyId, MAX_RESPONSES]
      ),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        template: templates[0],
        total: totalRows[0].total,
        responses,
      },
    });
  } catch (err) {
    console.error('Template Responses Error:', err);
    return NextResponse.json({ success: false, error: 'Серверт алдаа гарлаа.' }, { status: 500 });
  }
}
