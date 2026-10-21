import { NextResponse } from 'next/server';
import { pool } from '@/src/lib/db';
import { requirePlatformAdmin } from '@/src/lib/platform';
import { computeSubscription } from '@/src/lib/plans';

// Бүх компани, тэдгээрийн багцын төлөв ба хүлээгдэж буй төлбөрүүд (платформын админ)
export async function GET(request: Request) {
  try {
    const { error } = await requirePlatformAdmin();
    if (error) return error;
    const q = (new URL(request.url).searchParams.get('q') ?? '').trim().slice(0, 100);
    const pattern = q ? `%${q.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%` : '';

    const [companies, pending] = await Promise.all([
      pool.query(
        `
          SELECT c.company_id, c.company_name, c.email, c.plan, c.trial_ends_at, c.paid_until, c.created_at,
                 (SELECT COUNT(*) FROM mt_user u WHERE u.company_id = c.company_id AND u.is_active IS NOT FALSE) AS users,
                 (SELECT COUNT(*) FROM mt_customer x WHERE x.company_id = c.company_id) +
                 (SELECT COUNT(*) FROM mt_customercompany y WHERE y.company_id = c.company_id) AS customers
          FROM mt_company c
          WHERE $1 = '' OR c.company_name ILIKE $1 OR c.email ILIKE $1
          ORDER BY c.created_at DESC NULLS LAST
          LIMIT 200
        `,
        [pattern]
      ),
      pool.query(
        `
          SELECT p.id, p.company_id, c.company_name, p.plan, p.months, p.amount, p.method, p.reference, p.created_at
          FROM mt_payment p JOIN mt_company c ON c.company_id = p.company_id
          WHERE p.status = 'pending' AND p.method = 'bank'
          ORDER BY p.created_at DESC
          LIMIT 100
        `
      ),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        companies: companies.rows.map((c) => ({
          ...c,
          users: Number(c.users),
          customers: Number(c.customers),
          subscription: computeSubscription(c),
        })),
        pendingPayments: pending.rows,
      },
    });
  } catch (err) {
    console.error('Platform Companies Error:', err);
    return NextResponse.json({ success: false, error: 'Серверт алдаа гарлаа.' }, { status: 500 });
  }
}
