import { NextResponse } from 'next/server';
import { getSession, normalizeRole, requireAuth } from '@/src/lib/session';
import { logAudit } from '@/src/lib/audit';
import { validatePassword } from '@/src/lib/password';
import { pool } from '../../../lib/db';
import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';

// 1. GET метод: Компанийн бүх хэрэглэгчдийг авах
export async function GET() {
  try {
    const session = await getSession();
    const userId = session?.userId;
    const companyId = session?.companyId;

    if (!userId || !companyId) {
      return NextResponse.json(
        { success: false, error: 'Нэвтрээгүй эсвэл cookie мэдээлэл дутуу байна.' },
        { status: 401 }
      );
    }

    const usersQuery = `
      SELECT 
        user_id AS id, 
        company_id, 
        first_name, 
        last_name, 
        email, 
        phone, 
        address, 
        male, 
        is_active, 
        role, 
        create_date AS created_at, 
        update_date AS updated_at
      FROM mt_user
      WHERE company_id = $1
      ORDER BY create_date DESC
    `;
    const usersResult = await pool.query(usersQuery, [companyId]);

    return NextResponse.json({
      success: true,
      data: usersResult.rows,
    });

  } catch (error) {
    console.error('Users Fetch Error:', error);
    return NextResponse.json(
      { success: false, error: 'Серверт алдаа гарлаа.' },
      { status: 500 }
    );
  }
}

// 2. POST метод: Шинэ хэрэглэгч бүртгэх
export async function POST(request: Request) {
  try {
    // Ажилтан нэмэх нь зөвхөн админы эрх
    const { session, error: authError } = await requireAuth({ admin: true });
    if (authError) return authError;
    const companyId = session.companyId;

    const body = await request.json();
    const { first_name, last_name, password, phone, address, male } = body;
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const role = normalizeRole(body.role);

    if (!first_name || !last_name || !email) {
      return NextResponse.json(
        { success: false, error: 'Нэр, овог болон имэйл хаяг заавал шаардлагатай.' },
        { status: 400 }
      );
    }

    // Default нууц үг ашиглахгүй — админ шаардлага хангасан нууц үг өгөх ёстой
    const passwordError = validatePassword(password);
    if (passwordError) {
      return NextResponse.json({ success: false, error: passwordError }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const newUserId = randomUUID();

    const insertQuery = `
      INSERT INTO mt_user (user_id, company_id, email, password_hash, first_name, last_name, male, phone, address, role)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING 
        user_id AS id, 
        company_id, 
        first_name, 
        last_name, 
        email, 
        phone, 
        address, 
        male, 
        is_active, 
        role, 
        create_date AS created_at
    `;
    
    const values = [
      newUserId,
      companyId, 
      email, 
      passwordHash, 
      first_name, 
      last_name, 
      male || null,
      phone || null,
      address || null,
      role
    ];

    const newUserResult = await pool.query(insertQuery, values);
    await logAudit({
      session,
      action: 'employee.create',
      entityType: 'employee',
      entityId: newUserId,
      summary: `${last_name ?? ''} ${first_name ?? ''}`.trim(),
      details: { email, role },
    });

    return NextResponse.json({
      success: true,
      message: 'Хэрэглэгч амжилттай бүртгэгдлээ.',
      data: newUserResult.rows[0],
    });

  } catch (error: unknown) {
    console.error('User Save Error:', error);
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === '23505'
    ) {
      return NextResponse.json(
        { success: false, error: 'Энэ имэйл хаяг аль хэдийн бүртгэгдсэн байна.' },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, error: 'Серверт алдаа гарлаа.' },
      { status: 500 }
    );
  }
}