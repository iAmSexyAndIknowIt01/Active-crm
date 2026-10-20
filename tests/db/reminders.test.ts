import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TEST_DATABASE_URL, createCompany, getPool } from './helpers';

describe.skipIf(!TEST_DATABASE_URL)('runReminders', () => {
  let company: Awaited<ReturnType<typeof createCompany>>;

  beforeEach(async () => {
    // SMS тохиргоогүй, имэйлийн тохиргоогүй (dev/test орчинд sendEmail console-д хэвлээд true буцаана)
    delete process.env.SMS_API_URL;
    delete process.env.GMAIL_USER;
    vi.spyOn(console, 'log').mockImplementation(() => {});
    company = await createCompany();
  });
  afterEach(async () => {
    vi.restoreAllMocks();
    await company.cleanup();
  });

  async function seed() {
    const pool = await getPool();
    const id = company.companyId;
    const tomorrow = `(now() AT TIME ZONE 'Asia/Ulaanbaatar')::date + 1`;
    await pool.query(
      `INSERT INTO mt_reservation (company_id, customer_type, customer_name, customer_email, reservation_date, start_time, status)
       VALUES ($1, 'individual', 'Маргааш', 'a@x.mn', ${tomorrow}, '10:00', 'confirmed'),
              ($1, 'individual', 'Цуцалсан', 'b@x.mn', ${tomorrow}, '11:00', 'cancelled'),
              ($1, 'individual', 'Нөгөөдөр', 'c@x.mn', ${tomorrow} + 1, '11:00', 'pending'),
              ($1, 'individual', 'Холбоогүй', NULL, ${tomorrow}, '12:00', 'pending')`,
      [id]
    );
    const customers = await pool.query(
      `INSERT INTO mt_customer (company_id, first_name, email) VALUES
         ($1, 'Удаан', 'old@x.mn'), ($1, 'Шинэ', 'new@x.mn'), ($1, 'Захиалгатай', 'booked@x.mn'), ($1, 'Эртний', 'ancient@x.mn')
       RETURNING customer_id, first_name`,
      [id]
    );
    const byName = Object.fromEntries(customers.rows.map((r) => [r.first_name, r.customer_id]));
    const work = (name: string, daysAgo: number) =>
      pool.query(
        `INSERT INTO mt_works (company_id, customer_type, customer_id, title, status)
         VALUES ($1, 'individual', $2, 'Тос солих', 'completed') RETURNING work_id`,
        [id, byName[name]]
      ).then(async ({ rows }) => {
        await pool.query(`UPDATE mt_works SET completed_at = now() - make_interval(days => $2) WHERE work_id = $1`, [
          rows[0].work_id,
          daysAgo,
        ]);
      });
    await work('Удаан', 95);
    await work('Шинэ', 10);
    await work('Захиалгатай', 95);
    await work('Эртний', 400);
    await pool.query(
      `INSERT INTO mt_reservation (company_id, customer_type, customer_id, customer_name, reservation_date, start_time, status)
       VALUES ($1, 'individual', $2, 'Захиалгатай', ${tomorrow} + 5, '10:00', 'pending')`,
      [id, byName['Захиалгатай']]
    );
  }

  it('sends only enabled, due reminders and never twice', async () => {
    const { runReminders, saveReminderSettings } = await import('@/src/lib/reminders');
    await seed();

    // Тохиргоо унтраалттай бол юу ч илгээхгүй
    expect(await runReminders({ companyId: company.companyId })).toEqual({ sent: 0, failed: 0, skipped: 0 });

    await saveReminderSettings(company.companyId, {
      reservation_enabled: true,
      reservation_template: null,
      followup_enabled: true,
      followup_days: 90,
      followup_template: null,
    });

    // Маргааш (имэйлтэй) + удаан ирээгүй нэг харилцагч = 2 илгээнэ, холбоогүй захиалгыг алгасна.
    // "Захиалгатай" нь ирэх захиалгатай, "Эртний" нь 14 хоногийн цонхноос гадуур, "Шинэ" хугацаа болоогүй.
    expect(await runReminders({ companyId: company.companyId })).toEqual({ sent: 2, failed: 0, skipped: 1 });
    expect(await runReminders({ companyId: company.companyId })).toEqual({ sent: 0, failed: 0, skipped: 0 });

    const pool = await getPool();
    const { rows } = await pool.query(
      `SELECT kind, customer_name, channel, status FROM mt_reminder_log WHERE company_id = $1 ORDER BY kind, customer_name`,
      [company.companyId]
    );
    expect(rows).toEqual([
      { kind: 'followup', customer_name: 'Удаан', channel: 'email', status: 'sent' },
      { kind: 'reservation', customer_name: 'Маргааш', channel: 'email', status: 'sent' },
      { kind: 'reservation', customer_name: 'Холбоогүй', channel: null, status: 'skipped' },
    ]);
  });
});
