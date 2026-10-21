import 'server-only';
import { randomBytes, createHmac, timingSafeEqual } from 'crypto';
import type { PoolClient } from 'pg';
import { pool } from './db';
import { getSiteContent } from './site-content';
import { PLAN_INFO, type PaidPlan } from './plans';
import { createQPayInvoice, getQPayPaidAmount } from './qpay';

export const MONTH_OPTIONS = [1, 3, 6, 12];

export interface PaymentRow {
  id: string;
  company_id: string;
  plan: PaidPlan;
  months: number;
  amount: string;
  method: 'bank' | 'qpay' | 'manual';
  status: 'pending' | 'paid' | 'cancelled';
  reference: string;
  qpay_invoice_id: string | null;
}

// Банкны гүйлгээний утгад бичих код: ACRM-XXXXXX (андуурахааргүй тэмдэгтүүд)
function newReference() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(6);
  return `ACRM-${Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('')}`;
}

export async function planPrice(plan: PaidPlan) {
  const content = await getSiteContent();
  return content.plan_prices[plan];
}

export async function createPayment(input: {
  companyId: string;
  plan: PaidPlan;
  months: number;
  method: 'bank' | 'qpay';
  userId: string;
}): Promise<PaymentRow> {
  const amount = (await planPrice(input.plan)) * input.months;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const { rows } = await pool.query(
        `INSERT INTO mt_payment (company_id, plan, months, amount, method, reference, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [input.companyId, input.plan, input.months, amount, input.method, newReference(), input.userId]
      );
      return rows[0];
    } catch (error) {
      // Давхардсан reference (маш ховор) бол дахин үүсгэнэ
      if ((error as { code?: string }).code !== '23505' || attempt === 2) throw error;
    }
  }
  throw new Error('unreachable');
}

// QPay callback-ийн гарын үсэг (callback URL-ыг таамаглаж хуурамчаар дуудахаас сэргийлнэ)
export function callbackSignature(paymentId: string) {
  const secret = process.env.SESSION_SECRET ?? '';
  return createHmac('sha256', secret).update(`qpay:${paymentId}`).digest('base64url');
}

export function checkCallbackSignature(paymentId: string, signature: string | null) {
  if (!signature) return false;
  const expected = Buffer.from(callbackSignature(paymentId));
  const actual = Buffer.from(signature);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export async function createPaymentInvoice(payment: PaymentRow, companyName: string, origin: string) {
  const invoice = await createQPayInvoice({
    senderInvoiceNo: payment.reference,
    receiverCode: payment.company_id,
    description: `Active CRM ${PLAN_INFO[payment.plan].name} багц, ${payment.months} сар (${companyName})`.slice(0, 255),
    amount: Number(payment.amount),
    callbackUrl: `${origin}/api/billing/qpay/callback?payment_id=${payment.id}&sig=${callbackSignature(payment.id)}`,
  });
  await pool.query('UPDATE mt_payment SET qpay_invoice_id = $1 WHERE id = $2', [invoice.invoice_id, payment.id]);
  return invoice;
}

// QPay-ээс төлөлтийг шалгаж, бүрэн төлөгдсөн бол идэвхжүүлнэ. Буцаах: тухайн төлбөрийн шинэ төлөв.
export async function syncQPayPayment(paymentId: string): Promise<'pending' | 'paid' | 'cancelled'> {
  const { rows } = await pool.query('SELECT * FROM mt_payment WHERE id = $1', [paymentId]);
  const payment: PaymentRow | undefined = rows[0];
  if (!payment) throw new Error('Payment not found');
  if (payment.status !== 'pending' || payment.method !== 'qpay' || !payment.qpay_invoice_id) return payment.status;

  const paid = await getQPayPaidAmount(payment.qpay_invoice_id);
  if (paid + 0.01 < Number(payment.amount)) return 'pending';
  await activatePayment(paymentId, 'QPay');
  return 'paid';
}

// Төлбөрийг төлөгдсөнд тооцож, компанийн багцын хугацааг сунгана. Дахин дуудахад аюулгүй.
// Хугацаа дуусаагүй бол дуусах өдрөөс нь, дууссан бол өнөөдрөөс эхлэн months сараар сунгана.
export async function activatePayment(paymentId: string, confirmedBy: string, client?: PoolClient) {
  const db = client ?? (await pool.connect());
  try {
    if (!client) await db.query('BEGIN');
    const { rows } = await db.query(`SELECT * FROM mt_payment WHERE id = $1 FOR UPDATE`, [paymentId]);
    const payment: PaymentRow | undefined = rows[0];
    if (!payment || payment.status !== 'pending') {
      if (!client) await db.query('COMMIT');
      return false;
    }
    await db.query(`UPDATE mt_payment SET status = 'paid', paid_at = now(), confirmed_by = $2 WHERE id = $1`, [paymentId, confirmedBy]);
    await extendSubscription(db, payment.company_id, payment.plan, payment.months);
    if (!client) await db.query('COMMIT');
    return true;
  } catch (error) {
    if (!client) await db.query('ROLLBACK');
    throw error;
  } finally {
    if (!client) (db as PoolClient).release();
  }
}

export async function extendSubscription(db: PoolClient, companyId: string, plan: PaidPlan, months: number) {
  await db.query(
    `UPDATE mt_company
     SET plan = $2,
         paid_until = GREATEST(COALESCE(paid_until, now()), now()) + make_interval(months => $3),
         subscription_status = 'active',
         updated_at = CURRENT_TIMESTAMP
     WHERE company_id = $1`,
    [companyId, plan, months]
  );
}
