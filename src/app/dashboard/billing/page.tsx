'use client';

import { useCallback, useEffect, useState } from 'react';
import { CreditCard, CheckCircle2, AlertTriangle, Loader2, Landmark, QrCode, Copy, Clock } from 'lucide-react';
import LoadingComponent from '@/src/app/components/loading';
import { PAID_PLANS, PLAN_INFO, type PaidPlan, type Subscription } from '@/src/lib/plans';

interface BillingData {
  subscription: Subscription;
  usage: { users: number; customers: number };
  prices: Record<PaidPlan, number>;
  bank: { bank_name: string; account_number: string; account_holder: string; note: string };
  qpay: boolean;
  months: number[];
  canPay: boolean;
  payments: {
    id: string;
    plan: PaidPlan;
    months: number;
    amount: string;
    method: 'bank' | 'qpay' | 'manual';
    status: 'pending' | 'paid' | 'cancelled';
    reference: string;
    created_at: string;
  }[];
}

interface QPayInfo {
  qr_image: string;
  urls: { name: string; link: string }[];
  short_url: string | null;
}

const money = (n: number | string) => `${Number(n).toLocaleString('en-US')}₮`;

const STATUS_LABELS = {
  pending: { label: 'Хүлээгдэж буй', className: 'text-amber-700 bg-amber-50 dark:text-amber-300 dark:bg-amber-950/50' },
  paid: { label: 'Төлөгдсөн', className: 'text-emerald-700 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-950/50' },
  cancelled: { label: 'Цуцлагдсан', className: 'text-slate-500 bg-slate-100 dark:text-slate-400 dark:bg-slate-800' },
};
const METHOD_LABELS = { bank: 'Банкны шилжүүлэг', qpay: 'QPay', manual: 'Гараар' };

async function fetchBilling(): Promise<BillingData> {
  const res = await fetch('/api/billing');
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json.error || 'Мэдээлэл авахад алдаа гарлаа.');
  return json.data;
}

export default function BillingPage() {
  const [data, setData] = useState<BillingData | null>(null);
  const [error, setError] = useState('');
  const [plan, setPlan] = useState<PaidPlan>('pro');
  const [months, setMonths] = useState(1);
  const [busy, setBusy] = useState<'bank' | 'qpay' | null>(null);
  const [bankPayment, setBankPayment] = useState<{ reference: string; amount: string } | null>(null);
  const [qpay, setQpay] = useState<{ paymentId: string; info: QPayInfo } | null>(null);
  const [paidMessage, setPaidMessage] = useState('');

  const reload = useCallback(() => fetchBilling().then(setData).catch((err) => setError(err.message)), []);
  useEffect(() => {
    reload();
  }, [reload]);

  // QPay QR харагдаж байх үед 5 секунд тутам төлөгдсөн эсэхийг шалгана
  useEffect(() => {
    if (!qpay) return;
    const timer = setInterval(async () => {
      const res = await fetch(`/api/billing/payments/${qpay.paymentId}/check`, { method: 'POST' });
      const json = await res.json().catch(() => null);
      if (json?.data?.status === 'paid') {
        setQpay(null);
        setPaidMessage('Төлбөр амжилттай төлөгдөж, багц сунгагдлаа. Баярлалаа!');
        reload();
      }
    }, 5000);
    return () => clearInterval(timer);
  }, [qpay, reload]);

  const pay = async (method: 'bank' | 'qpay') => {
    setBusy(method);
    setError('');
    setBankPayment(null);
    setQpay(null);
    setPaidMessage('');
    try {
      const res = await fetch('/api/billing/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, months, method }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Төлбөр үүсгэж чадсангүй.');
      if (method === 'qpay') setQpay({ paymentId: json.data.payment.id, info: json.data.qpay });
      else setBankPayment({ reference: json.data.payment.reference, amount: json.data.payment.amount });
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Сүлжээний алдаа гарлаа.');
    } finally {
      setBusy(null);
    }
  };

  if (!data && !error) return <LoadingComponent text="Багцын мэдээллийг ачаалж байна..." />;

  const sub = data?.subscription;
  const statusText =
    sub?.status === 'active'
      ? `${PLAN_INFO[sub.plan].name} багц идэвхтэй — ${sub.daysLeft} хоног үлдсэн`
      : sub?.status === 'trial'
        ? `Туршилтын хугацаа — ${sub.daysLeft} хоног үлдсэн`
        : 'Багцын хугацаа дууссан';
  const total = data ? data.prices[plan] * months : 0;
  const bankReady = !!data?.bank.account_number;

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20 text-slate-800 dark:text-slate-100">
      <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl border border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 text-xs font-bold uppercase border border-red-100 dark:border-red-900">
            <CreditCard size={12} /> Багц
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">{statusText}</h1>
          {sub?.endsAt && (
            <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm">
              {sub.status === 'expired' ? 'Дууссан огноо' : 'Дуусах огноо'}: {new Date(sub.endsAt).toLocaleDateString()}
            </p>
          )}
        </div>
        {data && (
          <div className="flex gap-3 text-xs">
            <Usage label="Хэрэглэгч" value={data.usage.users} limit={sub?.status === 'expired' ? null : sub?.limits.users ?? null} />
            <Usage label="Харилцагч" value={data.usage.customers} limit={sub?.status === 'expired' ? null : sub?.limits.customers ?? null} />
          </div>
        )}
      </div>

      {sub?.status === 'expired' && (
        <Notice type="error">
          Багцын хугацаа дууссан тул системийн бусад хэсэг түр хаагдсан. Таны өгөгдөл хадгалагдаж байгаа бөгөөд багц сунгамагц бүгд нээгдэнэ.
        </Notice>
      )}
      {error && <Notice type="error">{error}</Notice>}
      {paidMessage && <Notice type="success">{paidMessage}</Notice>}

      {data && (
        <div className="grid md:grid-cols-2 gap-4">
          {PAID_PLANS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPlan(p)}
              className={`text-left p-6 rounded-3xl border-2 transition-all cursor-pointer bg-white dark:bg-slate-900 ${
                plan === p ? 'border-red-600 shadow-lg shadow-red-500/10' : 'border-slate-100 dark:border-slate-800 hover:border-red-200'
              }`}
            >
              <div className="flex items-baseline justify-between">
                <h2 className="text-lg font-black text-slate-900 dark:text-white">{PLAN_INFO[p].name}</h2>
                <p className="text-2xl font-black text-red-600 dark:text-red-400">
                  {money(data.prices[p])}
                  <span className="text-xs font-bold text-slate-400"> / сар</span>
                </p>
              </div>
              <ul className="mt-4 space-y-1.5">
                {PLAN_INFO[p].features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                    <CheckCircle2 size={15} className="text-emerald-500 shrink-0" /> {f}
                  </li>
                ))}
              </ul>
            </button>
          ))}
        </div>
      )}

      {data?.canPay ? (
        <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl border border-slate-100 dark:border-slate-800 space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-bold text-slate-600 dark:text-slate-300 mr-2">Хугацаа:</span>
            {data.months.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMonths(m)}
                className={`px-4 py-2 rounded-xl text-xs font-bold border cursor-pointer ${
                  months === m ? 'bg-red-600 text-white border-red-600' : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                }`}
              >
                {m} сар
              </button>
            ))}
            <span className="ml-auto text-lg font-black">Нийт: {money(total)}</span>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={() => pay('bank')}
              disabled={!!busy || !bankReady}
              title={bankReady ? undefined : 'Банкны дансны мэдээлэл тохируулагдаагүй байна'}
              className="flex-1 flex items-center justify-center gap-2 bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 text-white font-bold px-5 py-3.5 rounded-2xl text-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {busy === 'bank' ? <Loader2 size={16} className="animate-spin" /> : <Landmark size={16} />} Банкаар шилжүүлэх
            </button>
            {data.qpay && (
              <button
                type="button"
                onClick={() => pay('qpay')}
                disabled={!!busy}
                className="flex-1 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold px-5 py-3.5 rounded-2xl text-sm cursor-pointer disabled:opacity-50"
              >
                {busy === 'qpay' ? <Loader2 size={16} className="animate-spin" /> : <QrCode size={16} />} QPay-ээр төлөх
              </button>
            )}
          </div>

          {bankPayment && (
            <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 space-y-3 text-sm">
              <p className="font-bold text-slate-900 dark:text-white">Доорх данс руу шилжүүлнэ үү:</p>
              <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-2">
                <Row label="Банк" value={data.bank.bank_name} />
                <Row label="Дансны дугаар" value={data.bank.account_number} copy />
                <Row label="Хүлээн авагч" value={data.bank.account_holder} />
                <Row label="Дүн" value={money(bankPayment.amount)} />
                <Row label="Гүйлгээний утга" value={bankPayment.reference} copy highlight />
              </dl>
              <p className="text-xs text-slate-500 dark:text-slate-400 flex items-start gap-1.5">
                <Clock size={14} className="shrink-0 mt-0.5" />
                Гүйлгээний утгад заавал <b>{bankPayment.reference}</b> кодыг бичнэ үү. Орлогыг шалгасны дараа (ажлын 1 өдрийн дотор) багц идэвхжинэ.
                {data.bank.note && ` ${data.bank.note}`}
              </p>
            </div>
          )}

          {qpay && (
            <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 flex flex-col sm:flex-row gap-6 items-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`data:image/png;base64,${qpay.info.qr_image}`} alt="QPay QR" className="w-48 h-48 rounded-xl bg-white p-2" />
              <div className="space-y-3 flex-1">
                <p className="font-bold text-slate-900 dark:text-white">QR кодыг банкны аппаараа уншуулна уу</p>
                <p className="text-xs text-slate-500 flex items-center gap-1.5">
                  <Loader2 size={14} className="animate-spin" /> Төлбөр төлөгдөхийг хүлээж байна...
                </p>
                {qpay.info.urls.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {qpay.info.urls.slice(0, 12).map((u) => (
                      <a
                        key={u.name}
                        href={u.link}
                        className="flex items-center gap-1.5 text-xs font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 rounded-lg"
                      >
                        {/* Банкны лого гадны домэйнд байдаг тул CSP-ээр хаагдана; зөвхөн нэрийг харуулна */}
                        {u.name}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        data && <Notice type="info">Багц сунгах, төлбөр төлөх нь байгууллагын админы эрх. Админдаа хандана уу.</Notice>
      )}

      {data && data.payments.length > 0 && (
        <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl border border-slate-100 dark:border-slate-800 space-y-3">
          <h2 className="font-bold text-slate-900 dark:text-white">Төлбөрийн түүх</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-slate-400">
                  <th className="py-2 pr-4">Огноо</th>
                  <th className="py-2 pr-4">Багц</th>
                  <th className="py-2 pr-4">Дүн</th>
                  <th className="py-2 pr-4">Хэлбэр</th>
                  <th className="py-2 pr-4">Код</th>
                  <th className="py-2 pr-4">Төлөв</th>
                </tr>
              </thead>
              <tbody>
                {data.payments.map((p) => (
                  <tr key={p.id} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="py-2 pr-4 whitespace-nowrap">{new Date(p.created_at).toLocaleDateString()}</td>
                    <td className="py-2 pr-4 whitespace-nowrap font-semibold">
                      {PLAN_INFO[p.plan].name}, {p.months} сар
                    </td>
                    <td className="py-2 pr-4 whitespace-nowrap">{money(p.amount)}</td>
                    <td className="py-2 pr-4 whitespace-nowrap">{METHOD_LABELS[p.method]}</td>
                    <td className="py-2 pr-4 font-mono">{p.reference}</td>
                    <td className="py-2 pr-4">
                      <span className={`px-2 py-0.5 rounded-full font-bold whitespace-nowrap ${STATUS_LABELS[p.status].className}`}>
                        {STATUS_LABELS[p.status].label}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function Usage({ label, value, limit }: { label: string; value: number; limit: number | null }) {
  return (
    <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl px-4 py-3 text-center min-w-28">
      <p className="text-lg font-black text-slate-900 dark:text-white">
        {value.toLocaleString('en-US')}
        {limit !== null && <span className="text-xs text-slate-400"> / {limit.toLocaleString('en-US')}</span>}
      </p>
      <p className="text-slate-500 font-semibold">{label}</p>
    </div>
  );
}

function Row({ label, value, copy, highlight }: { label: string; value: string; copy?: boolean; highlight?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-slate-400 font-semibold">{label}</dt>
      <dd className={`font-bold flex items-center gap-2 ${highlight ? 'text-red-600 dark:text-red-400 font-mono' : ''}`}>
        {value || '—'}
        {copy && value && (
          <button type="button" onClick={() => navigator.clipboard.writeText(value)} className="text-slate-400 hover:text-red-600 cursor-pointer" aria-label="Хуулах">
            <Copy size={13} />
          </button>
        )}
      </dd>
    </div>
  );
}

function Notice({ type, children }: { type: 'error' | 'success' | 'info'; children: React.ReactNode }) {
  const style =
    type === 'error'
      ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300'
      : type === 'success'
        ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300'
        : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300';
  return (
    <div className={`px-5 py-4 rounded-2xl border text-sm font-semibold flex items-start gap-2 ${style}`}>
      {type === 'success' ? <CheckCircle2 size={18} className="shrink-0" /> : <AlertTriangle size={18} className="shrink-0" />} {children}
    </div>
  );
}
