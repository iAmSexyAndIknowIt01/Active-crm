import { NextResponse } from 'next/server';
import { pool } from '@/src/lib/db';
import { checkVerificationToken, parseVerificationToken } from '@/src/lib/email-verification';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Имэйл баталгаажуулах холбоосын токеныг шалгаж, бүртгэлийг идэвхжүүлнэ
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const parsed = parseVerificationToken(body?.token);
    if (!parsed || !UUID_RE.test(parsed.userId)) {
      return NextResponse.json({ success: false, error: 'Баталгаажуулах холбоос буруу байна.' }, { status: 400 });
    }

    const { rows } = await pool.query('SELECT email, email_verified_at FROM mt_user WHERE user_id = $1', [parsed.userId]);
    const user = rows[0];
    if (!user) return NextResponse.json({ success: false, error: 'Баталгаажуулах холбоос буруу байна.' }, { status: 400 });
    if (user.email_verified_at) return NextResponse.json({ success: true, alreadyVerified: true });

    const result = checkVerificationToken(parsed, user.email);
    if (result !== 'ok') {
      return NextResponse.json(
        {
          success: false,
          error:
            result === 'expired'
              ? 'Холбоосын хугацаа дууссан байна. Нэвтрэх хуудаснаас шинэ холбоос авна уу.'
              : 'Баталгаажуулах холбоос буруу байна.',
        },
        { status: 400 }
      );
    }

    await pool.query('UPDATE mt_user SET email_verified_at = now() WHERE user_id = $1 AND email_verified_at IS NULL', [parsed.userId]);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Verify Email Error:', error);
    return NextResponse.json({ success: false, error: 'Серверт алдаа гарлаа.' }, { status: 500 });
  }
}
