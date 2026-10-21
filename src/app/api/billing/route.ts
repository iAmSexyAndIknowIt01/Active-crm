import { NextResponse } from 'next/server';
import { requireAuth } from '@/src/lib/session';
import { pool } from '@/src/lib/db';
import { getSiteContent } from '@/src/lib/site-content';
import { isQPayConfigured } from '@/src/lib/qpay';
import { countActiveUsers, countCustomers } from '@/src/lib/limits';
import { MONTH_OPTIONS } from '@/src/lib/billing';

// Компанийн багцын төлөв, үнэ, төлбөрийн түүх (бүх хэрэглэгч үзнэ; төлбөр хийх нь админ)
export async function GET() {
  try {
    const { session, error } = await requireAuth({ allowExpired: true });
    if (error) return error;

    const [content, payments, users, customers] = await Promise.all([
      getSiteContent(),
      pool.query(
        `SELECT id, plan, months, amount, method, status, reference, created_at, paid_at
         FROM mt_payment WHERE company_id = $1 ORDER BY created_at DESC LIMIT 20`,
        [session.companyId]
      ),
      countActiveUsers(session.companyId),
      countCustomers(session.companyId),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        subscription: session.subscription,
        usage: { users, customers },
        prices: content.plan_prices,
        bank: content.bank,
        qpay: isQPayConfigured(),
        months: MONTH_OPTIONS,
        payments: payments.rows,
        canPay: session.role === 'admin',
      },
    });
  } catch (err) {
    console.error('Billing Fetch Error:', err);
    return NextResponse.json({ success: false, error: 'Серверт алдаа гарлаа.' }, { status: 500 });
  }
}
