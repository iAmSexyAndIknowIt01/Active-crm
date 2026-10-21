import 'server-only';
import { SignJWT, jwtVerify } from 'jose';
import { cookies, headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { pool } from './db';
import { clientIpFromHeaders } from './client-ip';
import { normalizeRole, type Role } from './roles';

export const SESSION_COOKIE = 'session';
const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 хоног

// Хуучин гарын үсэггүй cookie-нууд (нэвтрэх, гарах үед устгана)
const LEGACY_COOKIES = ['user_id', 'company_id', 'role'];

export type { Role } from './roles';
export { normalizeRole } from './roles';

// Cookie (JWT)-д хадгалагдах мэдээлэл. sid нь mt_session дахь серверийн session-ийг заана.
export interface SessionPayload {
  sid: string;
  userId: string;
  companyId: string;
}

export interface Session {
  sessionId: string;
  userId: string;
  companyId: string;
  role: Role;
  email: string;
}


function getKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error('SESSION_SECRET орчны хувьсагч тохируулагдаагүй байна.');
  }
  return new TextEncoder().encode(secret);
}

async function encrypt(payload: SessionPayload) {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(getKey());
}

// Гарын үсэг болон хугацааг шалгаад payload буцаана, буруу бол null.
// sid-гүй хуучин cookie-г хүлээн авахгүй (серверт хүчингүй болгох боломжгүй тул).
export async function decrypt(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getKey(), { algorithms: ['HS256'] });
    if (typeof payload.sid !== 'string' || typeof payload.userId !== 'string' || typeof payload.companyId !== 'string') {
      return null;
    }
    return { sid: payload.sid, userId: payload.userId, companyId: payload.companyId };
  } catch {
    return null;
  }
}

// Серверийн session хүчинтэй (гараагүй, хугацаа дуусаагүй) бөгөөд хэрэглэгч идэвхтэй эсэхийг шалгана.
// role-ыг DB-ээс авдаг тул эрх өөрчлөгдөхөд даруй үйлчилнэ.
export async function loadSession(payload: SessionPayload): Promise<Session | null> {
  const { rows } = await pool.query(
    `SELECT u.role, u.email
     FROM mt_session s
     JOIN mt_user u ON u.user_id = s.user_id
     WHERE s.session_id::text = $1
       AND s.user_id::text = $2
       AND u.company_id::text = $3
       AND s.revoked_at IS NULL
       AND s.expires_at > now()
       AND u.is_active IS NOT FALSE`,
    [payload.sid, payload.userId, payload.companyId]
  );
  const user = rows[0];
  if (!user) return null;
  return {
    sessionId: payload.sid,
    userId: payload.userId,
    companyId: payload.companyId,
    role: normalizeRole(user.role),
    email: String(user.email ?? '').toLowerCase(),
  };
}

export async function createSession({ userId, companyId }: { userId: string; companyId: string }) {
  const headerStore = await headers();
  const { rows } = await pool.query(
    `INSERT INTO mt_session (user_id, expires_at, user_agent, ip)
     VALUES ($1, now() + make_interval(secs => $2), $3, $4)
     RETURNING session_id`,
    [userId, SESSION_MAX_AGE, headerStore.get('user-agent')?.slice(0, 300) ?? null, clientIpFromHeaders(headerStore)]
  );

  // Хугацаа нь дууссан, хүчингүй болсон хуучин session-уудыг хааяа цэвэрлэнэ (~5%)
  if (Math.random() < 0.05) {
    pool
      .query(`DELETE FROM mt_session WHERE expires_at < now() - interval '30 days' OR revoked_at < now() - interval '30 days'`)
      .catch(() => {});
  }

  const token = await encrypt({ sid: rows[0].session_id, userId, companyId });
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  });
  LEGACY_COOKIES.forEach((name) => cookieStore.delete(name));
}

// API route-уудад нэвтэрсэн хэрэглэгчийн мэдээллийг авах
export async function getSession(): Promise<Session | null> {
  const cookieStore = await cookies();
  const payload = await decrypt(cookieStore.get(SESSION_COOKIE)?.value);
  if (!payload) return null;
  return loadSession(payload);
}

type AuthResult = { session: Session; error?: never } | { session?: never; error: NextResponse };

// Route handler-ийн эхэнд: const { session, error } = await requireAuth({ admin: true }); if (error) return error;
//   admin: true        — зөвхөн админ
//   roles: [...]       — жагсаасан эрхтэй хэрэглэгч (жнь MANAGER_ROLES = админ, менежер)
export async function requireAuth(options: { admin?: boolean; roles?: Role[] } = {}): Promise<AuthResult> {
  const session = await getSession();
  if (!session) {
    return {
      error: NextResponse.json({ success: false, error: 'Нэвтрээгүй байна. Дахин нэвтэрнэ үү.' }, { status: 401 }),
    };
  }
  if (options.admin && session.role !== 'admin') {
    return {
      error: NextResponse.json({ success: false, error: 'Энэ үйлдлийг зөвхөн админ хийх эрхтэй.' }, { status: 403 }),
    };
  }
  if (options.roles && !options.roles.includes(session.role)) {
    return {
      error: NextResponse.json({ success: false, error: 'Танд энэ үйлдлийг хийх эрх байхгүй.' }, { status: 403 }),
    };
  }
  return { session };
}

// Хэрэглэгчийн session-уудыг хүчингүй болгоно (нууц үг, имэйл солих, сэргээх үед).
// exceptSessionId өгвөл одоо ашиглаж буй session-ийг үлдээнэ.
export async function revokeUserSessions(userId: string, exceptSessionId?: string) {
  await pool.query(
    `UPDATE mt_session SET revoked_at = now()
     WHERE user_id::text = $1 AND revoked_at IS NULL AND ($2::text IS NULL OR session_id::text <> $2)`,
    [userId, exceptSessionId ?? null]
  );
}

// Гарах: серверийн session-ийг хүчингүй болгож cookie-г устгана.
// Cookie хулгайлагдсан байсан ч гарсны дараа ажиллахаа болино.
export async function deleteSession() {
  const cookieStore = await cookies();
  const payload = await decrypt(cookieStore.get(SESSION_COOKIE)?.value);
  if (payload) {
    await pool.query(`UPDATE mt_session SET revoked_at = now() WHERE session_id::text = $1 AND revoked_at IS NULL`, [payload.sid]);
  }
  cookieStore.delete(SESSION_COOKIE);
  LEGACY_COOKIES.forEach((name) => cookieStore.delete(name));
}
