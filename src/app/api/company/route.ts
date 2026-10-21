import { NextResponse } from 'next/server';
import { requireAuth } from '@/src/lib/session';
import { pool } from '@/src/lib/db';

// GET: Компанийн мэдээлэл (бүх ажилтан харна)
export async function GET() {
  try {
    const { session, error: authError } = await requireAuth({ allowExpired: true });
    if (authError) return authError;

    const { rows } = await pool.query(
      `SELECT company_id, company_name, email, phone_number, address, subscription_status, created_at
       FROM mt_company
       WHERE company_id = $1`,
      [session.companyId]
    );

    if (rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Компани олдсонгүй.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: rows[0], canEdit: session.role === 'admin' });
  } catch (error) {
    console.error('Fetch Company Error:', error);
    return NextResponse.json({ success: false, error: 'Мэдээлэл авахад алдаа гарлаа' }, { status: 500 });
  }
}

// PUT: Компанийн мэдээлэл шинэчлэх (зөвхөн админ).
// Нууц үг хэрэглэгч бүрт тусдаа тул "Профайл" хуудаснаас солино.
export async function PUT(request: Request) {
  try {
    const { session, error: authError } = await requireAuth({ admin: true });
    if (authError) return authError;

    const body = await request.json();
    const text = (value: unknown, max: number) =>
      typeof value === 'string' ? value.trim().slice(0, max) : '';

    const companyName = text(body.companyName, 200);
    const email = text(body.email, 200).toLowerCase();
    const phoneNumber = text(body.phoneNumber, 50);
    const address = text(body.address, 500);

    if (!companyName) {
      return NextResponse.json({ success: false, error: 'Компанийн нэрийг оруулна уу.' }, { status: 400 });
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ success: false, error: 'Имэйл хаяг буруу байна.' }, { status: 400 });
    }

    const { rows } = await pool.query(
      `UPDATE mt_company
       SET company_name = $1, email = $2, phone_number = $3, address = $4, updated_at = CURRENT_TIMESTAMP
       WHERE company_id = $5
       RETURNING company_id, company_name, email, phone_number, address, subscription_status, created_at`,
      [companyName, email || null, phoneNumber || null, address || null, session.companyId]
    );

    return NextResponse.json({ success: true, data: rows[0], message: 'Мэдээлэл амжилттай шинэчлэгдлээ' });
  } catch (error) {
    console.error('Update Company Error:', error);
    return NextResponse.json({ success: false, error: 'Хадгалахад алдаа гарлаа' }, { status: 500 });
  }
}
