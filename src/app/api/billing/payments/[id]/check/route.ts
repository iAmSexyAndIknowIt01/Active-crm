import { NextResponse } from 'next/server';
import { requireAuth } from '@/src/lib/session';
import { pool } from '@/src/lib/db';
import { syncQPayPayment } from '@/src/lib/billing';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// QPay төлбөр төлөгдсөн эсэхийг шалгах (төлбөрийн цонх хэдэн секунд тутам дууддаг)
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { session, error } = await requireAuth({ admin: true, allowExpired: true });
    if (error) return error;
    const { id } = await params;
    if (!UUID_RE.test(id)) return NextResponse.json({ success: false, error: 'Төлбөр олдсонгүй.' }, { status: 404 });

    const { rows } = await pool.query('SELECT status, method FROM mt_payment WHERE id = $1 AND company_id = $2', [id, session.companyId]);
    if (!rows[0]) return NextResponse.json({ success: false, error: 'Төлбөр олдсонгүй.' }, { status: 404 });

    const status = rows[0].method === 'qpay' && rows[0].status === 'pending' ? await syncQPayPayment(id) : rows[0].status;
    return NextResponse.json({ success: true, data: { status } });
  } catch (err) {
    console.error('Check Payment Error:', err);
    return NextResponse.json({ success: false, error: 'Төлбөр шалгахад алдаа гарлаа.' }, { status: 500 });
  }
}
