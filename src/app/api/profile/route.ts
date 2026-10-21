import { NextResponse } from 'next/server';
import { getSession, requireAuth, revokeUserSessions } from '@/src/lib/session';
import { validatePassword } from '@/src/lib/password';
import { checkRateLimits } from '@/src/lib/rate-limit';
import { hash, compare } from 'bcrypt';
import { pool } from '../../../lib/db';

// 1. Хэрэглэгчийн мэдээллийг авах GET метод
export async function GET() {
  try {
    const session = await getSession();
    const userId = session?.userId;

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Нэвтрээгүй байна.' },
        { status: 401 }
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
        u.role,
        c.company_name
      FROM mt_user u
      JOIN mt_company c ON u.company_id = c.company_id
      WHERE u.user_id = $1
    `;

    const result = await pool.query(query, [userId]);

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
    console.error('Profile Fetch Error:', error);
    return NextResponse.json(
      { success: false, error: 'Серверт алдаа гарлаа.' },
      { status: 500 }
    );
  }
}

// 2. Хэрэглэгчийн мэдээлэл болон нууц үг шинэчлэх PUT метод.
// Имэйл эсвэл нууц үг солиход одоогийн нууц үгийг заавал шаардана: session хулгайлсан хүн
// имэйлийг өөрийнхөөрөө сольж, дараа нь нууц үг сэргээн бүртгэлийг булаахаас сэргийлнэ.
// Солигдсоны дараа бусад төхөөрөмж дээрх session-уудыг хүчингүй болгоно.
export async function PUT(request: Request) {
  try {
    const { session, error: authError } = await requireAuth({ allowExpired: true });
    if (authError) return authError;
    const { userId, sessionId } = session;

    const body = await request.json();
    const text = (value: unknown, max: number) => (typeof value === 'string' ? value.trim().slice(0, max) : '');
    const firstName = text(body.firstName, 100);
    const lastName = text(body.lastName, 100);
    const email = text(body.email, 200).toLowerCase();
    const phone = text(body.phone, 50) || null;
    const address = text(body.address, 500) || null;
    const currentPassword = typeof body.currentPassword === 'string' ? body.currentPassword : '';
    const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';

    if (!firstName || !lastName) {
      return NextResponse.json({ success: false, error: 'Овог, нэрээ оруулна уу.' }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ success: false, error: 'Имэйл хаяг буруу байна.' }, { status: 400 });
    }

    const { rows } = await pool.query('SELECT email, password_hash FROM mt_user WHERE user_id = $1', [userId]);
    const current = rows[0];
    if (!current) {
      return NextResponse.json({ success: false, error: 'Хэрэглэгч олдсонгүй.' }, { status: 404 });
    }

    const emailChanged = email !== String(current.email).toLowerCase();
    const passwordChanging = newPassword.trim() !== '';

    if (passwordChanging) {
      const passwordError = validatePassword(newPassword);
      if (passwordError) {
        return NextResponse.json({ success: false, error: passwordError }, { status: 400 });
      }
    }

    if (emailChanged || passwordChanging) {
      if (!currentPassword) {
        return NextResponse.json(
          {
            success: false,
            error: emailChanged && !passwordChanging
              ? 'Имэйл хаягаа солихын тулд одоогийн нууц үгээ оруулна уу.'
              : 'Одоогийн нууц үгээ оруулна уу.',
          },
          { status: 400 }
        );
      }
      // Одоогийн нууц үгийг таах оролдлогыг хязгаарлах
      const limited = await checkRateLimits([
        { key: `profile-password:user:${userId}`, limit: 5, windowSeconds: 15 * 60 },
      ]);
      if (limited) return limited;

      if (!(await compare(currentPassword, current.password_hash))) {
        return NextResponse.json({ success: false, error: 'Оруулсан одоогийн нууц үг буруу байна.' }, { status: 400 });
      }
    }

    const passwordHash = passwordChanging ? await hash(newPassword, 10) : null;
    await pool.query(
      `UPDATE mt_user
       SET first_name = $1, last_name = $2, email = $3, phone = $4, address = $5,
           password_hash = COALESCE($6, password_hash), update_date = CURRENT_TIMESTAMP
       WHERE user_id = $7`,
      [firstName, lastName, email, phone, address, passwordHash, userId]
    );

    // Нэвтрэх мэдээлэл солигдсон тул бусад төхөөрөмж дээрх session-уудыг хүчингүй болгоно
    const signedOutOthers = emailChanged || passwordChanging;
    if (signedOutOthers) await revokeUserSessions(userId, sessionId);

    return NextResponse.json({
      success: true,
      message: signedOutOthers
        ? 'Мэдээлэл шинэчлэгдлээ. Бусад төхөөрөмж дээрх нэвтрэлтийг хаалаа.'
        : 'Мэдээлэл амжилттай шинэчлэгдлээ.',
    });
  } catch (error) {
    console.error('Profile Update Error:', error);
    if ((error as { code?: string }).code === '23505') {
      return NextResponse.json({ success: false, error: 'Энэ имэйл хаяг аль хэдийн бүртгэгдсэн байна.' }, { status: 400 });
    }
    return NextResponse.json(
      { success: false, error: 'Серверт алдаа гарлаа.' },
      { status: 500 }
    );
  }
}
