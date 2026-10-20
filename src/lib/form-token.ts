import 'server-only';
import { createHmac, timingSafeEqual } from 'crypto';

// Нийтийн QR анкетын роботын эсрэг токен.
// Анкетыг ачаалах (GET) үед "<unix ms>.<hmac>" токен өгч, илгээх (POST) үед шалгана:
//   - токенгүй / хуурамч бол татгалзана (анкетын хуудсыг ачаалалгүйгээр шууд POST хийх роботыг хаана)
//   - ачаалснаас хойш MIN_FILL_MS-ээс хурдан илгээвэл татгалзана (хүн ингэж хурдан бөглөхгүй)
//   - MAX_AGE_MS-ээс хуучин бол хуудсыг дахин ачаалахыг хүснэ
export const MIN_FILL_MS = 3_000;
export const MAX_AGE_MS = 24 * 60 * 60 * 1000;

function sign(templateId: string, issuedAt: number) {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error('SESSION_SECRET орчны хувьсагч тохируулагдаагүй байна.');
  return createHmac('sha256', secret).update(`form:${templateId}:${issuedAt}`).digest('base64url');
}

export function issueFormToken(templateId: string, now = Date.now()) {
  return `${now}.${sign(templateId, now)}`;
}

export type FormTokenCheck = 'ok' | 'invalid' | 'too_fast' | 'expired';

export function checkFormToken(token: unknown, templateId: string, now = Date.now()): FormTokenCheck {
  if (typeof token !== 'string') return 'invalid';
  const [issuedText, signature] = token.split('.');
  const issuedAt = Number(issuedText);
  if (!signature || !Number.isSafeInteger(issuedAt)) return 'invalid';

  const expected = Buffer.from(sign(templateId, issuedAt));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return 'invalid';

  const age = now - issuedAt;
  if (age < MIN_FILL_MS) return 'too_fast';
  if (age > MAX_AGE_MS) return 'expired';
  return 'ok';
}
