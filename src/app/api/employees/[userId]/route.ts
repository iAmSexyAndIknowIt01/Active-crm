import { NextResponse } from 'next/server';
import { pool } from '@/src/lib/db';
import { getSession, normalizeRole, requireAuth } from '@/src/lib/session';
import { diffFields, logAudit } from '@/src/lib/audit';

// Мэдээлэл авах (GET)
export async function GET(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Нэвтрээгүй байна.' },
        { status: 401 }
      );
    }

    const { userId } = await params;

    if (!userId || userId === 'undefined') {
      return NextResponse.json(
        { success: false, error: 'Хэрэглэгчийн ID буруу байна.' },
        { status: 400 }
      );
    }

    const query = `
      SELECT 
        u.user_id,
        u.company_id,
        u.email,
        u.first_name,
        u.last_name,
        u.male,
        u.phone,
        u.address,
        u.is_active,
        u.create_date,
        u.update_date,
        u.role,
        u.position,
        c.company_name
      FROM mt_user u
      LEFT JOIN mt_company c ON u.company_id = c.company_id
      WHERE u.user_id = $1 AND u.company_id = $2
    `;

    // Зөвхөн өөрийн компанийн ажилтны мэдээллийг харуулна
    const result = await pool.query(query, [userId, session.companyId]);

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Хэрэглэгч олдсонгүй.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.rows[0],
    });

  } catch (error) {
    console.error('Fetch User Detail Error:', error);
    return NextResponse.json(
      { success: false, error: 'Серверт алдаа гарлаа.' },
      { status: 500 }
    );
  }
}

// Мэдээлэл шинэчилж хадгалах (POST)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    // Бусдын мэдээлэл, эрх, идэвхтэй эсэхийг зөвхөн админ өөрчилнө (өөрийн мэдээллийг /api/profile-аар)
    const { session, error: authError } = await requireAuth({ admin: true });
    if (authError) return authError;

    const { userId } = await params;
    const body = await request.json();

    if (!userId || userId === 'undefined') {
      return NextResponse.json(
        { success: false, error: 'Хэрэглэгчийн ID буруу байна.' },
        { status: 400 }
      );
    }

    const {
      first_name,
      last_name,
      male,
      phone,
      address,
      position
    } = body;
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : body.email;
    const role = normalizeRole(body.role);
    const is_active = body.is_active !== false && body.is_active !== 'false';

    // Админ өөрийгөө идэвхгүй болгох эсвэл эрхээ хасаж, компанид админгүй болгохоос сэргийлнэ
    if (userId === session.userId && (role !== 'admin' || !is_active)) {
      return NextResponse.json(
        { success: false, error: 'Өөрийн админ эрхийг хасах эсвэл өөрийгөө идэвхгүй болгох боломжгүй.' },
        { status: 400 }
      );
    }

    const updateQuery = `
      UPDATE mt_user 
      SET 
        email = $1,
        first_name = $2,
        last_name = $3,
        male = $4,
        phone = $5,
        address = $6,
        is_active = $7,
        role = $8,
        position = $9,
        update_date = CURRENT_TIMESTAMP
      WHERE user_id = $10 AND company_id = $11
      RETURNING user_id;
    `;

    const values = [
      email,
      first_name,
      last_name,
      male,
      phone,
      address,
      is_active,
      role,
      position,
      userId,
      session.companyId
    ];

    const before = await pool.query(
      'SELECT email, role, is_active, position, first_name, last_name FROM mt_user WHERE user_id = $1 AND company_id = $2',
      [userId, session.companyId]
    );
    const updateResult = await pool.query(updateQuery, values);
    if (updateResult.rows.length > 0 && before.rows[0]) {
      // Эрх, идэвх, имэйл өөрчлөгдсөнийг түүхэнд бичнэ
      const changes = diffFields(before.rows[0], { email, role, is_active, position, first_name, last_name }, ['email', 'role', 'is_active', 'position', 'first_name', 'last_name']);
      if (Object.keys(changes).length > 0) {
        await logAudit({
          session,
          action: 'employee.update',
          entityType: 'employee',
          entityId: userId,
          summary: `${last_name ?? ''} ${first_name ?? ''}`.trim(),
          details: changes,
        });
      }
    }

    if (updateResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Шинэчлэх хэрэглэгч олдсонгүй.' },
        { status: 404 }
      );
    }

    // Компанийн нэрийг хамт буцаахын тулд дахин company join хийж авна
    const detailQuery = `
      SELECT
        u.user_id,
        u.company_id,
        u.email,
        u.first_name,
        u.last_name,
        u.male,
        u.phone,
        u.address,
        u.is_active,
        u.create_date,
        u.update_date,
        u.role,
        u.position,
        c.company_name
      FROM mt_user u
      LEFT JOIN mt_company c ON u.company_id = c.company_id
      WHERE u.user_id = $1
    `;
    const finalResult = await pool.query(detailQuery, [userId]);

    return NextResponse.json({
      success: true,
      data: finalResult.rows[0],
    });

  } catch (error: unknown) {
    console.error('Update User Error:', error);
    // DB-ийн алдааны дэлгэрэнгүйг клиент рүү гаргахгүй; зөвхөн давхцсан имэйлийг тайлбарлана
    const isDuplicateEmail =
      typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === '23505';
    return NextResponse.json(
      {
        success: false,
        error: isDuplicateEmail ? 'Энэ имэйл хаяг аль хэдийн бүртгэгдсэн байна.' : 'Серверт алдаа гарлаа.',
      },
      { status: isDuplicateEmail ? 400 : 500 }
    );
  }
}