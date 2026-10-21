import { NextResponse } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';
import { requirePlatformAdmin } from '@/src/lib/platform';
import { SITE_CONTENT_KEYS, SITE_CONTENT_TAG, getSiteContent, sanitizeSiteContent, saveSiteContent, type SiteContentKey } from '@/src/lib/site-content';

// Нүүр хуудасны контент, багцын үнэ, банкны данс (платформын админ)
export async function GET() {
  const { error } = await requirePlatformAdmin();
  if (error) return error;
  return NextResponse.json({ success: true, data: await getSiteContent() });
}

// Body: { key: 'testimonial' | 'contact' | 'plan_prices' | 'bank', value: {...} }
export async function PUT(request: Request) {
  try {
    const { session, error } = await requirePlatformAdmin();
    if (error) return error;
    const body = await request.json().catch(() => null);
    const key = body?.key as SiteContentKey;
    if (!SITE_CONTENT_KEYS.includes(key)) {
      return NextResponse.json({ success: false, error: 'Тохиргооны түлхүүр буруу байна.' }, { status: 400 });
    }
    const value = sanitizeSiteContent(key, body.value);
    if (!value) return NextResponse.json({ success: false, error: 'Утга буруу байна.' }, { status: 400 });

    await saveSiteContent(key, value, session.email);
    // Кэшлэгдсэн контент болон нүүр хуудсыг шууд шинэчилнэ
    revalidateTag(SITE_CONTENT_TAG, { expire: 0 });
    revalidatePath('/');
    return NextResponse.json({ success: true, message: 'Хадгалагдлаа.' });
  } catch (err) {
    console.error('Platform Content Error:', err);
    return NextResponse.json({ success: false, error: 'Серверт алдаа гарлаа.' }, { status: 500 });
  }
}
