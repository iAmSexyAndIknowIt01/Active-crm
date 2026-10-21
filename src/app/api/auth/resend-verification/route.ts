import { NextResponse } from 'next/server';
import { pool } from '@/src/lib/db';
import { sendEmail } from '@/src/lib/email';
import { checkRateLimits, getClientIp } from '@/src/lib/rate-limit';
import { appOrigin, issueVerificationToken, verificationEmailText } from '@/src/lib/email-verification';

// Баталгаажуулах холбоосыг дахин илгээх. Имэйл бүртгэлтэй эсэхээс үл хамааран ижил хариу өгнө.
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    const response = NextResponse.json({
      success: true,
      message: 'Хэрэв энэ имэйл баталгаажуулаагүй бүртгэлтэй бол шинэ холбоос илгээгдлээ.',
    });
    if (!email) return response;

    const limited = await checkRateLimits([
      { key: `verify-resend:ip:${getClientIp(request)}`, limit: 10, windowSeconds: 60 * 60 },
      { key: `verify-resend:email:${email}`, limit: 3, windowSeconds: 60 * 60 },
    ]);
    if (limited) return limited;

    const { rows } = await pool.query(
      'SELECT user_id, first_name FROM mt_user WHERE LOWER(email) = $1 AND email_verified_at IS NULL',
      [email]
    );
    if (rows[0]) {
      const link = `${appOrigin(request)}/verify-email?token=${encodeURIComponent(issueVerificationToken(rows[0].user_id, email))}`;
      await sendEmail({
        to: email,
        subject: 'Active CRM: имэйлээ баталгаажуулна уу',
        text: verificationEmailText(rows[0].first_name ?? '', link),
      }).catch((error) => console.error('Verification resend failed:', error));
    }
    return response;
  } catch (error) {
    console.error('Resend Verification Error:', error);
    return NextResponse.json({ success: false, error: 'Серверт алдаа гарлаа.' }, { status: 500 });
  }
}
