import { NextResponse } from 'next/server';
import { checkCallbackSignature, syncQPayPayment } from '@/src/lib/billing';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// QPay төлбөр төлөгдөхөд энэ URL-ыг дуудна. Callback-ийн агуулгад итгэхгүй:
// гарын үсгийг шалгаад, төлөлтийг QPay API-аас өөрөө шалгаж идэвхжүүлнэ.
async function handle(request: Request) {
  const url = new URL(request.url);
  const paymentId = url.searchParams.get('payment_id') ?? '';
  if (!UUID_RE.test(paymentId) || !checkCallbackSignature(paymentId, url.searchParams.get('sig'))) {
    return NextResponse.json({ success: false }, { status: 400 });
  }
  try {
    const status = await syncQPayPayment(paymentId);
    return NextResponse.json({ success: true, status });
  } catch (error) {
    console.error('QPay callback error:', error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
