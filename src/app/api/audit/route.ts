import { NextResponse } from 'next/server';
import { requireAuth } from '@/src/lib/session';
import { pool } from '@/src/lib/db';

const PAGE_SIZE = 50;

// Үйлдлийн түүх (зөвхөн админ). Query: page=1.., entity=customer|work|employee|dataset (заавал биш)
export async function GET(request: Request) {
  try {
    const { session, error: authError } = await requireAuth({ admin: true });
    if (authError) return authError;

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number.parseInt(searchParams.get('page') ?? '1', 10) || 1);
    const entity = searchParams.get('entity');
    const entityTypes =
      entity === 'customer'
        ? ['customer', 'customer_company']
        : entity === 'work' || entity === 'employee' || entity === 'dataset'
          ? [entity]
          : null;

    const { rows } = await pool.query(
      `
        SELECT id, user_name, action, entity_type, entity_id, summary, details, created_at,
               COUNT(*) OVER () AS total_count
        FROM mt_audit_log
        WHERE company_id = $1 AND ($2::text[] IS NULL OR entity_type = ANY($2::text[]))
        ORDER BY created_at DESC
        LIMIT $3 OFFSET $4
      `,
      [session.companyId, entityTypes, PAGE_SIZE, (page - 1) * PAGE_SIZE]
    );

    const total = rows.length > 0 ? Number(rows[0].total_count) : 0;
    const data = rows.map((row) => {
      const copy = { ...row };
      delete copy.total_count;
      return copy;
    });
    return NextResponse.json({ success: true, data, total, page, pageSize: PAGE_SIZE });
  } catch (error) {
    console.error('Audit Log Fetch Error:', error);
    return NextResponse.json({ success: false, error: 'Серверт алдаа гарлаа.' }, { status: 500 });
  }
}
