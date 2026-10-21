import 'server-only';
import { createHmac, timingSafeEqual } from 'crypto';

// Имэйл баталгаажуулах холбоосын токен: "<userId>.<дуусах unix ms>.<hmac>".
// Хэрэглэгчийн имэйлийг HMAC-д оруулдаг тул имэйл солигдвол хуучин холбоос хүчингүй болно.
// DB-д хадгалах шаардлагагүй (SESSION_SECRET-ээр гарын үсэг зурна).
const TOKEN_TTL_MS = 48 * 60 * 60 * 1000;

function sign(userId: string, email: string, expires: number) {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error('SESSION_SECRET орчны хувьсагч тохируулагдаагүй байна.');
  return createHmac('sha256', secret).update(`verify:${userId}:${email.toLowerCase()}:${expires}`).digest('base64url');
}

export function issueVerificationToken(userId: string, email: string, now = Date.now()) {
  const expires = now + TOKEN_TTL_MS;
  return `${userId}.${expires}.${sign(userId, email, expires)}`;
}

// Токены бүтцийг задлана (имэйлийг DB-ээс авч checkVerificationToken-оор шалгана)
export function parseVerificationToken(token: unknown): { userId: string; expires: number; signature: string } | null {
  if (typeof token !== 'string') return null;
  const [userId, expiresText, signature] = token.split('.');
  const expires = Number(expiresText);
  if (!userId || !signature || !Number.isSafeInteger(expires)) return null;
  return { userId, expires, signature };
}

export function checkVerificationToken(
  parsed: { userId: string; expires: number; signature: string },
  email: string,
  now = Date.now()
): 'ok' | 'invalid' | 'expired' {
  const expected = Buffer.from(sign(parsed.userId, email, parsed.expires));
  const actual = Buffer.from(parsed.signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return 'invalid';
  if (now > parsed.expires) return 'expired';
  return 'ok';
}

// Холбоосын үндсэн хаяг: APP_URL (жнь https://activecrm.mn) эсвэл хүсэлтийн origin
export function appOrigin(request: Request) {
  return (process.env.APP_URL || new URL(request.url).origin).replace(/\/$/, '');
}

export function verificationEmailText(firstName: string, link: string) {
  return [
    `Сайн байна уу${firstName ? `, ${firstName}` : ''}!`,
    '',
    'Active CRM-д бүртгүүлсэн танд баярлалаа. Бүртгэлээ идэвхжүүлэхийн тулд доорх холбоосоор орж имэйлээ баталгаажуулна уу:',
    '',
    link,
    '',
    'Холбоос 48 цагийн дотор хүчинтэй. Хэрэв та бүртгүүлээгүй бол энэ имэйлийг үл тоомсорлоно уу.',
  ].join('\n');
}
