import { NextResponse } from 'next/server';
import { MANAGER_ROLES } from '@/src/lib/roles';
import { requireAuth } from '@/src/lib/session';
import { pool } from '@/src/lib/db';

const TZ = 'Asia/Ulaanbaatar';
const ACTIVE = `('pending', 'in_progress')`;

const toNumber = (value: unknown) => Number(value ?? 0);

// GET: Хяналтын самбарын тойм — өнөөдөр болон энэ сарын байдал.
// Сарын үзүүлэлтийг өмнөх сарын ижил хугацаатай (1-нээс өнөөдрийн огноо хүртэл) харьцуулна.
// Орлого, дуусгасан ажлыг дууссан мөчөөр (completed_at) нь тухайн сард тооцно.
// Хоцорсон/дөхсөн ажлыг аналитиктай адил Улаанбаатарын өдрөөр тооцно (дуусах өдөртөө хоцорсонд тооцогдохгүй).
export async function GET() {
  try {
    // Орлого, ажилтны гүйцэтгэл зэрэг мэдээлэл тул зөвхөн админ, менежер
    const { session, error: authError } = await requireAuth({ roles: MANAGER_ROLES });
    if (authError) return authError;
    const { userId, companyId } = session;

    const boundsResult = await pool.query(`
      SELECT
        date_trunc('month', now() AT TIME ZONE '${TZ}') AT TIME ZONE '${TZ}' AS month_start,
        (date_trunc('month', now() AT TIME ZONE '${TZ}') - interval '1 month') AT TIME ZONE '${TZ}' AS prev_month_start,
        now() - interval '1 month' AS prev_month_now,
        date_trunc('day', now() AT TIME ZONE '${TZ}') AT TIME ZONE '${TZ}' AS today_start
    `);
    const { month_start: monthStart, prev_month_start: prevMonthStart, prev_month_now: prevMonthNow, today_start: todayStart } =
      boundsResult.rows[0];
    const periodParams = [companyId, monthStart, prevMonthStart, prevMonthNow];
    // Огноог SQL дотор тооцно (JS Date болгон дамжуулбал серверийн цагийн бүсээс хамаарч өдөр зөрнө)
    const dueDay = `(due_date AT TIME ZONE '${TZ}')::date`;
    const today = `(now() AT TIME ZONE '${TZ}')::date`;

    const [profile, works, customers, submissions, recentSubmissions, lastWeek, leaderboard] = await Promise.all([
      pool.query(
        `SELECT u.first_name, u.last_name, c.company_name
         FROM mt_user u
         LEFT JOIN mt_company c ON c.company_id = u.company_id
         WHERE u.user_id = $1 AND u.company_id = $2`,
        [userId, companyId]
      ),
      pool.query(
        `SELECT
           COUNT(*) FILTER (WHERE status = 'pending') AS pending,
           COUNT(*) FILTER (WHERE status = 'in_progress') AS in_progress,
           COUNT(*) FILTER (WHERE status IN ${ACTIVE} AND ${dueDay} < ${today}) AS overdue,
           -- Өнөөдөр болон дараагийн 2 өдөрт дуусах ёстой
           COUNT(*) FILTER (WHERE status IN ${ACTIVE} AND ${dueDay} >= ${today} AND ${dueDay} < ${today} + 3) AS due_soon,
           COALESCE(SUM(price) FILTER (WHERE status = 'completed' AND completed_at >= $2), 0) AS revenue,
           COALESCE(SUM(price) FILTER (WHERE status = 'completed' AND completed_at >= $3 AND completed_at < $4), 0) AS revenue_prev
         FROM mt_works
         WHERE company_id = $1`,
        periodParams
      ),
      pool.query(
        `SELECT
           COUNT(*) FILTER (WHERE create_date >= $2) AS current,
           COUNT(*) FILTER (WHERE create_date >= $3 AND create_date < $4) AS previous
         FROM (
           SELECT create_date FROM mt_customer WHERE company_id = $1
           UNION ALL
           SELECT create_date FROM mt_customercompany WHERE company_id = $1
         ) c`,
        periodParams
      ),
      pool.query(
        `SELECT
           COUNT(*) FILTER (WHERE submitted_at >= $2) AS today,
           COUNT(*) FILTER (WHERE submitted_at >= now() - interval '7 days') AS last_week
         FROM form_submissions
         WHERE company_id = $1`,
        [companyId, todayStart]
      ),
      // Анкетын асуултын нэрээс "нэр", "үйлчилгээ" гэсэн хариултыг гарчиг болгон авна
      pool.query(
        `SELECT
           s.id,
           s.submitted_at,
           t.title AS template_title,
           (SELECT a.answer_value FROM form_submission_answers a
             WHERE a.submission_id = s.id AND a.question_label ILIKE '%нэр%' AND a.answer_value <> ''
             LIMIT 1) AS name,
           (SELECT a.answer_value FROM form_submission_answers a
             WHERE a.submission_id = s.id AND a.question_label ILIKE '%үйлчилгээ%' AND a.answer_value <> ''
             LIMIT 1) AS service
         FROM form_submissions s
         LEFT JOIN mt_templates t ON t.id = s.form_template_id
         WHERE s.company_id = $1
         ORDER BY s.submitted_at DESC
         LIMIT 5`,
        [companyId]
      ),
      pool.query(
        `WITH days AS (
           SELECT generate_series(
             date_trunc('day', now() AT TIME ZONE '${TZ}') - interval '6 days',
             date_trunc('day', now() AT TIME ZONE '${TZ}'),
             interval '1 day'
           ) AS day
         )
         SELECT to_char(d.day, 'YYYY-MM-DD') AS day, COUNT(w.work_id) AS works
         FROM days d
         LEFT JOIN mt_works w
           ON w.company_id = $1
          AND date_trunc('day', w.create_date AT TIME ZONE '${TZ}') = d.day
         GROUP BY d.day
         ORDER BY d.day`,
        [companyId]
      ),
      // Энэ сард дуусгасан ажил: дууссан төлөвт орсон мөч (completed_at)
      pool.query(
        `SELECT
           u.user_id,
           TRIM(CONCAT(u.last_name, ' ', u.first_name)) AS name,
           COALESCE(NULLIF(u.position, ''), u.role) AS position,
           COUNT(*) AS completed,
           COALESCE(SUM(w.price), 0) AS revenue
         FROM mt_works w
         JOIN mt_user u ON u.user_id = w.assigned_employee
         WHERE w.company_id = $1 AND w.status = 'completed' AND w.completed_at >= $2
         GROUP BY u.user_id, u.last_name, u.first_name, u.position, u.role
         ORDER BY completed DESC, revenue DESC
         LIMIT 5`,
        [companyId, monthStart]
      ),
    ]);

    const w = works.rows[0];
    const user = profile.rows[0];

    return NextResponse.json({
      success: true,
      data: {
        user: { firstName: user?.first_name ?? '', lastName: user?.last_name ?? '' },
        companyName: user?.company_name ?? '',
        alerts: {
          overdue: toNumber(w.overdue),
          dueSoon: toNumber(w.due_soon),
          submissionsToday: toNumber(submissions.rows[0].today),
        },
        stats: {
          activeWorks: { pending: toNumber(w.pending), inProgress: toNumber(w.in_progress) },
          revenue: { current: toNumber(w.revenue), previous: toNumber(w.revenue_prev) },
          newCustomers: {
            current: toNumber(customers.rows[0].current),
            previous: toNumber(customers.rows[0].previous),
          },
        },
        lastWeek: lastWeek.rows.map((r) => ({ day: r.day, works: toNumber(r.works) })),
        submissionsLastWeek: toNumber(submissions.rows[0].last_week),
        recentSubmissions: recentSubmissions.rows.map((r) => ({
          id: r.id,
          submittedAt: r.submitted_at,
          name: r.name ?? '',
          service: r.service ?? r.template_title ?? '',
        })),
        leaderboard: leaderboard.rows.map((r) => ({
          id: r.user_id,
          name: r.name,
          position: r.position ?? '',
          completed: toNumber(r.completed),
          revenue: toNumber(r.revenue),
        })),
      },
    });
  } catch (error) {
    console.error('Fetch Dashboard Overview Error:', error);
    return NextResponse.json(
      { success: false, error: 'Хяналтын самбарын мэдээлэл авахад алдаа гарлаа' },
      { status: 500 }
    );
  }
}
