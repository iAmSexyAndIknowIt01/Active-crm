import { NextResponse } from 'next/server';
import { pool } from '@/src/lib/db';
import { requirePlatformAdmin } from '@/src/lib/platform';
import { activatePayment } from '@/src/lib/billing';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Банкны шилжүүлгийг баталгаажуулах (багцыг сунгана) эсвэл цуцлах. Body: { action: 'confirm' | 'cancel' }
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { session, error } = await requirePlatformAdmin();
    if (error) return error;
    const { id } = await params;
    if (!UUID_RE.test(id)) return NextResponse.json({ success: false, error: 'Төлбөр олдсонгүй.' }, { status: 404 });
    const body = await request.json().catch(() => null);

    if (body?.action === 'confirm') {
      const activated = await activatePayment(id, session.email);
      if (!activated) return NextResponse.json({ success: false, error: 'Төлбөр олдсонгүй эсвэл аль хэдийн шийдвэрлэгдсэн.' }, { status: 409 });
      return NextResponse.json({ success: true, message: 'Төлбөр баталгаажиж, багц сунгагдлаа.' });
    }
    if (body?.action === 'cancel') {
      const { rowCount } = await pool.query(
        `UPDATE mt_payment SET status = 'cancelled', confirmed_by = $2 WHERE id = $1 AND status = 'pending'`,
        [id, session.email]
      );
      if (!rowCount) return NextResponse.json({ success: false, error: 'Төлбөр олдсонгүй эсвэл аль хэдийн шийдвэрлэгдсэн.' }, { status: 409 });
      return NextResponse.json({ success: true, message: 'Төлбөр цуцлагдлаа.' });
    }
    return NextResponse.json({ success: false, error: 'Үйлдэл буруу байна.' }, { status: 400 });
  } catch (err) {
    console.error('Platform Payment Error:', err);
    return NextResponse.json({ success: false, error: 'Серверт алдаа гарлаа.' }, { status: 500 });
  }
}
