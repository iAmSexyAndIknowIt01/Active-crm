import { NextResponse } from 'next/server';
import { requireAuth } from '@/src/lib/session';
import { pool } from '@/src/lib/db';

const TZ = 'Asia/Ulaanbaatar';

// Хугацааны сонголт бүрийн тренд графикийн нэгж болон баганын тоо
const RANGES = {
  '7d': { unit: 'day', buckets: 7 },
  '30d': { unit: 'day', buckets: 30 },
  '90d': { unit: 'week', buckets: 13 },
  '12m': { unit: 'month', buckets: 12 },
} as const;

type RangeKey = keyof typeof RANGES;

const toNumber = (value: unknown) => Number(value ?? 0);

// GET: Аналитик хуудасны үзүүлэлтүүд
//   ?range=7d | 30d | 90d | 12m (default 30d)
//   Үзүүлэлт бүр сонгосон хугацаанд бүртгэгдсэн (create_date) өгөгдлөөр тооцогдоно.
//   Өмнөх ижил урттай хугацаатай харьцуулж өөрчлөлтийн хувийг гаргана.
export async function GET(request: Request) {
  try {
    // Орлого, ажилтны гүйцэтгэл зэрэг мэдээлэл тул зөвхөн админ
    const { session, error: authError } = await requireAuth({ admin: true });
    if (authError) return authError;
    const companyId = session.companyId;

    const rangeParam = new URL(request.url).searchParams.get('range') ?? '30d';
    const range: RangeKey = rangeParam in RANGES ? (rangeParam as RangeKey) : '30d';
    const { unit, buckets } = RANGES[range];

    // Хугацааны эхлэл: одоогийн нэгжийн эхлэлээс (buckets - 1) нэгжийн өмнө, Улаанбаатарын цагаар
    const boundsResult = await pool.query(
      `
        WITH b AS (
          SELECT date_trunc($1, now() AT TIME ZONE '${TZ}')
                 - ($2::int - 1) * ('1 ' || $1)::interval AS since_local
        )
        SELECT (since_local AT TIME ZONE '${TZ}') AS since,
               to_char(since_local, 'YYYY-MM-DD') AS since_date,
               ((since_local - $2::int * ('1 ' || $1)::interval) AT TIME ZONE '${TZ}') AS prev_since
        FROM b
      `,
      [unit, buckets]
    );
    const { since, since_date: sinceDate, prev_since: prevSince } = boundsResult.rows[0];
    const params = [companyId, since, prevSince];

    const [works, customers, submissions, trend, statuses, customerTypes, services, employees, overdueList] =
      await Promise.all([
        pool.query(
          `
            SELECT
              COUNT(*) FILTER (WHERE create_date >= $2) AS works,
              COUNT(*) FILTER (WHERE create_date >= $3 AND create_date < $2) AS works_prev,
              COALESCE(SUM(price) FILTER (WHERE status = 'completed' AND create_date >= $2), 0) AS revenue,
              COALESCE(SUM(price) FILTER (WHERE status = 'completed' AND create_date >= $3 AND create_date < $2), 0) AS revenue_prev,
              COUNT(*) FILTER (WHERE status = 'completed' AND create_date >= $2) AS completed,
              COUNT(*) FILTER (WHERE status <> 'cancelled' AND create_date >= $2) AS not_cancelled,
              COUNT(*) FILTER (WHERE status = 'completed' AND create_date >= $3 AND create_date < $2) AS completed_prev,
              COUNT(*) FILTER (WHERE status <> 'cancelled' AND create_date >= $3 AND create_date < $2) AS not_cancelled_prev,
              COUNT(*) FILTER (WHERE (due_date AT TIME ZONE '${TZ}')::date < (now() AT TIME ZONE '${TZ}')::date AND status NOT IN ('completed', 'cancelled')) AS overdue,
              -- Одоогоор дуусаагүй (хүлээгдэж буй, хийгдэж байгаа) бүх ажил ба тэдгээрийн дүн
              COUNT(*) FILTER (WHERE status IN ('pending', 'in_progress')) AS open_works,
              COALESCE(SUM(price) FILTER (WHERE status IN ('pending', 'in_progress')), 0) AS open_amount
            FROM mt_works
            WHERE company_id = $1
          `,
          params
        ),
        pool.query(
          `
            SELECT
              COUNT(*) FILTER (WHERE create_date >= $2) AS current,
              COUNT(*) FILTER (WHERE create_date >= $3 AND create_date < $2) AS previous
            FROM (
              SELECT create_date FROM mt_customer WHERE company_id = $1
              UNION ALL
              SELECT create_date FROM mt_customercompany WHERE company_id = $1
            ) c
          `,
          params
        ),
        pool.query(
          `
            SELECT
              COUNT(*) FILTER (WHERE submitted_at >= $2) AS current,
              COUNT(*) FILTER (WHERE submitted_at >= $3 AND submitted_at < $2) AS previous
            FROM form_submissions
            WHERE company_id = $1
          `,
          params
        ),
        pool.query(
          `
            WITH buckets AS (
              SELECT generate_series(
                date_trunc($3, $2::timestamptz AT TIME ZONE '${TZ}'),
                date_trunc($3, now() AT TIME ZONE '${TZ}'),
                ('1 ' || $3)::interval
              ) AS bucket
            )
            SELECT
              to_char(b.bucket, 'YYYY-MM-DD') AS bucket,
              COUNT(w.work_id) AS works,
              -- Бүртгэгдсэн ажлын нийт үнийн дүн (цуцлагдсаныг оруулахгүй)
              COALESCE(SUM(w.price) FILTER (WHERE w.status <> 'cancelled'), 0) AS amount,
              COUNT(w.work_id) FILTER (WHERE w.status = 'completed') AS completed,
              COALESCE(SUM(w.price) FILTER (WHERE w.status = 'completed'), 0) AS revenue
            FROM buckets b
            LEFT JOIN mt_works w
              ON w.company_id = $1
             AND date_trunc($3, w.create_date AT TIME ZONE '${TZ}') = b.bucket
            GROUP BY b.bucket
            ORDER BY b.bucket
          `,
          [companyId, since, unit]
        ),
        pool.query(
          `
            SELECT status, COUNT(*) AS count
            FROM mt_works
            WHERE company_id = $1 AND create_date >= $2
            GROUP BY status
          `,
          [companyId, since]
        ),
        pool.query(
          `
            SELECT LOWER(customer_type) AS customer_type, COUNT(*) AS count
            FROM mt_works
            WHERE company_id = $1 AND create_date >= $2
            GROUP BY LOWER(customer_type)
          `,
          [companyId, since]
        ),
        pool.query(
          `
            -- Нэг ажилд олон үйлчилгээ байж болох тул орлогыг үйлчилгээний мөр бүрээр (үнэ × тоо) тооцно.
            -- Каталогт байгаа бол одоогийн нэрийг, устсан бол мөрт хадгалсан нэрийг ашиглана.
            -- Цуцлагдсан ажлыг тооцохгүй.
            SELECT
              MIN(ws.service_id) AS service_id,
              COALESCE(MAX(s.name), MAX(ws.service_name)) AS name,
              COUNT(DISTINCT w.work_id) AS works,
              COUNT(DISTINCT w.work_id) FILTER (WHERE w.status = 'completed') AS completed,
              COALESCE(SUM(ws.quantity) FILTER (WHERE w.status = 'completed'), 0) AS quantity,
              COALESCE(SUM(ws.price * ws.quantity) FILTER (WHERE w.status = 'completed'), 0) AS revenue
            FROM mt_works w
            JOIN mt_work_services ws ON ws.work_id = w.work_id
            LEFT JOIN mt_services s ON s.service_id = ws.service_id
            WHERE w.company_id = $1 AND w.create_date >= $2 AND w.status <> 'cancelled'
            GROUP BY COALESCE(ws.service_id::text, 'name:' || ws.service_name)
            ORDER BY revenue DESC, completed DESC, works DESC
            LIMIT 5
          `,
          [companyId, since]
        ),
        pool.query(
          `
            SELECT
              u.user_id,
              TRIM(CONCAT(u.last_name, ' ', u.first_name)) AS name,
              COUNT(*) AS assigned,
              COUNT(*) FILTER (WHERE w.status = 'completed') AS completed,
              COALESCE(SUM(w.price) FILTER (WHERE w.status = 'completed'), 0) AS revenue
            FROM mt_works w
            JOIN mt_user u ON u.user_id = w.assigned_employee
            WHERE w.company_id = $1 AND w.create_date >= $2
            GROUP BY u.user_id, u.last_name, u.first_name
            ORDER BY completed DESC, assigned DESC
            LIMIT 5
          `,
          [companyId, since]
        ),
        pool.query(
          `
            SELECT
              w.work_id,
              w.title,
              w.price,
              w.status,
              to_char(w.due_date AT TIME ZONE '${TZ}', 'YYYY-MM-DD') AS due_date,
              ((now() AT TIME ZONE '${TZ}')::date - (w.due_date AT TIME ZONE '${TZ}')::date) AS days_overdue,
              CASE
                WHEN LOWER(w.customer_type) = 'company' THEN cc.name
                ELSE TRIM(CONCAT(c.last_name, ' ', c.first_name))
              END AS customer_name,
              NULLIF(TRIM(CONCAT(u.last_name, ' ', u.first_name)), '') AS employee_name
            FROM mt_works w
            LEFT JOIN mt_customer c ON c.customer_id = w.customer_id
            LEFT JOIN mt_customercompany cc ON cc.company_customer_id = w.company_customer_id
            LEFT JOIN mt_user u ON u.user_id = w.assigned_employee
            WHERE w.company_id = $1 AND (w.due_date AT TIME ZONE '${TZ}')::date < (now() AT TIME ZONE '${TZ}')::date AND w.status NOT IN ('completed', 'cancelled')
            ORDER BY w.due_date ASC
            LIMIT 5
          `,
          [companyId]
        ),
      ]);

    const w = works.rows[0];
    const rate = (done: unknown, total: unknown) =>
      toNumber(total) > 0 ? Math.round((toNumber(done) / toNumber(total)) * 1000) / 10 : null;

    return NextResponse.json({
      success: true,
      data: {
        range,
        unit,
        since: sinceDate,
        kpis: {
          works: { current: toNumber(w.works), previous: toNumber(w.works_prev) },
          revenue: { current: toNumber(w.revenue), previous: toNumber(w.revenue_prev) },
          completionRate: {
            current: rate(w.completed, w.not_cancelled),
            previous: rate(w.completed_prev, w.not_cancelled_prev),
          },
          newCustomers: {
            current: toNumber(customers.rows[0].current),
            previous: toNumber(customers.rows[0].previous),
          },
          submissions: {
            current: toNumber(submissions.rows[0].current),
            previous: toNumber(submissions.rows[0].previous),
          },
          overdue: toNumber(w.overdue),
          completed: { current: toNumber(w.completed), previous: toNumber(w.completed_prev) },
          openWorks: toNumber(w.open_works),
          openAmount: toNumber(w.open_amount),
        },
        trend: trend.rows.map((r) => ({
          bucket: r.bucket,
          works: toNumber(r.works),
          amount: toNumber(r.amount),
          completed: toNumber(r.completed),
          revenue: toNumber(r.revenue),
        })),
        statuses: statuses.rows.map((r) => ({ status: r.status, count: toNumber(r.count) })),
        customerTypes: customerTypes.rows.map((r) => ({ type: r.customer_type, count: toNumber(r.count) })),
        topServices: services.rows.map((r) => ({
          serviceId: r.service_id,
          name: r.name,
          works: toNumber(r.works),
          completed: toNumber(r.completed),
          quantity: toNumber(r.quantity),
          revenue: toNumber(r.revenue),
        })),
        topEmployees: employees.rows.map((r) => ({
          userId: r.user_id,
          name: r.name,
          assigned: toNumber(r.assigned),
          completed: toNumber(r.completed),
          revenue: toNumber(r.revenue),
        })),
        overdueWorks: overdueList.rows.map((r) => ({
          workId: r.work_id,
          title: r.title,
          customerName: r.customer_name,
          employeeName: r.employee_name,
          dueDate: r.due_date,
          daysOverdue: toNumber(r.days_overdue),
          price: toNumber(r.price),
          status: r.status,
        })),
      },
    });
  } catch (error) {
    console.error('Fetch Analytics Error:', error);
    return NextResponse.json(
      { success: false, error: 'Аналитик мэдээлэл авахад алдаа гарлаа' },
      { status: 500 }
    );
  }
}
