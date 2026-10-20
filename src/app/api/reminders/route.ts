import { NextResponse } from 'next/server';
import { requireAuth } from '@/src/lib/session';
import { pool } from '@/src/lib/db';
import { getReminderSettings, saveReminderSettings } from '@/src/lib/reminders';
import { isSmsConfigured } from '@/src/lib/sms';
import { TEMPLATE_MAX_LENGTH } from '@/src/lib/reminder-template';

// Сануулгын тохиргоо болон сүүлд илгээсэн сануулгууд (зөвхөн админ)
export async function GET() {
  try {
    const { session, error: authError } = await requireAuth({ admin: true });
    if (authError) return authError;

    const [settings, logs] = await Promise.all([
      getReminderSettings(session.companyId),
      pool.query(
        `SELECT id, kind, customer_name, channel, recipient, status, error, created_at
         FROM mt_reminder_log WHERE company_id = $1 ORDER BY created_at DESC LIMIT 50`,
        [session.companyId]
      ),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        settings,
        logs: logs.rows,
        channels: {
          sms: isSmsConfigured(),
          email: Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD),
        },
      },
    });
  } catch (error) {
    console.error('Reminder Settings Fetch Error:', error);
    return NextResponse.json({ success: false, error: 'Серверт алдаа гарлаа.' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const { session, error: authError } = await requireAuth({ admin: true });
    if (authError) return authError;

    const body = await request.json().catch(() => null);
    const followupDays = Number(body?.followup_days);
    if (!Number.isInteger(followupDays) || followupDays < 7 || followupDays > 730) {
      return NextResponse.json(
        { success: false, error: 'Дахин урих хугацаа 7-730 хоногийн хооронд байна.' },
        { status: 400 }
      );
    }

    const template = (value: unknown) => {
      const text = typeof value === 'string' ? value.trim() : '';
      return text ? text.slice(0, TEMPLATE_MAX_LENGTH) : null;
    };

    await saveReminderSettings(session.companyId, {
      reservation_enabled: body?.reservation_enabled === true,
      reservation_template: template(body?.reservation_template),
      followup_enabled: body?.followup_enabled === true,
      followup_days: followupDays,
      followup_template: template(body?.followup_template),
    });

    return NextResponse.json({ success: true, message: 'Сануулгын тохиргоо хадгалагдлаа.' });
  } catch (error) {
    console.error('Reminder Settings Save Error:', error);
    return NextResponse.json({ success: false, error: 'Серверт алдаа гарлаа.' }, { status: 500 });
  }
}
