import { NextResponse } from 'next/server';
import { requireAuth } from '@/src/lib/session';
import { pool } from '@/src/lib/db';
import { checkRateLimits } from '@/src/lib/rate-limit';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// "Төлбөр хийсэн": компанийн админ банкаар шилжүүлснээ мэдэгдэнэ. Багцыг шууд идэвхжүүлэхгүй:
// төлбөр "Хянагдаж буй" (review) болж, платформын админ орлогыг шалгаад баталгаажуулна
// (/api/platform/payments/[id], action: 'confirm').
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { session, error } = await requireAuth({ admin: true, allowExpired: true });
    if (error) return error;
    const { id } = await params;
    if (!UUID_RE.test(id)) return NextResponse.json({ success: false, error: 'Төлбөр олдсонгүй.' }, { status: 404 });

    const limited = await checkRateLimits([{ key: `billing:report:${session.companyId}`, limit: 20, windowSeconds: 60 * 60 }]);
    if (limited) return limited;

    const { rows } = await pool.query(
      `UPDATE mt_payment SET status = 'review', reported_at = now()
       WHERE id = $1 AND company_id = $2 AND method = 'bank' AND status = 'pending'
       RETURNING status`,
      [id, session.companyId]
    );
    if (rows[0]) return NextResponse.json({ success: true, data: { status: 'review' } });

    // Шинэчлэгдээгүй: яагаад гэдгийг тодорхойлно (дахин дарсан бол амжилттай гэж үзнэ)
    const { rows: current } = await pool.query('SELECT status, method FROM mt_payment WHERE id = $1 AND company_id = $2', [
      id,
      session.companyId,
    ]);
    const payment = current[0];
    if (!payment) return NextResponse.json({ success: false, error: 'Төлбөр олдсонгүй.' }, { status: 404 });
    if (payment.method !== 'bank') {
      return NextResponse.json({ success: false, error: 'Зөвхөн банкны шилжүүлгийг ингэж мэдэгдэнэ.' }, { status: 400 });
    }
    if (payment.status === 'review' || payment.status === 'paid') {
      return NextResponse.json({ success: true, data: { status: payment.status } });
    }
    return NextResponse.json({ success: false, error: 'Энэ төлбөр цуцлагдсан байна. Шинээр төлбөр үүсгэнэ үү.' }, { status: 409 });
  } catch (err) {
    console.error('Report Payment Error:', err);
    return NextResponse.json({ success: false, error: 'Серверт алдаа гарлаа.' }, { status: 500 });
  }
}
