import { NextResponse } from 'next/server';
import { pool } from '@/src/lib/db';
import { requirePlatformAdmin } from '@/src/lib/platform';
import { isPaidPlan } from '@/src/lib/plans';
import { extendSubscription, planPrice } from '@/src/lib/billing';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Компанийн багцыг гараар өөрчлөх (платформын админ):
//   { action: 'extend', plan, months, note? } — төлсөн багцыг сунгаж, түүхэнд 'manual' төлбөр бичнэ
//   { action: 'trial', days }                  — туршилтын хугацааг өнөөдрөөс days хоногоор тогтооно
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { session, error } = await requirePlatformAdmin();
    if (error) return error;
    const { id } = await params;
    if (!UUID_RE.test(id)) return NextResponse.json({ success: false, error: 'Компани олдсонгүй.' }, { status: 404 });
    const body = await request.json().catch(() => null);

    const exists = await pool.query('SELECT 1 FROM mt_company WHERE company_id = $1', [id]);
    if (!exists.rows[0]) return NextResponse.json({ success: false, error: 'Компани олдсонгүй.' }, { status: 404 });

    if (body?.action === 'trial') {
      const days = Number(body.days);
      if (!Number.isInteger(days) || days < 0 || days > 365) {
        return NextResponse.json({ success: false, error: 'Хоногийн тоо 0-365 байна.' }, { status: 400 });
      }
      await pool.query(`UPDATE mt_company SET trial_ends_at = now() + make_interval(days => $2) WHERE company_id = $1`, [id, days]);
      return NextResponse.json({ success: true, message: 'Туршилтын хугацаа шинэчлэгдлээ.' });
    }

    if (body?.action === 'extend') {
      const months = Number(body.months);
      if (!isPaidPlan(body.plan) || !Number.isInteger(months) || months < 1 || months > 12) {
        return NextResponse.json({ success: false, error: 'Багц эсвэл сарын тоо буруу байна.' }, { status: 400 });
      }
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(
          `INSERT INTO mt_payment (company_id, plan, months, amount, method, status, reference, note, confirmed_by, paid_at)
           VALUES ($1, $2, $3, $4, 'manual', 'paid', $5, $6, $7, now())`,
          [
            id,
            body.plan,
            months,
            (await planPrice(body.plan)) * months,
            `MANUAL-${Date.now().toString(36).toUpperCase()}`,
            typeof body.note === 'string' ? body.note.slice(0, 300) : null,
            session.email,
          ]
        );
        await extendSubscription(client, id, body.plan, months);
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
      return NextResponse.json({ success: true, message: 'Багц сунгагдлаа.' });
    }

    return NextResponse.json({ success: false, error: 'Үйлдэл буруу байна.' }, { status: 400 });
  } catch (err) {
    console.error('Platform Subscription Error:', err);
    return NextResponse.json({ success: false, error: 'Серверт алдаа гарлаа.' }, { status: 500 });
  }
}
