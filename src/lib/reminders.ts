import 'server-only';
import { pool } from './db';
import { sendEmail } from './email';
import { isSmsConfigured, sendSms } from './sms';
import { normalizePhone } from './form-customer';
import {
  DEFAULT_FOLLOWUP_TEMPLATE,
  DEFAULT_RESERVATION_TEMPLATE,
  renderReminderTemplate,
} from './reminder-template';

const TZ = 'Asia/Ulaanbaatar';
// Нэг удаа ажиллахад компани бүрээс илгээх сануулгын дээд тоо (функцийн хугацаа, имэйлийн квот хэтрэхээс сэргийлнэ)
const MAX_PER_COMPANY = 200;
// Дахин урих сануулгыг followup_days хүрснээс хойш хэдэн хоногийн дотор илгээх вэ.
// Тохиргоог анх асаахад олон жилийн өмнөх бүх харилцагч руу нэг дор илгээхээс сэргийлнэ.
const FOLLOWUP_WINDOW_DAYS = 14;

export interface ReminderSettings {
  reservation_enabled: boolean;
  reservation_template: string | null;
  followup_enabled: boolean;
  followup_days: number;
  followup_template: string | null;
}

export interface ReminderRunStats {
  sent: number;
  failed: number;
  skipped: number;
}

interface CompanyRow extends ReminderSettings {
  company_id: string;
  company_name: string;
  phone_number: string | null;
}

interface Candidate {
  kind: 'reservation' | 'followup';
  reservationId: string | null;
  workId: string | null;
  name: string;
  phone: string | null;
  email: string | null;
  values: Record<string, string | number | null>;
}

export async function getReminderSettings(companyId: string): Promise<ReminderSettings> {
  const { rows } = await pool.query(
    `SELECT reservation_enabled, reservation_template, followup_enabled, followup_days, followup_template
     FROM mt_reminder_settings WHERE company_id = $1`,
    [companyId]
  );
  return (
    rows[0] ?? {
      reservation_enabled: false,
      reservation_template: null,
      followup_enabled: false,
      followup_days: 90,
      followup_template: null,
    }
  );
}

export async function saveReminderSettings(companyId: string, settings: ReminderSettings) {
  await pool.query(
    `
      INSERT INTO mt_reminder_settings
        (company_id, reservation_enabled, reservation_template, followup_enabled, followup_days, followup_template, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, now())
      ON CONFLICT (company_id) DO UPDATE SET
        reservation_enabled = EXCLUDED.reservation_enabled,
        reservation_template = EXCLUDED.reservation_template,
        followup_enabled = EXCLUDED.followup_enabled,
        followup_days = EXCLUDED.followup_days,
        followup_template = EXCLUDED.followup_template,
        updated_at = now()
    `,
    [
      companyId,
      settings.reservation_enabled,
      settings.reservation_template,
      settings.followup_enabled,
      settings.followup_days,
      settings.followup_template,
    ]
  );
}

// Сануулга асаалттай бүх компанийн (эсвэл зөвхөн companyId-ийн) сануулгыг илгээнэ.
// Cron өдөрт нэг удаа дуудна; дахин дуудсан ч аль хэдийн илгээснийг давтахгүй.
export async function runReminders(options: { companyId?: string } = {}): Promise<ReminderRunStats> {
  const { rows: companies } = await pool.query<CompanyRow>(
    `
      SELECT s.company_id, s.reservation_enabled, s.reservation_template, s.followup_enabled,
             s.followup_days, s.followup_template, c.company_name, c.phone_number
      FROM mt_reminder_settings s
      JOIN mt_company c ON c.company_id = s.company_id
      WHERE (s.reservation_enabled OR s.followup_enabled)
        AND ($1::uuid IS NULL OR s.company_id = $1::uuid)
    `,
    [options.companyId ?? null]
  );

  const stats: ReminderRunStats = { sent: 0, failed: 0, skipped: 0 };
  for (const company of companies) {
    const candidates = [
      ...(company.reservation_enabled ? await reservationCandidates(company) : []),
      ...(company.followup_enabled ? await followupCandidates(company) : []),
    ].slice(0, MAX_PER_COMPANY);

    for (const candidate of candidates) {
      const result = await deliver(company, candidate);
      if (result) stats[result]++;
    }
  }
  return stats;
}

// Маргааш (Улаанбаатарын цагаар) хүлээгдэж буй / баталгаажсан захиалгууд
async function reservationCandidates(company: CompanyRow): Promise<Candidate[]> {
  const { rows } = await pool.query(
    `
      SELECT r.reservation_id, r.customer_name, r.customer_phone, r.customer_email,
             to_char(r.reservation_date, 'YYYY-MM-DD') AS date, to_char(r.start_time, 'HH24:MI') AS time,
             (SELECT string_agg(rs.service_name, ', ' ORDER BY rs.sort_order)
              FROM mt_reservation_services rs WHERE rs.reservation_id = r.reservation_id) AS service
      FROM mt_reservation r
      WHERE r.company_id = $1
        AND r.reservation_date = (now() AT TIME ZONE '${TZ}')::date + 1
        AND r.status IN ('pending', 'confirmed')
        AND NOT EXISTS (
          SELECT 1 FROM mt_reminder_log l WHERE l.kind = 'reservation' AND l.reservation_id = r.reservation_id
        )
      ORDER BY r.start_time
      LIMIT $2
    `,
    [company.company_id, MAX_PER_COMPANY]
  );

  return rows.map((r) => ({
    kind: 'reservation' as const,
    reservationId: r.reservation_id,
    workId: null,
    name: r.customer_name,
    phone: r.customer_phone,
    email: r.customer_email,
    values: { name: r.customer_name, date: r.date, time: r.time, service: r.service ?? 'үйлчилгээ' },
  }));
}

// Сүүлийн дууссан ажлаас хойш followup_days хоног өнгөрсөн, одоогоор нээлттэй ажил,
// ирэх захиалгагүй харилцагчид. Сүүлийн ажил бүрд нэг л удаа илгээнэ.
async function followupCandidates(company: CompanyRow): Promise<Candidate[]> {
  const { rows } = await pool.query(
    `
      WITH last_work AS (
        SELECT DISTINCT ON (COALESCE(w.customer_id, w.company_customer_id))
               w.work_id, w.customer_id, w.company_customer_id,
               (w.completed_at AT TIME ZONE '${TZ}')::date AS completed_day
        FROM mt_works w
        WHERE w.company_id = $1
          AND w.status = 'completed'
          AND w.completed_at IS NOT NULL
          AND COALESCE(w.customer_id, w.company_customer_id) IS NOT NULL
        ORDER BY COALESCE(w.customer_id, w.company_customer_id), w.completed_at DESC
      ),
      today AS (SELECT (now() AT TIME ZONE '${TZ}')::date AS d)
      SELECT lw.work_id,
             today.d - lw.completed_day AS days,
             COALESCE(NULLIF(TRIM(CONCAT(c.last_name, ' ', c.first_name)), ''), cc.name) AS name,
             COALESCE(c.phone, cc.phone) AS phone,
             COALESCE(c.email, cc.email) AS email
      FROM last_work lw
      CROSS JOIN today
      LEFT JOIN mt_customer c ON c.customer_id = lw.customer_id
      LEFT JOIN mt_customercompany cc ON cc.company_customer_id = lw.company_customer_id
      WHERE today.d - lw.completed_day BETWEEN $2 AND $2 + ${FOLLOWUP_WINDOW_DAYS}
        AND COALESCE(c.status, cc.status, 'active') <> 'inactive'
        AND NOT EXISTS (
          SELECT 1 FROM mt_works o
          WHERE o.company_id = $1 AND o.status IN ('pending', 'in_progress')
            AND (o.customer_id = lw.customer_id OR o.company_customer_id = lw.company_customer_id)
        )
        AND NOT EXISTS (
          SELECT 1 FROM mt_reservation r
          WHERE r.company_id = $1 AND r.reservation_date >= today.d
            AND r.status IN ('pending', 'confirmed', 'in_service')
            AND (r.customer_id = lw.customer_id OR r.company_customer_id = lw.company_customer_id)
        )
        AND NOT EXISTS (SELECT 1 FROM mt_reminder_log l WHERE l.kind = 'followup' AND l.work_id = lw.work_id)
      ORDER BY lw.completed_day
      LIMIT $3
    `,
    [company.company_id, company.followup_days, MAX_PER_COMPANY]
  );

  return rows.map((r) => ({
    kind: 'followup' as const,
    reservationId: null,
    workId: r.work_id,
    name: r.name ?? '',
    phone: r.phone,
    email: r.email,
    values: { name: r.name ?? '', days: r.days },
  }));
}

// Сувгаа сонгож илгээнэ: SMS тохируулсан бөгөөд утас байвал SMS, үгүй бол имэйл.
// Илгээхээс өмнө лог мөр нөөцөлдөг тул зэрэг ажилласан хоёр процесс давхар илгээхгүй.
async function deliver(company: CompanyRow, candidate: Candidate): Promise<keyof ReminderRunStats | null> {
  const phone = normalizePhone(candidate.phone);
  const useSms = isSmsConfigured() && phone.length === 8;
  const channel = useSms ? 'sms' : candidate.email ? 'email' : null;
  const recipient = useSms ? phone : candidate.email;

  const claim = await pool.query(
    `
      INSERT INTO mt_reminder_log (company_id, kind, reservation_id, work_id, customer_name, channel, recipient, status, error)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT DO NOTHING
      RETURNING id
    `,
    [
      company.company_id,
      candidate.kind,
      candidate.reservationId,
      candidate.workId,
      candidate.name.slice(0, 255),
      channel,
      recipient,
      channel ? 'pending' : 'skipped',
      channel ? null : 'Утас (SMS) эсвэл имэйл хаяг байхгүй.',
    ]
  );
  if (claim.rows.length === 0) return null; // өөр процесс аль хэдийн илгээсэн
  if (!channel || !recipient) return 'skipped';

  const template =
    candidate.kind === 'reservation'
      ? company.reservation_template || DEFAULT_RESERVATION_TEMPLATE
      : company.followup_template || DEFAULT_FOLLOWUP_TEMPLATE;
  const text = renderReminderTemplate(template, {
    company: company.company_name,
    phone: company.phone_number ?? '',
    date: null,
    time: null,
    service: null,
    days: null,
    ...candidate.values,
  });

  let error: string | null = null;
  if (channel === 'sms') {
    const result = await sendSms(recipient, text);
    if (!result.ok) error = result.error;
  } else {
    const subject =
      candidate.kind === 'reservation' ? `${company.company_name}: цаг захиалгын сануулга` : `${company.company_name}: таныг хүлээж байна`;
    const ok = await sendEmail({ to: recipient, subject, text });
    if (!ok) error = 'Имэйл илгээж чадсангүй.';
  }

  await pool.query(`UPDATE mt_reminder_log SET status = $2, error = $3 WHERE id = $1`, [
    claim.rows[0].id,
    error ? 'failed' : 'sent',
    error,
  ]);
  return error ? 'failed' : 'sent';
}
