import { NextResponse } from 'next/server';
import { requireAuth } from '@/src/lib/session';
import { pool } from '@/src/lib/db';
import { checkRateLimits } from '@/src/lib/rate-limit';
import { isPaidPlan } from '@/src/lib/plans';
import { isQPayConfigured } from '@/src/lib/qpay';
import { MONTH_OPTIONS, createPayment, createPaymentInvoice } from '@/src/lib/billing';
import { appOrigin } from '@/src/lib/email-verification';
import { getSiteContent } from '@/src/lib/site-content';

// Багцын төлбөр үүсгэх (зөвхөн админ). Body: { plan: 'standard'|'pro', months, method: 'bank'|'qpay' }
//   bank — гүйлгээний утгад бичих код (reference) буцаана; платформын админ орлогыг шалгаад баталгаажуулна
//   qpay — QPay нэхэмжлэх (QR, банкны апп-ын холбоос) буцаана; төлөгдөхөд автоматаар идэвхжинэ
export async function POST(request: Request) {
  try {
    const { session, error } = await requireAuth({ admin: true, allowExpired: true });
    if (error) return error;

    const limited = await checkRateLimits([{ key: `billing:create:${session.companyId}`, limit: 20, windowSeconds: 60 * 60 }]);
    if (limited) return limited;

    const body = await request.json().catch(() => null);
    const months = Number(body?.months);
    if (!isPaidPlan(body?.plan) || !MONTH_OPTIONS.includes(months) || (body?.method !== 'bank' && body?.method !== 'qpay')) {
      return NextResponse.json({ success: false, error: 'Багц, хугацаа эсвэл төлбөрийн хэлбэр буруу байна.' }, { status: 400 });
    }
    if (body.method === 'qpay' && !isQPayConfigured()) {
      return NextResponse.json({ success: false, error: 'QPay төлбөр одоогоор идэвхгүй байна.' }, { status: 400 });
    }

    if (body.method === 'bank' && !(await getSiteContent()).bank.account_number) {
      return NextResponse.json({ success: false, error: 'Банкны дансны мэдээлэл тохируулагдаагүй байна.' }, { status: 400 });
    }

    const payment = await createPayment({ companyId: session.companyId, plan: body.plan, months, method: body.method, userId: session.userId });

    if (body.method === 'qpay') {
      const { rows } = await pool.query('SELECT company_name FROM mt_company WHERE company_id = $1', [session.companyId]);
      try {
        const invoice = await createPaymentInvoice(payment, rows[0]?.company_name ?? '', appOrigin(request));
        return NextResponse.json({
          success: true,
          data: { payment, qpay: { qr_image: invoice.qr_image, qr_text: invoice.qr_text, urls: invoice.urls ?? [], short_url: invoice.qPay_shortUrl ?? null } },
        });
      } catch (qpayError) {
        console.error('QPay invoice failed:', qpayError);
        await pool.query(`UPDATE mt_payment SET status = 'cancelled', note = 'QPay нэхэмжлэх үүсгэж чадсангүй' WHERE id = $1`, [payment.id]);
        return NextResponse.json({ success: false, error: 'QPay нэхэмжлэх үүсгэж чадсангүй. Түр хүлээгээд дахин оролдоно уу.' }, { status: 502 });
      }
    }

    return NextResponse.json({ success: true, data: { payment } });
  } catch (err) {
    console.error('Create Payment Error:', err);
    return NextResponse.json({ success: false, error: 'Серверт алдаа гарлаа.' }, { status: 500 });
  }
}
