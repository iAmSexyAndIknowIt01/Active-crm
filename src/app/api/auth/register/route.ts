import { NextResponse } from 'next/server';
import { hash } from 'bcrypt';
import crypto from 'crypto';
import { pool } from '../../../../lib/db';
import { sendEmail } from '../../../../lib/email';
import { validatePassword } from '../../../../lib/password';
import { checkRateLimits, getClientIp } from '../../../../lib/rate-limit';
import { appOrigin, issueVerificationToken, verificationEmailText } from '../../../../lib/email-verification';

// Имэйл аль хэдийн бүртгэлтэй эсэхээс үл хамааран ижил хариу буцаана.
// Ингэснээр бүртгэлийн хуудсаар дамжуулан хэн манай системд бүртгэлтэйг таах боломжгүй.
// Жинхэнэ мэдээллийг имэйлийн эзэнд имэйлээр илгээнэ.
const GENERIC_RESPONSE = {
  message: 'Бүртгэлийн хүсэлтийг хүлээн авлаа. Дэлгэрэнгүй мэдээллийг имэйлээсээ шалгана уу.',
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { companyName, lastName, firstName, password } = body;
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';

    // 1. Оролтын өгөгдлийг шалгах
    if (!companyName || !lastName || !firstName || !email || !password) {
      return NextResponse.json({ error: 'Бүх талбарыг бөглөнө үү.' }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) {
      return NextResponse.json({ error: 'Имэйл хаяг буруу байна.' }, { status: 400 });
    }
    const passwordError = validatePassword(password);
    if (passwordError) {
      return NextResponse.json({ error: passwordError }, { status: 400 });
    }

    // 2. Олноор бүртгэл үүсгэхээс сэргийлэх: нэг IP-ээс цагт 5
    const limited = await checkRateLimits([
      { key: `register:ip:${getClientIp(request)}`, limit: 5, windowSeconds: 60 * 60 },
    ]);
    if (limited) return limited;

    // Хариу өгөх хугацаагаар ялгагдахгүйн тулд хоёр тохиолдолд нууц үгийг хашина
    const passwordHash = await hash(password, 10);

    const { rows: existing } = await pool.query(
      'SELECT user_id, company_id, first_name, email_verified_at FROM mt_user WHERE LOWER(email) = $1',
      [email]
    );

    // Имэйлээ баталгаажуулаагүй бүртгэл байвал шинэ мэдээллээр шинэчилж, холбоосыг дахин илгээнэ.
    // Ингэснээр бусдын имэйлээр бүртгэл үүсгэж, жинхэнэ эзнийг бүртгүүлэх боломжгүй болгохоос сэргийлнэ.
    if (existing.length > 0 && !existing[0].email_verified_at) {
      const pending = existing[0];
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('UPDATE mt_company SET company_name = $1, updated_at = CURRENT_TIMESTAMP WHERE company_id = $2', [
          String(companyName).trim().slice(0, 200),
          pending.company_id,
        ]);
        await client.query(
          `UPDATE mt_user SET password_hash = $1, first_name = $2, last_name = $3, update_date = CURRENT_TIMESTAMP
           WHERE user_id = $4 AND email_verified_at IS NULL`,
          [passwordHash, String(firstName).trim().slice(0, 100), String(lastName).trim().slice(0, 100), pending.user_id]
        );
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
      await sendVerification(request, pending.user_id, email, String(firstName));
      return NextResponse.json(GENERIC_RESPONSE, { status: 201 });
    }

    if (existing.length > 0) {
      await sendEmail({
        to: email,
        subject: 'Active CRM: бүртгүүлэх оролдлого',
        text: [
          `Сайн байна уу${existing[0].first_name ? `, ${existing[0].first_name}` : ''}!`,
          '',
          'Таны имэйл хаягаар Active CRM-д дахин бүртгүүлэх оролдлого хийгдлээ.',
          'Та аль хэдийн бүртгэлтэй тул шинэ бүртгэл үүсээгүй. Өөрийн нууц үгээрээ нэвтэрнэ үү,',
          'нууц үгээ мартсан бол нэвтрэх хуудасны "Нууц үг сэргээх"-ийг ашиглана уу.',
          '',
          'Хэрэв та энэ оролдлогыг хийгээгүй бол энэ имэйлийг үл тоомсорлоно уу.',
        ].join('\n'),
      }).catch((error) => console.error('Register notice email failed:', error));
      return NextResponse.json(GENERIC_RESPONSE, { status: 201 });
    }

    // 3. Бүх шалгалтын дараа л transaction-д холболт авна.
    //    Холболтыг эрт авбал (pool нь цөөн холболттой) зэрэг ирсэн хүсэлтүүд бүх холболтыг эзэлж,
    //    rate limit-ийн query чөлөөтэй холболт хүлээн бүх апп гацна.
    const companyId = crypto.randomUUID();
    const userId = crypto.randomUUID();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`INSERT INTO mt_company (company_id, company_name, email) VALUES ($1, $2, $3)`, [
        companyId,
        String(companyName).trim().slice(0, 200),
        email,
      ]);
      await client.query(
        `INSERT INTO mt_user (user_id, company_id, email, password_hash, first_name, last_name, role)
         VALUES ($1, $2, $3, $4, $5, $6, 'admin')`,
        [userId, companyId, email, passwordHash, String(firstName).trim().slice(0, 100), String(lastName).trim().slice(0, 100)]
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      // Зэрэг ирсэн хоёр хүсэлт ижил имэйлээр бүртгүүлэх үед (unique зөрчил) ч ижил хариу
      if ((error as { code?: string }).code === '23505') return NextResponse.json(GENERIC_RESPONSE, { status: 201 });
      throw error;
    } finally {
      client.release();
    }

    await sendVerification(request, userId, email, String(firstName));

    return NextResponse.json(GENERIC_RESPONSE, { status: 201 });
  } catch (error) {
    console.error('Registration Error:', error);
    return NextResponse.json({ error: 'Серверт алдаа гарлаа. Түр хүлээнэ үү.' }, { status: 500 });
  }
}

// Имэйл баталгаажуулах холбоос илгээнэ (бүртгэл нь баталгаажтал нэвтрэх боломжгүй)
async function sendVerification(request: Request, userId: string, email: string, firstName: string) {
  const link = `${appOrigin(request)}/verify-email?token=${encodeURIComponent(issueVerificationToken(userId, email))}`;
  await sendEmail({
    to: email,
    subject: 'Active CRM: имэйлээ баталгаажуулна уу',
    text: verificationEmailText(firstName.trim(), link),
  }).catch((error) => console.error('Verification email failed:', error));
}
