import 'server-only';
import { NextResponse } from 'next/server';
import { requireAuth, type Session } from './session';

// Платформын (Active CRM-ийн өөрийн) админ: бүх компанийн багцыг идэвхжүүлэх, нүүр хуудасны контентыг засна.
// PLATFORM_ADMIN_EMAILS орчны хувьсагчид таслалаар тусгаарласан имэйлүүд (нэвтэрсэн хэрэглэгчийн имэйл).
export function isPlatformAdmin(email: string | null | undefined) {
  if (!email) return false;
  const list = (process.env.PLATFORM_ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.toLowerCase());
}

type Result = { session: Session; error?: never } | { session?: never; error: NextResponse };

export async function requirePlatformAdmin(): Promise<Result> {
  const { session, error } = await requireAuth({ allowExpired: true });
  if (error) return { error };
  if (!isPlatformAdmin(session.email)) {
    return { error: NextResponse.json({ success: false, error: 'Платформын админы эрх шаардлагатай.' }, { status: 403 }) };
  }
  return { session };
}
