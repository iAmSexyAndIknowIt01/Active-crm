'use client';

import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { CreditCard, CheckCircle2, AlertTriangle, Loader2, Landmark, QrCode, Copy, Clock, BadgeCheck, X } from 'lucide-react';
import LoadingComponent from '@/src/app/components/loading';
import { PAID_PLANS, PLAN_INFO, type PaidPlan, type Subscription } from '@/src/lib/plans';

interface BillingData {
  subscription: Subscription;
  usage: { users: number; customers: number };
  prices: Record<PaidPlan, number>;
  // is_demo: платформын админ жинхэнэ данс оруулаагүй тул жишээ данс харагдаж байна
  bank: { bank_name: string; account_number: string; account_holder: string; note: string; is_demo: boolean };
  qpay: boolean;
  isPlatformAdmin: boolean;
  months: number[];
  canPay: boolean;
  payments: {
    id: string;
    plan: PaidPlan;
    months: number;
    amount: string;
    method: 'bank' | 'qpay' | 'manual';
    status: 'pending' | 'review' | 'paid' | 'cancelled';
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
  review: { label: 'Хянагдаж буй', className: 'text-sky-700 bg-sky-50 dark:text-sky-300 dark:bg-sky-950/50' },
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
  const [busy, setBusy] = useState<'bank' | 'qpay' | 'report' | null>(null);
  // Банкаар төлөх: үүссэн төлбөрийн мэдээлэл (данс, гүйлгээний утга, "Төлбөр хийсэн" товч)
  const [bankPayment, setBankPayment] = useState<{ id: string; reference: string; amount: string; plan: PaidPlan; months: number } | null>(null);
  // "Төлбөр хийсэн" дарсны дараа модал хүлээх мэдэгдэл рүү шилжинэ
  const [reported, setReported] = useState(false);
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
      else {
        setReported(false);
        setBankPayment({
          id: json.data.payment.id,
          reference: json.data.payment.reference,
          amount: json.data.payment.amount,
          plan: json.data.payment.plan,
          months: json.data.payment.months,
        });
      }
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Сүлжээний алдаа гарлаа.');
    } finally {
      setBusy(null);
    }
  };

  // Шилжүүлгийн модал нээлттэй үед арын хуудас гүйлгэгдэхгүй, Escape дарахад хаагдана
  useEffect(() => {
    if (!bankPayment) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && busy !== 'report') setBankPayment(null);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [bankPayment, busy]);

  // "Төлбөр хийсэн": шилжүүлэг хийснээ мэдэгдэнэ. Багц шууд идэвхжихгүй — төлбөр "Хянагдаж буй" болж,
  // платформын админ орлогыг шалгаад баталгаажуулна.
  const reportPaid = async (paymentId: string) => {
    setBusy('report');
    setError('');
    try {
      const res = await fetch(`/api/billing/payments/${paymentId}/report`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Мэдээллийг илгээж чадсангүй.');
      setReported(true);
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
      {data?.payments.some((p) => p.status === 'review') && <Notice type="info">Таны төлбөр хийсэн мэдээллийг админ баталгаажуулах хүртэл түр хүлээнэ үү.</Notice>}

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
              disabled={!!busy}
              className="flex-1 flex items-center justify-center gap-2 bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 text-white font-bold px-5 py-3.5 rounded-2xl text-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {busy === 'bank' ? <Loader2 size={16} className="animate-spin" /> : <Landmark size={16} />} Төлбөр хийх
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

          {/* body руу portal-оор зурна: хуудасны хэсгүүдийн transform/stacking-аас үл хамааран дэлгэц бүрхэнэ */}
          {bankPayment &&
            createPortal(
            <div
              className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 dark:bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200"
              onMouseDown={(e) => {
                if (e.target === e.currentTarget && busy !== 'report') setBankPayment(null);
              }}
            >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="transfer-modal-title"
              className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl shadow-2xl text-sm animate-in fade-in zoom-in-95 slide-in-from-bottom-4 duration-300"
            >
              <div className="flex items-start justify-between gap-4 px-5 sm:px-6 pt-5 sm:pt-6 pb-4 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <h2 id="transfer-modal-title" className="text-lg font-black text-slate-900 dark:text-white">
                    Шилжүүлгийн мэдээлэл
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Доорх дансанд шилжүүлээд &quot;Төлбөр хийсэн&quot; товчийг дарна уу.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setBankPayment(null)}
                  disabled={busy === 'report'}
                  aria-label="Хаах"
                  className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer disabled:opacity-50"
                >
                  <X size={18} />
                </button>
              </div>
              {reported ? (
                <div className="p-6 sm:p-8 text-center space-y-4 animate-in fade-in zoom-in-95">
                  <div className="w-14 h-14 mx-auto rounded-2xl bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 flex items-center justify-center">
                    <Clock size={28} />
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-base font-black text-slate-900 dark:text-white">Төлбөрийн мэдээлэл илгээгдлээ</p>
                    <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                      Таны төлбөр хийсэн мэдээллийг админ баталгаажуулах хүртэл түр хүлээнэ үү.
                    </p>
                    <p className="text-xs text-slate-400">
                      Гүйлгээний утга: <span className="font-mono font-bold text-slate-600 dark:text-slate-300">{bankPayment.reference}</span>.
                      Төлөв нь төлбөрийн түүхэнд &quot;Хянагдаж буй&quot; гэж харагдана.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setBankPayment(null)}
                    className="px-6 py-3 rounded-2xl text-sm font-bold text-white bg-red-600 hover:bg-red-700 cursor-pointer"
                  >
                    Ойлголоо
                  </button>
                </div>
              ) : (
              <>
              <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-200 dark:divide-slate-700">
                <div className="p-5 sm:p-6 space-y-3 bg-slate-50 dark:bg-slate-800/60">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-bold text-slate-900 dark:text-white">Active CRM-ийн данс</p>
                    {data.bank.is_demo && (
                      <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-[11px] font-bold">
                        Жишээ данс
                      </span>
                    )}
                  </div>
                  <dl className="space-y-2">
                    <Row label="Банк" value={data.bank.bank_name} />
                    <Row label="Дансны дугаар" value={data.bank.account_number} copy />
                    <Row label="Хүлээн авагч" value={data.bank.account_holder} />
                  </dl>
                </div>
                <div className="p-5 sm:p-6 space-y-3">
                  <p className="font-bold text-slate-900 dark:text-white">Гүйлгээний мэдээлэл</p>
                  <dl className="space-y-2">
                    <Row label="Багц" value={`${PLAN_INFO[bankPayment.plan].name}, ${bankPayment.months} сар`} />
                    <Row label="Шилжүүлэх дүн" value={money(bankPayment.amount)} copy />
                    <Row label="Гүйлгээний утга" value={bankPayment.reference} copy highlight />
                  </dl>
                </div>
              </div>
              <div className="p-5 sm:p-6 space-y-4 border-t border-slate-100 dark:border-slate-800">
                <p className="text-xs text-slate-500 dark:text-slate-400 flex items-start gap-1.5">
                  <Clock size={14} className="shrink-0 mt-0.5" />
                  <span>
                    Дээрх дансанд <b>{money(bankPayment.amount)}</b> шилжүүлж, гүйлгээний утгад <b>{bankPayment.reference}</b> кодыг бичнэ үү.
                    Шилжүүлсний дараа &quot;Төлбөр хийсэн&quot; товчийг дарна уу. Админ орлогыг шалгаж баталгаажуулмагц багц идэвхжинэ.
                    {data.bank.note && ` ${data.bank.note}`}
                  </span>
                </p>
                {data.bank.is_demo && data.isPlatformAdmin && (
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    Жишээ данс харагдаж байна.{' '}
                    <Link href="/dashboard/platform" className="font-bold underline underline-offset-2">
                      Платформ → Контент ба үнэ → Банкны данс
                    </Link>
                    -аас жинхэнэ дансаа оруулна уу.
                  </p>
                )}
                <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
                  <button
                    type="button"
                    onClick={() => setBankPayment(null)}
                    disabled={busy === 'report'}
                    className="px-5 py-3 rounded-2xl text-sm font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer disabled:opacity-50"
                  >
                    Дараа төлөх
                  </button>
                  <button
                    type="button"
                    onClick={() => reportPaid(bankPayment.id)}
                    disabled={!!busy}
                    className="flex items-center justify-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-600/20 cursor-pointer disabled:opacity-50"
                  >
                    {busy === 'report' ? <Loader2 size={16} className="animate-spin" /> : <BadgeCheck size={16} />} Төлбөр хийсэн
                  </button>
                </div>
              </div>
              </>
              )}
            </div>
            </div>,
              document.body
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
                  {data.canPay && <th className="py-2" />}
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
                    {data.canPay && (
                      <td className="py-2 text-right">
                        {p.method === 'bank' && p.status === 'pending' && (
                          <button
                            type="button"
                            onClick={() => {
                              setReported(false);
                              setBankPayment({ id: p.id, reference: p.reference, amount: p.amount, plan: p.plan, months: p.months });
                            }}
                            disabled={!!busy}
                            className="text-xs font-bold text-red-600 dark:text-red-400 hover:underline whitespace-nowrap cursor-pointer disabled:opacity-50"
                          >
                            Шилжүүлгийн мэдээлэл
                          </button>
                        )}
                      </td>
                    )}
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
