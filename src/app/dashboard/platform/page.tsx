'use client';

import { useCallback, useEffect, useState } from 'react';
import { ShieldCheck, Search, Check, X, Save, Loader2 } from 'lucide-react';
import LoadingComponent from '@/src/app/components/loading';
import { PAID_PLANS, PLAN_INFO, type PaidPlan, type Subscription } from '@/src/lib/plans';

interface CompanyRow {
  company_id: string;
  company_name: string;
  email: string | null;
  users: number;
  customers: number;
  created_at: string | null;
  subscription: Subscription;
}

interface PendingPayment {
  id: string;
  company_name: string;
  plan: PaidPlan;
  months: number;
  amount: string;
  reference: string;
  created_at: string;
}

interface Content {
  testimonial: { enabled: boolean; quote: string; author: string; role: string };
  contact: { phone: string; email: string; address: string; website: string };
  plan_prices: { standard: number; pro: number };
  bank: { bank_name: string; account_number: string; account_holder: string; note: string };
}

const money = (n: number | string) => `${Number(n).toLocaleString('en-US')}₮`;
const inputClass =
  'w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-red-600';

async function api(url: string, init?: RequestInit) {
  const res = await fetch(url, init);
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.success) throw new Error(json.error || 'Алдаа гарлаа.');
  return json;
}

// Платформын (Active CRM-ийн) админ: компаниудын багц, банкны шилжүүлэг баталгаажуулах, нүүр хуудасны контент
export default function PlatformPage() {
  const [tab, setTab] = useState<'companies' | 'content'>('companies');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20 text-slate-800 dark:text-slate-100">
      <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl border border-slate-100 dark:border-slate-800 space-y-1">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 text-xs font-bold uppercase border border-red-100 dark:border-red-900">
          <ShieldCheck size={12} /> Платформ
        </div>
        <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">Active CRM удирдлага</h1>
        <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm">Бүх компанийн багц, төлбөр болон нүүр хуудасны контент.</p>
      </div>

      <div className="flex gap-2">
        {(['companies', 'content'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => {
              setTab(t);
              setError('');
              setMessage('');
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold border cursor-pointer ${
              tab === t ? 'bg-red-600 text-white border-red-600' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
            }`}
          >
            {t === 'companies' ? 'Компани ба төлбөр' : 'Контент ба үнэ'}
          </button>
        ))}
      </div>

      {error && <div className="px-5 py-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-sm font-bold">{error}</div>}
      {message && <div className="px-5 py-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-sm font-bold">{message}</div>}

      {tab === 'companies' ? (
        <Companies onError={setError} onMessage={setMessage} />
      ) : (
        <ContentEditor onError={setError} onMessage={setMessage} />
      )}
    </div>
  );
}

function Companies({ onError, onMessage }: { onError: (m: string) => void; onMessage: (m: string) => void }) {
  const [data, setData] = useState<{ companies: CompanyRow[]; pendingPayments: PendingPayment[] } | null>(null);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState('');
  const [extend, setExtend] = useState<{ id: string; plan: PaidPlan; months: number } | null>(null);

  const load = useCallback(
    (query: string) =>
      api(`/api/platform/companies?q=${encodeURIComponent(query)}`)
        .then((json) => setData(json.data))
        .catch((err) => onError(err.message)),
    [onError]
  );
  useEffect(() => {
    const timer = setTimeout(() => load(q), 300);
    return () => clearTimeout(timer);
  }, [q, load]);

  const run = async (key: string, url: string, body: unknown) => {
    setBusy(key);
    onError('');
    onMessage('');
    try {
      const json = await api(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      onMessage(json.message);
      setExtend(null);
      await load(q);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Алдаа гарлаа.');
    } finally {
      setBusy('');
    }
  };

  if (!data) return <LoadingComponent fullScreen={false} />;

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 space-y-3">
        <h2 className="font-bold text-slate-900 dark:text-white">Баталгаажуулах банкны шилжүүлэг ({data.pendingPayments.length})</h2>
        {data.pendingPayments.length === 0 ? (
          <p className="text-sm text-slate-400">Хүлээгдэж буй шилжүүлэг алга.</p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {data.pendingPayments.map((p) => (
              <li key={p.id} className="py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-sm">
                <span className="font-mono font-bold text-red-600 dark:text-red-400">{p.reference}</span>
                <span className="font-semibold flex-1">
                  {p.company_name} — {PLAN_INFO[p.plan].name}, {p.months} сар, {money(p.amount)}
                </span>
                <span className="text-xs text-slate-400">{new Date(p.created_at).toLocaleString()}</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={!!busy}
                    onClick={() => run(p.id, `/api/platform/payments/${p.id}`, { action: 'confirm' })}
                    className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg cursor-pointer disabled:opacity-50"
                  >
                    {busy === p.id ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Орлого орсон
                  </button>
                  <button
                    type="button"
                    disabled={!!busy}
                    onClick={() => window.confirm('Энэ төлбөрийг цуцлах уу?') && run(p.id, `/api/platform/payments/${p.id}`, { action: 'cancel' })}
                    className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 text-xs font-bold px-3 py-1.5 rounded-lg cursor-pointer disabled:opacity-50"
                  >
                    <X size={13} /> Цуцлах
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-bold text-slate-900 dark:text-white">Компаниуд ({data.companies.length})</h2>
          <div className="relative w-64">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Нэр, имэйл..." className={`${inputClass} pl-9`} />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-slate-400">
                <th className="py-2 pr-4">Компани</th>
                <th className="py-2 pr-4">Багц</th>
                <th className="py-2 pr-4">Дуусах</th>
                <th className="py-2 pr-4">Хэрэглэгч</th>
                <th className="py-2 pr-4">Харилцагч</th>
                <th className="py-2 pr-4" />
              </tr>
            </thead>
            <tbody>
              {data.companies.map((c) => (
                <tr key={c.company_id} className="border-t border-slate-100 dark:border-slate-800 align-top">
                  <td className="py-2.5 pr-4">
                    <p className="font-bold text-sm">{c.company_name}</p>
                    <p className="text-slate-400">{c.email}</p>
                  </td>
                  <td className="py-2.5 pr-4 whitespace-nowrap">
                    <span
                      className={`px-2 py-0.5 rounded-full font-bold ${
                        c.subscription.status === 'expired'
                          ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300'
                          : c.subscription.status === 'trial'
                            ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300'
                            : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                      }`}
                    >
                      {c.subscription.status === 'expired' ? 'Дууссан' : PLAN_INFO[c.subscription.plan].name}
                    </span>
                  </td>
                  <td className="py-2.5 pr-4 whitespace-nowrap">
                    {c.subscription.endsAt ? new Date(c.subscription.endsAt).toLocaleDateString() : '—'}
                    {c.subscription.status !== 'expired' && <span className="text-slate-400"> ({c.subscription.daysLeft} хоног)</span>}
                  </td>
                  <td className="py-2.5 pr-4">{c.users}</td>
                  <td className="py-2.5 pr-4">{c.customers.toLocaleString('en-US')}</td>
                  <td className="py-2.5 pr-4 text-right whitespace-nowrap">
                    {extend?.id === c.company_id ? (
                      <div className="flex items-center gap-1.5 justify-end">
                        <select
                          value={extend.plan}
                          onChange={(e) => setExtend({ ...extend, plan: e.target.value as PaidPlan })}
                          className="border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 bg-white dark:bg-slate-800"
                        >
                          {PAID_PLANS.map((p) => (
                            <option key={p} value={p}>
                              {PLAN_INFO[p].name}
                            </option>
                          ))}
                        </select>
                        <select
                          value={extend.months}
                          onChange={(e) => setExtend({ ...extend, months: Number(e.target.value) })}
                          className="border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 bg-white dark:bg-slate-800"
                        >
                          {[1, 2, 3, 6, 12].map((m) => (
                            <option key={m} value={m}>
                              {m} сар
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          disabled={!!busy}
                          onClick={() => run(c.company_id, `/api/platform/companies/${c.company_id}/subscription`, { action: 'extend', plan: extend.plan, months: extend.months })}
                          className="bg-red-600 text-white font-bold px-2.5 py-1 rounded-lg cursor-pointer disabled:opacity-50"
                        >
                          Сунгах
                        </button>
                        <button type="button" onClick={() => setExtend(null)} className="text-slate-400 cursor-pointer" aria-label="Болих">
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-2 justify-end">
                        <button
                          type="button"
                          onClick={() => setExtend({ id: c.company_id, plan: 'standard', months: 1 })}
                          className="font-bold text-red-600 dark:text-red-400 hover:underline cursor-pointer"
                        >
                          Багц сунгах
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const days = window.prompt('Туршилтын хугацааг өнөөдрөөс хэдэн хоног болгох вэ?', '14');
                            if (days !== null) run(c.company_id, `/api/platform/companies/${c.company_id}/subscription`, { action: 'trial', days: Number(days) });
                          }}
                          className="font-bold text-slate-500 hover:underline cursor-pointer"
                        >
                          Туршилт
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ContentEditor({ onError, onMessage }: { onError: (m: string) => void; onMessage: (m: string) => void }) {
  const [content, setContent] = useState<Content | null>(null);
  const [saving, setSaving] = useState('');

  useEffect(() => {
    api('/api/platform/content')
      .then((json) => setContent(json.data))
      .catch((err) => onError(err.message));
  }, [onError]);

  const save = async <K extends keyof Content>(key: K) => {
    if (!content) return;
    setSaving(key);
    onError('');
    onMessage('');
    try {
      const json = await api('/api/platform/content', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value: content[key] }),
      });
      onMessage(json.message);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Алдаа гарлаа.');
    } finally {
      setSaving('');
    }
  };

  if (!content) return <LoadingComponent fullScreen={false} />;

  const set = <K extends keyof Content>(key: K, patch: Partial<Content[K]>) => setContent({ ...content, [key]: { ...content[key], ...patch } });
  const saveButton = (k: keyof Content) => (
    <button
      type="button"
      onClick={() => save(k)}
      disabled={!!saving}
      className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold px-4 py-2.5 rounded-xl text-xs cursor-pointer disabled:opacity-50"
    >
      {saving === k ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Хадгалах
    </button>
  );

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <Card title="Нүүр хуудасны сэтгэгдэл" hint="Бодит харилцагчийн зөвшөөрөлтэй сэтгэгдэл. Идэвхгүй бол нүүр хуудсанд харагдахгүй.">
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" checked={content.testimonial.enabled} onChange={(e) => set('testimonial', { enabled: e.target.checked })} /> Нүүр хуудсанд харуулах
        </label>
        <textarea rows={4} value={content.testimonial.quote} onChange={(e) => set('testimonial', { quote: e.target.value })} placeholder="Сэтгэгдэл" className={inputClass} />
        <input value={content.testimonial.author} onChange={(e) => set('testimonial', { author: e.target.value })} placeholder="Нэр (жнь: Б. Болд)" className={inputClass} />
        <input value={content.testimonial.role} onChange={(e) => set('testimonial', { role: e.target.value })} placeholder="Албан тушаал, байгууллага" className={inputClass} />
        {saveButton('testimonial')}
      </Card>

      <Card title="Холбоо барих мэдээлэл" hint="Бүх хуудасны доод хэсэгт (footer) харагдана.">
        <input value={content.contact.phone} onChange={(e) => set('contact', { phone: e.target.value })} placeholder="Утас" className={inputClass} />
        <input value={content.contact.email} onChange={(e) => set('contact', { email: e.target.value })} placeholder="Имэйл" className={inputClass} />
        <input value={content.contact.address} onChange={(e) => set('contact', { address: e.target.value })} placeholder="Хаяг" className={inputClass} />
        <input value={content.contact.website} onChange={(e) => set('contact', { website: e.target.value })} placeholder="Вэбсайт" className={inputClass} />
        {saveButton('contact')}
      </Card>

      <Card title="Багцын үнэ (сар бүр, ₮)" hint="Шинэ төлбөрт үйлчилнэ. Аль хэдийн үүссэн төлбөрийн дүн өөрчлөгдөхгүй.">
        {PAID_PLANS.map((p) => (
          <label key={p} className="flex items-center gap-3 text-sm font-semibold">
            <span className="w-24">{PLAN_INFO[p].name}</span>
            <input
              type="number"
              min={0}
              value={content.plan_prices[p]}
              onChange={(e) => set('plan_prices', { [p]: Number(e.target.value) } as Partial<Content['plan_prices']>)}
              className={inputClass}
            />
          </label>
        ))}
        {saveButton('plan_prices')}
      </Card>

      <Card title="Банкны данс" hint="Компаниуд банкаар шилжүүлэхэд харагдана. Дансны дугааргүй бол банкны сонголт идэвхгүй.">
        <input value={content.bank.bank_name} onChange={(e) => set('bank', { bank_name: e.target.value })} placeholder="Банк" className={inputClass} />
        <input value={content.bank.account_number} onChange={(e) => set('bank', { account_number: e.target.value })} placeholder="Дансны дугаар" className={inputClass} />
        <input value={content.bank.account_holder} onChange={(e) => set('bank', { account_holder: e.target.value })} placeholder="Хүлээн авагч" className={inputClass} />
        <input value={content.bank.note} onChange={(e) => set('bank', { note: e.target.value })} placeholder="Нэмэлт тайлбар (заавал биш)" className={inputClass} />
        {saveButton('bank')}
      </Card>
    </div>
  );
}

function Card({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 space-y-3">
      <div>
        <h2 className="font-bold text-slate-900 dark:text-white">{title}</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{hint}</p>
      </div>
      {children}
    </div>
  );
}
