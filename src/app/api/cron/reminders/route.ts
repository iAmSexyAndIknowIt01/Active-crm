import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { runReminders } from '@/src/lib/reminders';

export const maxDuration = 300;

// Vercel Cron өдөр бүр дууддаг (vercel.json). Vercel нь "Authorization: Bearer $CRON_SECRET" илгээнэ.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get('authorization') ?? '';
  const expected = `Bearer ${secret}`;
  if (!secret || auth.length !== expected.length || !timingSafeEqual(Buffer.from(auth), Buffer.from(expected))) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const stats = await runReminders();
    console.log('Reminder cron finished:', stats);
    return NextResponse.json({ success: true, data: stats });
  } catch (error) {
    console.error('Reminder Cron Error:', error);
    return NextResponse.json({ success: false, error: 'Сануулга илгээхэд алдаа гарлаа.' }, { status: 500 });
  }
}
