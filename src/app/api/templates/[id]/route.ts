import { NextResponse } from 'next/server';
import { requireAuth } from '@/src/lib/session';
import { pool } from '@/src/lib/db';
import { parseTemplateInput } from '@/src/lib/form-templates';
import { withTransaction } from '@/src/lib/reservations';

type Params = { params: Promise<{ id: string }> };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const notFound = () => NextResponse.json({ success: false, error: 'Анкет олдсонгүй.' }, { status: 404 });

// GET: нэг анкетын бүх мэдээлэл (засварлах хуудсанд)
export async function GET(_request: Request, { params }: Params) {
  try {
    const { session, error } = await requireAuth({ admin: true });
    if (error) return error;
    const { id } = await params;
    if (!UUID_RE.test(id)) return notFound();

    const { rows } = await pool.query(
      `SELECT id, company_id, title, description, questions, is_active, is_default, created_at, updated_at
       FROM mt_templates
       WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL`,
      [id, session.companyId]
    );
    if (!rows[0]) return notFound();
    return NextResponse.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('Template Fetch Error:', error);
    return NextResponse.json({ success: false, error: 'Серверт алдаа гарлаа.' }, { status: 500 });
  }
}

// PUT: анкетыг засна. Бүх талбар заавал биш:
//   title, description, questions — агуулга (гурвууланг нь хамт илгээнэ)
//   is_active  — хариулт хүлээн авах эсэх
//   is_default: true — үндсэн анкет болгох (өмнөх үндсэн анкет энгийн болно)
export async function PUT(request: Request, { params }: Params) {
  try {
    const { session, error: authError } = await requireAuth({ admin: true });
    if (authError) return authError;
    const { companyId } = session;
    const { id } = await params;
    if (!UUID_RE.test(id)) return notFound();

    const body = await request.json().catch(() => null);
    if (typeof body !== 'object' || body === null) {
      return NextResponse.json({ success: false, error: 'Хүсэлтийн формат буруу байна.' }, { status: 400 });
    }

    const hasContent = 'title' in body || 'questions' in body;
    const parsed = hasContent ? parseTemplateInput(body) : null;
    if (parsed && !parsed.ok) return NextResponse.json({ success: false, error: parsed.error }, { status: 400 });
    if ('is_active' in body && typeof body.is_active !== 'boolean') {
      return NextResponse.json({ success: false, error: 'Идэвхтэй эсэх утга буруу байна.' }, { status: 400 });
    }
    if ('is_default' in body && body.is_default !== true) {
      return NextResponse.json({ success: false, error: 'Өөр анкетыг үндсэн болгож солино уу.' }, { status: 400 });
    }

    const found = await withTransaction(async (client) => {
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`templates:${companyId}`]);
      const { rows } = await client.query(
        `SELECT id FROM mt_templates WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL FOR UPDATE`,
        [id, companyId]
      );
      if (!rows[0]) return false;

      if (parsed?.ok) {
        const { title, description, questions } = parsed.value;
        await client.query(
          `UPDATE mt_templates SET title = $3, description = $4, questions = $5::jsonb, updated_at = CURRENT_TIMESTAMP
           WHERE id = $1 AND company_id = $2`,
          [id, companyId, title, description, JSON.stringify(questions)]
        );
      }
      if (typeof body.is_active === 'boolean') {
        await client.query(
          `UPDATE mt_templates SET is_active = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND company_id = $2`,
          [id, companyId, body.is_active]
        );
      }
      if (body.is_default === true) {
        await client.query(
          `UPDATE mt_templates SET is_default = false WHERE company_id = $1 AND is_default AND id <> $2`,
          [companyId, id]
        );
        await client.query(
          `UPDATE mt_templates SET is_default = true, updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND company_id = $2`,
          [id, companyId]
        );
      }
      return true;
    });
    if (!found) return notFound();

    return NextResponse.json({ success: true, message: 'Анкет хадгалагдлаа.' });
  } catch (error) {
    console.error('Template Update Error:', error);
    return NextResponse.json({ success: false, error: 'Серверт алдаа гарлаа.' }, { status: 500 });
  }
}

// DELETE: анкетыг жагсаалт, нийтийн холбоосноос хасна. Ирсэн хариултууд хадгалагдана.
// Үндсэн анкетыг устгавал хамгийн сүүлд үүссэн (боломжтой бол идэвхтэй) анкет үндсэн болно.
export async function DELETE(_request: Request, { params }: Params) {
  try {
    const { session, error: authError } = await requireAuth({ admin: true });
    if (authError) return authError;
    const { companyId } = session;
    const { id } = await params;
    if (!UUID_RE.test(id)) return notFound();

    const found = await withTransaction(async (client) => {
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`templates:${companyId}`]);
      const { rows } = await client.query(
        `SELECT is_default FROM mt_templates WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL FOR UPDATE`,
        [id, companyId]
      );
      if (!rows[0]) return false;

      await client.query(
        `UPDATE mt_templates SET deleted_at = now(), is_default = false, is_active = false, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND company_id = $2`,
        [id, companyId]
      );

      if (rows[0].is_default) {
        await client.query(
          `UPDATE mt_templates SET is_default = true
           WHERE id = (
             SELECT id FROM mt_templates
             WHERE company_id = $1 AND deleted_at IS NULL
             ORDER BY is_active DESC, created_at DESC
             LIMIT 1
           )`,
          [companyId]
        );
      }
      return true;
    });
    if (!found) return notFound();

    return NextResponse.json({ success: true, message: 'Анкет устгагдлаа.' });
  } catch (error) {
    console.error('Template Delete Error:', error);
    return NextResponse.json({ success: false, error: 'Серверт алдаа гарлаа.' }, { status: 500 });
  }
}
