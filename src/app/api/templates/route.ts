import { NextResponse } from 'next/server';
import { requireAuth } from '@/src/lib/session';
import { pool } from '../../../lib/db'; // Төслийн замын дагуу тохируулна уу

// 1. Тухайн компанийн идэвхтэй (is_active = true) анкетын тохиргоог авах GET метод
export async function GET() {
  try {
    const { session: authSession, error: authError } = await requireAuth();
    if (authError) return authError;
    const session = authSession;
    const userId = session?.userId;

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Нэвтрээгүй байна.' },
        { status: 401 }
      );
    }

    // Хэрэглэгчийн харъяалагдах company_id-г mt_user хүснэгтээс олно
    const userQuery = 'SELECT company_id FROM mt_user WHERE user_id = $1';
    const userResult = await pool.query(userQuery, [userId]);

    if (userResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Хэрэглэгч олдсонгүй.' },
        { status: 404 }
      );
    }

    const companyId = userResult.rows[0].company_id;

    // Тухайн компанийн идэвхтэй байгаа mt_templates дэх анкетын мэдээллийг татах
    const templateQuery = `
      SELECT id, company_id, title, description, questions, is_active, created_at, updated_at
      FROM mt_templates
      WHERE company_id = $1 AND is_active = true
      LIMIT 1
    `;
    const templateResult = await pool.query(templateQuery, [companyId]);

    // Хэрэглэгч ямар нэг идэвхтэй анкетгүй бол null буцаана
    if (templateResult.rows.length === 0) {
      return NextResponse.json({
        success: true,
        data: null,
      });
    }

    return NextResponse.json({
      success: true,
      data: templateResult.rows[0],
    });

  } catch (error) {
    console.error('Template Fetch Error:', error);
    return NextResponse.json(
      { success: false, error: 'Серверт алдаа гарлаа.' },
      { status: 500 }
    );
  }
}

// 2. Анкетын шинэ хувилбар үүсгэх POST метод (Өмнөх хувилбаруудыг is_active = false болгоно)
export async function POST(request: Request) {
  try {
    // Нийтийн анкетын асуултыг зөвхөн админ өөрчилнө
    const { session, error: authError } = await requireAuth({ admin: true });
    if (authError) return authError;
    const { companyId } = session;

    const body = await request.json();
    const { title, description, questions } = body;

    if (!title || typeof title !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Анкетын гарчиг заавал шаардлагатай.' },
        { status: 400 }
      );
    }
    if (!Array.isArray(questions) || questions.length > 100) {
      return NextResponse.json(
        { success: false, error: 'Асуултын жагсаалт буруу байна (хамгийн ихдээ 100 асуулт).' },
        { status: 400 }
      );
    }

    // Бүх шалгалтын дараа л transaction-д холболт авна (холболтыг эрт эзэлбэл pool дуусч апп гацна)
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Өмнө нь идэвхтэй байсан бүх анкетын is_active утгыг false болгож өөрчлөх
      await client.query(
        `UPDATE mt_templates
         SET is_active = false, updated_at = CURRENT_TIMESTAMP
         WHERE company_id = $1 AND is_active = true`,
        [companyId]
      );

      // Шинэ хувилбарыг is_active = true байдлаар шинээр INSERT хийх
      await client.query(
        `INSERT INTO mt_templates (company_id, title, description, questions, is_active)
         VALUES ($1, $2, $3, $4::jsonb, true)`,
        [companyId, title.slice(0, 200), typeof description === 'string' ? description.slice(0, 2000) : null, JSON.stringify(questions)]
      );

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    return NextResponse.json({
      success: true,
      message: 'Анкетын шинэ загвар амжилттай хадгалагдлаа.',
    });
  } catch (error) {
    console.error('Template Save Error:', error);
    return NextResponse.json(
      { success: false, error: 'Серверт алдаа гарлаа.' },
      { status: 500 }
    );
  }
}
