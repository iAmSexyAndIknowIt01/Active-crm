import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { decrypt, loadSession, SESSION_COOKIE } from '@/src/lib/session';
import { canAccessPath, homePathFor } from '@/src/lib/roles';

// Урьдчилсан шалгалт: session хүчингүй (гарсан, хугацаа дууссан, нууц үг солигдсон) эсвэл
// хэрэглэгч идэвхгүй бол dashboard-ыг нээлгүй login руу шилжүүлнэ.
// Жинхэнэ эрхийн шалгалт API route бүр дээр getSession()/requireAuth()-оор хийгдэнэ.

export async function proxy(request: NextRequest) {
  const session = await decrypt(request.cookies.get(SESSION_COOKIE)?.value);

  if (!session) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  try {
    const loaded = await loadSession(session);
    if (!loaded) {
      const response = NextResponse.redirect(new URL('/login', request.url));
      response.cookies.delete(SESSION_COOKIE);
      return response;
    }
    // Эрхэд нээлттэй бус хуудсыг (lib/roles.ts) тухайн эрхийн нүүр хуудас руу шилжүүлнэ
    if (!canAccessPath(loaded.role, request.nextUrl.pathname)) {
      return NextResponse.redirect(new URL(homePathFor(loaded.role), request.url));
    }
  } catch (error) {
    // DB түр алдаатай үед хуудсыг хаахгүй; API route-ууд өөрсдөө шалгана
    console.error('Proxy session check failed:', error);
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/dashboard/:path*',
};
