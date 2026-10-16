import { NextResponse } from 'next/server';
import { pool } from '../../../../lib/db';
import { sendEmail } from '../../../../lib/email';
import { checkRateLimits, getClientIp } from '../../../../lib/rate-limit';
import { generateResetCode, hashResetCode, RESET_CODE_TTL_MINUTES } from '../../../../lib/password-reset';

// Имэйл бүртгэлтэй эсэхээс үл хамааран ижил хариу буцаана (бүртгэлтэй имэйлийг таахаас сэргийлнэ)
const GENERIC_RESPONSE = {
  message: 'Хэрэв энэ имэйл бүртгэлтэй бол баталгаажуулах код илгээгдлээ. Имэйлээ шалгана уу.',
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';

    if (!email) {
      return NextResponse.json({ error: 'Имэйл хаягаа оруулна уу.' }, { status: 400 });
    }

    const limited = await checkRateLimits([
      { key: `forgot:ip:${getClientIp(request)}`, limit: 5, windowSeconds: 15 * 60 },
      { key: `forgot:email:${email}`, limit: 3, windowSeconds: 15 * 60 },
    ]);
    if (limited) return limited;

    const { rows } = await pool.query(
      `SELECT user_id, first_name FROM mt_user WHERE LOWER(email) = $1 AND is_active IS NOT FALSE`,
      [email]
    );
    const user = rows[0];
    if (!user) {
      return NextResponse.json(GENERIC_RESPONSE, { status: 200 });
    }

    const code = generateResetCode();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // Өмнөх кодуудыг хүчингүй болгож, шинэ кодыг hash-аар хадгална
      await client.query('DELETE FROM mt_password_reset WHERE user_id = $1', [user.user_id]);
      await client.query(
        `INSERT INTO mt_password_reset (user_id, code_hash, expires_at)
         VALUES ($1, $2, now() + make_interval(mins => $3))`,
        [user.user_id, hashResetCode(user.user_id, code), RESET_CODE_TTL_MINUTES]
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    await sendEmail({
      to: email,
      subject: 'Active CRM: нууц үг сэргээх код',
      text: [
        `Сайн байна уу${user.first_name ? `, ${user.first_name}` : ''}!`,
        '',
        `Таны нууц үг сэргээх код: ${code}`,
        `Код ${RESET_CODE_TTL_MINUTES} минутын дотор хүчинтэй.`,
        '',
        'Хэрэв та энэ хүсэлтийг илгээгээгүй бол энэ имэйлийг үл тоомсорлоно уу.',
      ].join('\n'),
    });

    return NextResponse.json(GENERIC_RESPONSE, { status: 200 });
  } catch (error) {
    console.error('Forgot Password Error:', error);
    return NextResponse.json({ error: 'Серверт алдаа гарлаа. Түр хүлээнэ үү.' }, { status: 500 });
  }
}
