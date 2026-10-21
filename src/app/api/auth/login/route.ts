import { NextResponse } from 'next/server';
import { compare, hashSync } from 'bcrypt';
import { pool } from '../../../../lib/db'; // Таны өөрийн db холболтын файл
import { createSession, normalizeRole } from '../../../../lib/session';
import {
  checkRateLimits,
  clearRateLimit,
  getClientIp,
  isRateLimited,
  rateLimit,
  tooManyAttempts,
} from '../../../../lib/rate-limit';

// Бүртгэлгүй имэйлээр оролдоход ч bcrypt шалгалт хийж, хариу өгөх хугацаагаар
// имэйл бүртгэлтэй эсэхийг таах боломжийг хаана
const DUMMY_HASH = hashSync('timing-safe-dummy-password', 10);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password } = body;

    // 1. Оролтын өгөгдлийг шалгах
    if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
      return NextResponse.json(
        { error: 'Имэйл болон нууц үгээ оруулна уу.' },
        { status: 400 }
      );
    }
    const normalizedEmail = email.trim().toLowerCase();

    // 2. Нууц үг таах оролдлогыг хязгаарлах
    //    * IP-ээр: 15 минутад 20 оролдлого (амжилттай, амжилтгүй аль аль нь)
    //    * имэйл + IP-ээр: 15 минутад 10 амжилтгүй оролдлого
    //    * имэйлээр (бүх IP нийлээд): цагт 50 амжилтгүй оролдлого — тархсан халдлагыг удаашруулна
    //    Имэйлийн хязгаар зөвхөн амжилтгүй оролдлогыг тоолж, IP-тэй хослуулсан тул өөр газраас
    //    бусдын бүртгэлийг түгжих боломж хумигдана.
    const ip = getClientIp(request);
    const limited = await checkRateLimits([{ key: `login:ip:${ip}`, limit: 20, windowSeconds: 15 * 60 }]);
    if (limited) return limited;

    const failKeys = [
      { key: `login:fail:${normalizedEmail}:${ip}`, limit: 10, windowSeconds: 15 * 60 },
      { key: `login:fail:${normalizedEmail}`, limit: 50, windowSeconds: 60 * 60 },
    ];
    for (const { key, limit, windowSeconds } of failKeys) {
      const { limited: blocked, retryAfter } = await isRateLimited(key, limit, windowSeconds);
      if (blocked) return tooManyAttempts(retryAfter);
    }

    // 3. mt_user хүснэгтээс хэрэглэгчийг имэйлээр хайх
    const result = await pool.query(
      'SELECT * FROM mt_user WHERE LOWER(email) = $1',
      [normalizedEmail]
    );
    const user = result.rows[0];

    // 4. Нууц үг тохирч байгаа эсэхийг шалгах (mt_user.password_hash)
    const isPasswordValid = await compare(password, user?.password_hash ?? DUMMY_HASH);

    if (!user || !isPasswordValid) {
      for (const { key, limit, windowSeconds } of failKeys) await rateLimit(key, limit, windowSeconds);
      return NextResponse.json(
        { error: 'Имэйл эсвэл нууц үг буруу байна.' },
        { status: 401 }
      );
    }

    // 5. Идэвхгүй болгосон хэрэглэгчийг нэвтрүүлэхгүй
    if (user.is_active === false) {
      return NextResponse.json(
        { error: 'Таны бүртгэл идэвхгүй болсон байна. Админд хандана уу.' },
        { status: 403 }
      );
    }

    // 6. Имэйлээ баталгаажуулаагүй бол нэвтрүүлэхгүй (нэвтрэх хуудас холбоосыг дахин илгээх боломж харуулна)
    if (!user.email_verified_at) {
      return NextResponse.json(
        {
          error: 'Имэйл хаягаа баталгаажуулаагүй байна. Имэйлээр ирсэн холбоосоор орж баталгаажуулна уу.',
          code: 'email_not_verified',
        },
        { status: 403 }
      );
    }

    // 7. user_id, company_id-г гарын үсэгтэй session cookie-д хадгалах.
    //    role-ийг cookie-д хуулахгүй: loadSession() хүсэлт бүрт user_id-аар mt_user.role-ийг уншдаг
    //    тул эрх солигдоход даруй үйлчилнэ.
    await clearRateLimit(failKeys[0].key);
    await createSession({
      userId: String(user.user_id),
      companyId: String(user.company_id),
    });

    // 8. Амжилттай нэвтэрсэн үед хэрэглэгчийн мэдээллийг буцаах
    return NextResponse.json(
      {
        message: 'Амжилттай нэвтэрлээ.',
        user: {
          userId: user.user_id,
          companyId: user.company_id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          role: normalizeRole(user.role),
        },
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('Login Error:', error);
    return NextResponse.json(
      { error: 'Серверт алдаа гарлаа. Түр хүлээнэ үү.' },
      { status: 500 }
    );
  }
}