import { NextResponse } from 'next/server';
import { requireAuth } from '@/src/lib/session';
import { checkRateLimits } from '@/src/lib/rate-limit';
import { runReminders } from '@/src/lib/reminders';

export const maxDuration = 60;

// Өөрийн компанийн сануулгыг одоо илгээх (өдөр бүрийн автомат илгээлтийг хүлээхгүйгээр).
// Аль хэдийн илгээсэн сануулгыг давтахгүй.
export async function POST() {
  try {
    const { session, error: authError } = await requireAuth({ admin: true });
    if (authError) return authError;

    const limited = await checkRateLimits([{ key: `reminders:run:${session.companyId}`, limit: 10, windowSeconds: 60 * 60 }]);
    if (limited) return limited;

    const stats = await runReminders({ companyId: session.companyId });
    return NextResponse.json({ success: true, data: stats });
  } catch (error) {
    console.error('Reminder Run Error:', error);
    return NextResponse.json({ success: false, error: 'Сануулга илгээхэд алдаа гарлаа.' }, { status: 500 });
  }
}
