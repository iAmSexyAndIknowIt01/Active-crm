import 'server-only';

// QPay v2 merchant API (https://merchant.qpay.mn). Тохиргоо:
//   QPAY_USERNAME, QPAY_PASSWORD — merchant-ийн нэвтрэх нэр, нууц үг
//   QPAY_INVOICE_CODE            — QPay-ээс олгосон нэхэмжлэхийн код
//   QPAY_BASE_URL                — (заавал биш) анхдагч https://merchant.qpay.mn, туршилтад https://merchant-sandbox.qpay.mn
// Тохируулаагүй бол QPay сонголт идэвхгүй (зөвхөн банкны шилжүүлэг).

export function isQPayConfigured() {
  return Boolean(process.env.QPAY_USERNAME && process.env.QPAY_PASSWORD && process.env.QPAY_INVOICE_CODE);
}

function baseUrl() {
  return (process.env.QPAY_BASE_URL || 'https://merchant.qpay.mn').replace(/\/$/, '');
}

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;
  const auth = Buffer.from(`${process.env.QPAY_USERNAME}:${process.env.QPAY_PASSWORD}`).toString('base64');
  const res = await fetch(`${baseUrl()}/v2/auth/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`QPay auth ${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}`);
  const json = await res.json();
  // expires_in нь секунд (зарим хувилбарт unix timestamp) — аль ч тохиолдолд 50 минутаас удаан кэшлэхгүй
  cachedToken = { value: json.access_token, expiresAt: Date.now() + 50 * 60 * 1000 };
  return cachedToken.value;
}

async function call<T>(path: string, body: unknown): Promise<T> {
  const token = await getToken();
  const res = await fetch(`${baseUrl()}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  if (res.status === 401) cachedToken = null;
  if (!res.ok) throw new Error(`QPay ${path} ${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}`);
  return res.json() as Promise<T>;
}

export interface QPayInvoice {
  invoice_id: string;
  qr_text: string;
  qr_image: string; // base64 PNG
  qPay_shortUrl?: string;
  urls?: { name: string; description: string; logo: string; link: string }[];
}

export function createQPayInvoice(input: {
  senderInvoiceNo: string;
  receiverCode: string;
  description: string;
  amount: number;
  callbackUrl: string;
}) {
  return call<QPayInvoice>('/v2/invoice', {
    invoice_code: process.env.QPAY_INVOICE_CODE,
    sender_invoice_no: input.senderInvoiceNo,
    invoice_receiver_code: input.receiverCode,
    invoice_description: input.description,
    amount: input.amount,
    callback_url: input.callbackUrl,
  });
}

// Нэхэмжлэхийн төлөгдсөн дүн (төлөгдөөгүй бол 0)
export async function getQPayPaidAmount(invoiceId: string): Promise<number> {
  const json = await call<{ count: number; paid_amount?: number; rows?: { payment_status: string; payment_amount: number | string }[] }>(
    '/v2/payment/check',
    { object_type: 'INVOICE', object_id: invoiceId, offset: { page_number: 1, page_limit: 100 } }
  );
  const fromRows = (json.rows ?? [])
    .filter((r) => r.payment_status === 'PAID')
    .reduce((sum, r) => sum + Number(r.payment_amount || 0), 0);
  return Math.max(Number(json.paid_amount ?? 0), fromRows);
}
