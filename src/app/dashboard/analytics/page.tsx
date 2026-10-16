'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowDownRight, ArrowUpRight, AlertTriangle, Briefcase, CheckCircle2, Database, FileText, UserPlus, Wallet,
  Hourglass, Receipt, Lightbulb, ChevronRight, CalendarClock,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import Loading from '@/src/app/components/loading';
import InfoTip from '@/src/app/components/InfoTip';
import Tooltip from '@/src/app/components/Tooltip';

type RangeKey = '7d' | '30d' | '90d' | '12m';
type Unit = 'day' | 'week' | 'month';
type TrendMetric = 'count' | 'value';

interface Comparison {
  current: number | null;
  previous: number | null;
}

interface AnalyticsData {
  range: RangeKey;
  unit: Unit;
  since: string; // YYYY-MM-DD — сонгосон хугацааны эхлэл
  kpis: {
    works: Comparison;
    completed: Comparison;
    revenue: Comparison;
    completionRate: Comparison;
    newCustomers: Comparison;
    submissions: Comparison;
    overdue: number;
    openWorks: number;
    openAmount: number;
  };
  trend: { bucket: string; works: number; amount: number; completed: number; revenue: number }[];
  statuses: { status: string; count: number }[];
  customerTypes: { type: string; count: number }[];
  topServices: { serviceId: number | null; name: string; works: number; completed: number; quantity: number; revenue: number }[];
  topEmployees: { userId: string; name: string; assigned: number; completed: number; revenue: number }[];
  overdueWorks: {
    workId: string;
    title: string;
    customerName: string | null;
    employeeName: string | null;
    dueDate: string;
    daysOverdue: number;
    price: number;
    status: string;
  }[];
}

const RANGE_OPTIONS: { key: RangeKey; label: string; periodLabel: string; previousLabel: string; hint: string }[] = [
  { key: '7d', label: '7 хоног', periodLabel: 'Сүүлийн 7 хоногт', previousLabel: 'өмнөх 7 хоногтой', hint: 'Өнөөдрийг оруулаад сүүлийн 7 өдөр. Өмнөх 7 өдөртэй харьцуулна.' },
  { key: '30d', label: '30 хоног', periodLabel: 'Сүүлийн 30 хоногт', previousLabel: 'өмнөх 30 хоногтой', hint: 'Өнөөдрийг оруулаад сүүлийн 30 өдөр. Өмнөх 30 өдөртэй харьцуулна.' },
  { key: '90d', label: '90 хоног', periodLabel: 'Сүүлийн 90 хоногт', previousLabel: 'өмнөх 90 хоногтой', hint: 'Энэ долоо хоногийг оруулаад сүүлийн 13 долоо хоног (Даваа гарагаас эхэлнэ). Графикт долоо хоногоор бүлэглэнэ.' },
  { key: '12m', label: '12 сар', periodLabel: 'Сүүлийн 12 сард', previousLabel: 'өмнөх 12 сартай', hint: 'Энэ сарыг оруулаад сүүлийн 12 сар (сар бүрийн 1-нээс). Графикт сараар бүлэглэнэ.' },
];

// Төлөвийн өнгө: ажлын хуудасны badge-тай ижил утгатай (шар, цэнхэр, ногоон, улаан).
// dataviz validator-оор энэ дарааллаар (stack-ийн хөршүүд) цайвар, бараан горимд шалгасан.
// Бараан горимд ногоон↔улаан CVD 6.5 тул хэсгүүдийн хооронд 2px зай + тоотой legend заавал.
const STATUS_ROWS = [
  { key: 'pending', label: 'Хүлээгдэж буй', color: 'bg-[#eda100] dark:bg-[#c98500]' },
  { key: 'in_progress', label: 'Хийгдэж байна', color: 'bg-[#2a78d6] dark:bg-[#3987e5]' },
  { key: 'completed', label: 'Дууссан', color: 'bg-[#1baf7a] dark:bg-[#199e70]' },
  { key: 'cancelled', label: 'Цуцлагдсан', color: 'bg-[#e34948] dark:bg-[#e66767]' },
];

const CUSTOMER_TYPE_ROWS = [
  { key: 'individual', label: 'Хувь хүн' },
  { key: 'company', label: 'Байгууллага' },
];

// Нэг өнгөний хоёр түвшин: бүхэл (бүртгэгдсэн) ба түүний хэсэг (дууссан)
const BAR_FILL = 'bg-red-600 dark:bg-red-500';
const BAR_SOFT = 'bg-red-200 dark:bg-red-900';
const BAR_TRACK = 'bg-slate-100 dark:bg-slate-800';
const CARD = 'bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xs';

function formatNumber(value: number) {
  return value.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function formatMoney(value: number) {
  if (value >= 1e9) return `${(value / 1e9).toFixed(1)} тэрбум ₮`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(1)} сая ₮`;
  return `${formatNumber(value)} ₮`;
}

function formatBucket(bucket: string, unit: Unit, long = false) {
  const [year, month, day] = bucket.split('-');
  if (unit === 'month') return long ? `${year} оны ${Number(month)}-р сар` : `${Number(month)}-р сар`;
  if (unit === 'week') return long ? `${bucket}-с эхэлсэн долоо хоног` : `${month}/${day}`;
  return long ? bucket : `${month}/${day}`;
}

// Тэнхлэгийн дээд утгыг 1, 2, 5 × 10^n хэлбэрийн цэвэр тоо болгох
function niceMax(value: number) {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 5, 10].find((s) => s * magnitude >= value) ?? 10;
  return step * magnitude;
}

const percent = (part: number, total: number) => (total > 0 ? Math.round((part / total) * 100) : 0);

// Өмнөх хугацаатай харьцуулсан өөрчлөлт (%, эсвэл хувийн үзүүлэлтэд пункт)
function changeOf(value: Comparison, isPercentPoint = false): number | null {
  const { current, previous } = value;
  if (current === null || previous === null || (!isPercentPoint && previous === 0)) return null;
  const diff = isPercentPoint ? current - previous : ((current - previous) / previous) * 100;
  return Math.round(diff * 10) / 10;
}

// Ажлын хуудас руу шүүлтүүртэй холбоос
function workshopHref(params: Record<string, string | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value) search.set(key, value);
  const query = search.toString();
  return `/dashboard/workshop${query ? `?${query}` : ''}`;
}

function Delta({ value, previousLabel, isPercentPoint = false, format = formatNumber }: {
  value: Comparison;
  previousLabel: string;
  isPercentPoint?: boolean;
  format?: (value: number) => string;
}) {
  const rounded = changeOf(value, isPercentPoint);
  if (rounded === null) {
    return (
      <p className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1">
        Өмнөх хугацаанд өгөгдөлгүй
        <InfoTip size={12} text="Өмнөх ижил урттай хугацаанд утга 0 эсвэл тооцох боломжгүй байсан тул өөрчлөлтийг хувиар гаргах боломжгүй." />
      </p>
    );
  }
  const previous = value.previous ?? 0;
  const current = value.current ?? 0;
  const deltaHint = isPercentPoint
    ? `Өмнөх хугацаанд ${previous}% байсан, одоо ${current}%. Пункт = одоогийн хувь − өмнөх хувь.`
    : `Өмнөх хугацаанд ${format(previous)}, одоо ${format(current)}. Өөрчлөлт = (одоо − өмнөх) ÷ өмнөх × 100.`;
  const up = rounded > 0;
  const down = rounded < 0;
  const Icon = down ? ArrowDownRight : ArrowUpRight;

  return (
    <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 flex-wrap">
      <Tooltip text={deltaHint}>
      <span
        tabIndex={0}
        className={`inline-flex items-center gap-0.5 font-bold cursor-help outline-none ${
          up ? 'text-emerald-600 dark:text-emerald-400' : down ? 'text-rose-600 dark:text-rose-400' : 'text-slate-500 dark:text-slate-400'
        }`}
      >
        {(up || down) && <Icon size={14} aria-hidden />}
        {up ? '+' : ''}
        {Math.abs(rounded) >= 100 ? formatNumber(Math.round(rounded)) : rounded}
        {isPercentPoint ? ' пункт' : '%'}
      </span>
      </Tooltip>
      <span>{previousLabel} харьцуулахад</span>
    </p>
  );
}

// Товчилсон мөнгөн дүнгийн (жишээ нь "1.2 сая ₮") яг утгыг tooltip-оор харуулна
function Money({ value }: { value: number }) {
  const short = formatMoney(value);
  const exact = `${formatNumber(value)} ₮`;
  if (short === exact) return <>{short}</>;
  return (
    <Tooltip text={`Яг дүн: ${exact}`}>
      <span className="cursor-help">{short}</span>
    </Tooltip>
  );
}

function StatTile({ icon: Icon, label, hint, value, exact, tone = 'default', children }: {
  icon: LucideIcon;
  label: string;
  hint: string;
  value: string;
  exact?: number; // мөнгөн дүн бол яг утга (товчилсон утгын tooltip)
  tone?: 'default' | 'warning';
  children?: React.ReactNode;
}) {
  return (
    <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xs flex flex-col gap-2 min-w-0">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
          {label}
          <InfoTip text={hint} />
        </p>
        <span
          className={`p-1.5 rounded-xl shrink-0 ${
            tone === 'warning'
              ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400'
              : 'bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500'
          }`}
        >
          <Icon size={16} aria-hidden />
        </span>
      </div>
      <p className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white whitespace-nowrap tabular-nums">{exact !== undefined ? <Money value={exact} /> : value}</p>
      {children}
    </div>
  );
}

function SectionTitle({ title, subtitle, hint, action }: { title: string; subtitle: string; hint?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-5 flex items-start justify-between gap-3">
      <div>
        <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-1.5">
          {title}
          {hint && <InfoTip text={hint} />}
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>
      </div>
      {action}
    </div>
  );
}

function LegendDot({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
      <span className={`w-2.5 h-2.5 rounded-sm ${className}`} aria-hidden />
      {label}
    </span>
  );
}

// ---- Хураангуй: гол үзүүлэлтүүдийг энгийн өгүүлбэрээр ----
function Summary({ data, periodLabel, previousLabel }: { data: AnalyticsData; periodLabel: string; previousLabel: string }) {
  const { kpis } = data;
  const works = kpis.works.current ?? 0;
  const completed = kpis.completed.current ?? 0;
  const revenue = kpis.revenue.current ?? 0;
  const revenueChange = changeOf(kpis.revenue);
  const topService = data.topServices.find((s) => s.revenue > 0);

  const lines: React.ReactNode[] = [];
  if (works === 0) {
    lines.push(<>{periodLabel} шинэ ажил бүртгэгдээгүй байна.</>);
  } else {
    lines.push(
      <>
        {periodLabel} <b>{formatNumber(works)} ажил</b> бүртгэгдсэнээс <b>{formatNumber(completed)}</b> нь дууссан, <b><Money value={revenue} /></b> орлого орсон
        {revenueChange !== null && (
          <> — {previousLabel} харьцуулахад {revenueChange >= 0 ? `${revenueChange}%-иар өссөн` : `${Math.abs(revenueChange)}%-иар буурсан`}</>
        )}
        .
      </>
    );
  }
  if (kpis.openWorks > 0) {
    lines.push(
      <>
        Одоогоор <b>{formatNumber(kpis.openWorks)} ажил</b> дуусаагүй байгаа бөгөөд тэдгээрийн нийт дүн <b><Money value={kpis.openAmount} /></b>
        {kpis.overdue > 0 ? (
          <>
            , үүнээс <b className="text-amber-700 dark:text-amber-400">{formatNumber(kpis.overdue)}</b> нь хугацаа хэтэрсэн.
          </>
        ) : (
          '.'
        )}
      </>
    );
  }
  if (topService) {
    lines.push(
      <>
        Хамгийн их орлого авчирсан үйлчилгээ: <b>{topService.name}</b> (<Money value={topService.revenue} />).
      </>
    );
  }

  return (
    <div className="flex gap-3 p-4 sm:p-5 rounded-3xl bg-red-50/70 dark:bg-red-950/30 border border-red-100 dark:border-red-900/60">
      <Lightbulb size={18} className="text-red-600 dark:text-red-400 shrink-0 mt-0.5" aria-hidden />
      <div className="space-y-1 text-sm text-slate-700 dark:text-slate-200 leading-relaxed [&_b]:font-extrabold [&_b]:text-slate-900 dark:[&_b]:text-white">
        {lines.map((line, i) => (
          <p key={i}>{line}</p>
        ))}
      </div>
    </div>
  );
}

// ---- Тренд: бүртгэгдсэн ажил (бүхэл) ба түүнээс дууссан хэсэг, нэг баганад ----
function TrendChart({ data, unit }: { data: AnalyticsData['trend']; unit: Unit }) {
  const [metric, setMetric] = useState<TrendMetric>('count');
  const [active, setActive] = useState<number | null>(null);

  // count: бүртгэгдсэн ажлын тоо / дууссан тоо. value: бүртгэгдсэн ажлын нийт дүн / дууссан ажлын орлого
  const rows = data.map((d) =>
    metric === 'count' ? { total: d.works, done: d.completed } : { total: Math.max(d.amount, d.revenue), done: d.revenue }
  );
  const max = niceMax(Math.max(...rows.map((r) => r.total), 0));
  const format = metric === 'value' ? formatMoney : formatNumber;
  const labelEvery = Math.ceil(data.length / 7); // x тэнхлэгт 7 орчим шошго
  const sumTotal = rows.reduce((sum, r) => sum + r.total, 0);
  const sumDone = rows.reduce((sum, r) => sum + r.done, 0);

  return (
    <div className={`${CARD} space-y-5`}>
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-1.5">
            {metric === 'count' ? 'Ажлын урсгал' : 'Ажлын дүн ба орлого'}
            <InfoTip
              text={
                metric === 'count'
                  ? 'Багана бүр тухайн хугацаанд бүртгэгдсэн ажлын тоо. Бараан хэсэг нь тэдгээрээс одоогоор дууссан ажил. Багана дээр очиж яг тоог харна.'
                  : 'Багана бүр тухайн хугацаанд бүртгэгдсэн ажлын нийт үнэ (цуцлагдсаныг оруулахгүй). Бараан хэсэг нь дууссан ажлын үнэ буюу орлого.'
              }
            />
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {unit === 'day' ? 'Өдрөөр' : unit === 'week' ? 'Долоо хоногоор' : 'Сараар'} ·{' '}
            {metric === 'count'
              ? `${formatNumber(sumTotal)} ажил бүртгэгдсэнээс ${formatNumber(sumDone)} нь дууссан`
              : `${formatMoney(sumTotal)} дүнтэй ажлаас ${formatMoney(sumDone)} нь орлого болсон`}
          </p>
        </div>
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl self-start" role="group" aria-label="Үзүүлэлт сонгох">
          {([['count', 'Ажлын тоо'], ['value', 'Мөнгөн дүн']] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setMetric(key)}
              aria-pressed={metric === key}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                metric === key
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        <LegendDot className={BAR_FILL} label={metric === 'count' ? 'Дууссан' : 'Орлого (дууссан ажил)'} />
        <LegendDot className={BAR_SOFT} label={metric === 'count' ? 'Дуусаагүй / цуцлагдсан' : 'Дуусаагүй ажлын дүн'} />
      </div>

      <div className="flex gap-3">
        {/* Y тэнхлэг */}
        <div className="relative h-52 shrink-0 text-[10px] text-slate-400 dark:text-slate-500 text-right tabular-nums">
          <span className="block invisible whitespace-nowrap">{format(max)}</span>
          {[max, max / 2, 0].map((tick, i) => (
            <span key={i} className="absolute right-0 -translate-y-1/2 whitespace-nowrap" style={{ top: `${i * 50}%` }}>
              {format(tick)}
            </span>
          ))}
        </div>

        <div className="flex-1 min-w-0">
          <div className="relative h-52">
            <div className="absolute inset-x-0 top-0 border-t border-slate-100 dark:border-slate-800" />
            <div className="absolute inset-x-0 top-1/2 border-t border-slate-100 dark:border-slate-800" />
            <div className="absolute inset-x-0 bottom-0 border-t border-slate-200 dark:border-slate-700" />

            <div className="absolute inset-0 flex items-end gap-0.5" onMouseLeave={() => setActive(null)}>
              {data.map((d, i) => {
                const { total, done } = rows[i];
                const totalHeight = total > 0 ? Math.max((total / max) * 100, 1.5) : 0;
                const doneShare = total > 0 ? (done / total) * 100 : 0;
                const isActive = active === i;
                return (
                  <div
                    key={d.bucket}
                    tabIndex={0}
                    onMouseEnter={() => setActive(i)}
                    onFocus={() => setActive(i)}
                    onBlur={() => setActive(null)}
                    aria-label={`${formatBucket(d.bucket, unit, true)}: ${d.works} ажил бүртгэгдсэн, ${d.completed} дууссан, ${formatMoney(d.revenue)} орлого`}
                    className="relative flex-1 h-full flex items-end justify-center outline-none"
                  >
                    {/* Бүхэл багана: дээр нь дуусаагүй хэсэг, доор нь дууссан хэсэг, хооронд 2px зай */}
                    {total > 0 && <div
                      className={`w-full max-w-6 flex flex-col gap-0.5 transition-opacity ${active !== null && !isActive ? 'opacity-40' : ''}`}
                      style={{ height: `${totalHeight}%` }}
                    >
                      {doneShare < 100 && <div className={`w-full rounded-t ${BAR_SOFT}`} style={{ flexGrow: 100 - doneShare, minHeight: 2 }} />}
                      {doneShare > 0 && (
                        <div className={`w-full ${doneShare >= 100 ? 'rounded-t' : ''} ${BAR_FILL}`} style={{ flexGrow: doneShare, minHeight: 2 }} />
                      )}
                    </div>}
                    {isActive && (
                      <div
                        className={`absolute z-10 pointer-events-none whitespace-nowrap bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs rounded-xl px-3 py-2 shadow-lg space-y-0.5 ${
                          i < data.length / 3 ? 'left-0' : i > (data.length * 2) / 3 ? 'right-0' : 'left-1/2 -translate-x-1/2'
                        }`}
                        style={{ bottom: `calc(${totalHeight}% + 0.5rem)` }}
                      >
                        <p className="font-bold mb-1">{formatBucket(d.bucket, unit, true)}</p>
                        <p>Бүртгэгдсэн: <span className="font-bold">{d.works} ажил</span> · {formatMoney(d.amount)}</p>
                        <p>Дууссан: <span className="font-bold">{d.completed} ажил</span> · {formatMoney(d.revenue)} орлого</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* X тэнхлэг */}
          <div className="flex gap-0.5 mt-2">
            {data.map((d, i) => (
              <span key={d.bucket} className="flex-1 text-center text-[10px] text-slate-400 dark:text-slate-500 tabular-nums overflow-visible whitespace-nowrap">
                {i % labelEvery === 0 ? formatBucket(d.bucket, unit) : ''}
              </span>
            ))}
          </div>
        </div>
      </div>

      <p className="text-[11px] text-slate-400 dark:text-slate-500">
        Ажил бүртгэгдсэн өдрөөр нь бүлэглэнэ. Орлого нь тухайн хугацаанд бүртгэгдсэн ажлаас одоогоор дууссаных нь үнэ.
      </p>

      {/* Дэлгэц уншигчид зориулсан хүснэгт */}
      <table className="sr-only">
        <caption>Хугацааны тренд</caption>
        <thead>
          <tr><th>Хугацаа</th><th>Бүртгэгдсэн ажил</th><th>Нийт дүн</th><th>Дууссан ажил</th><th>Орлого</th></tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.bucket}>
              <td>{formatBucket(d.bucket, unit, true)}</td>
              <td>{d.works}</td>
              <td>{formatMoney(d.amount)}</td>
              <td>{d.completed}</td>
              <td>{formatMoney(d.revenue)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---- Ажлын төлөв: нэг хэвтээ stack + тоотой legend (мөр бүр ажлын хуудас руу холбоостой) ----
function StatusBreakdown({ data }: { data: AnalyticsData }) {
  const rows = STATUS_ROWS.map((s) => ({ ...s, count: data.statuses.find((x) => x.status === s.key)?.count ?? 0 }));
  const total = rows.reduce((sum, r) => sum + r.count, 0);
  const types = CUSTOMER_TYPE_ROWS.map((t, i) => ({
    ...t,
    color: i === 0 ? BAR_FILL : BAR_SOFT,
    count: data.customerTypes.find((x) => x.type === t.key)?.count ?? 0,
  }));
  const typeTotal = types.reduce((sum, t) => sum + t.count, 0);

  return (
    <div className={CARD}>
      <SectionTitle
        title="Ажлын төлөв"
        subtitle={`Энэ хугацаанд бүртгэгдсэн ${formatNumber(total)} ажил одоо ямар төлөвт байгаа`}
        hint="Сонгосон хугацаанд бүртгэгдсэн ажлуудыг одоогийн төлөвөөр нь тоолно. Хувь = тухайн төлөвийн тоо ÷ нийт ажил × 100 (бүхэл тоонд дугуйлсан тул нийлбэр яг 100% биш байж болно). Мөр дээр дарж ажлын жагсаалтыг харна."
      />
      {total === 0 ? (
        <p className="text-sm text-slate-400 dark:text-slate-500 py-6 text-center">Энэ хугацаанд ажил бүртгэгдээгүй байна</p>
      ) : (
        <>
          <div className="flex h-4 gap-0.5 rounded overflow-hidden" role="img" aria-label={rows.map((r) => `${r.label} ${r.count}`).join(', ')}>
            {rows.filter((r) => r.count > 0).map((r) => (
              <div key={r.key} className={r.color} style={{ flexGrow: r.count }} title={`${r.label}: ${r.count}`} />
            ))}
          </div>
          <ul className="mt-5 divide-y divide-slate-100 dark:divide-slate-800">
            {rows.map((r) => (
              <li key={r.key}>
                <Link
                  href={workshopHref({ status: r.key, createdFrom: data.since })}
                  className="flex items-center justify-between gap-3 py-2.5 -mx-2 px-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors group"
                >
                  <span className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
                    <span className={`w-2.5 h-2.5 rounded-sm ${r.color}`} aria-hidden />
                    {r.label}
                  </span>
                  <span className="flex items-center gap-2 text-sm tabular-nums text-slate-500 dark:text-slate-400">
                    <span className="font-bold text-slate-900 dark:text-white">{formatNumber(r.count)}</span>
                    <span className="w-10 text-right text-xs">{percent(r.count, total)}%</span>
                    <ChevronRight size={14} className="text-slate-300 dark:text-slate-600 group-hover:text-red-500" aria-hidden />
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          {typeTotal > 0 && (
            <div className="mt-5 pt-5 border-t border-slate-100 dark:border-slate-800">
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 flex items-center gap-1">
                Захиалагчийн төрлөөр
                <InfoTip size={12} text="Энэ хугацаанд бүртгэгдсэн ажлыг захиалагч нь хувь хүн эсвэл байгууллага эсэхээр ангилсан. Хувь = тухайн төрлийн ажил ÷ нийт × 100." />
              </p>
              <div className="flex h-2.5 gap-0.5 rounded overflow-hidden" role="img" aria-label={types.map((t) => `${t.label} ${t.count}`).join(', ')}>
                {types.filter((t) => t.count > 0).map((t) => (
                  <div key={t.key} className={t.color} style={{ flexGrow: t.count }} />
                ))}
              </div>
              <div className="flex items-center gap-4 flex-wrap mt-2.5">
                {types.map((t) => (
                  <Link
                    key={t.key}
                    href={workshopHref({ customerType: t.key, createdFrom: data.since })}
                    className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 hover:text-red-600 dark:hover:text-red-400"
                  >
                    <span className={`w-2.5 h-2.5 rounded-sm ${t.color}`} aria-hidden />
                    {t.label}
                    <span className="font-bold text-slate-900 dark:text-white tabular-nums">{formatNumber(t.count)}</span>
                    <span className="text-slate-400">({percent(t.count, typeTotal)}%)</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Хэвтээ баганан жагсаалт: нэр, утга, багана (нэг өнгөтэй). href байвал мөр нь холбоос болно.
function BarList({ rows, emptyText }: {
  rows: { key: string; label: string; value: number; display: React.ReactNode; title?: string; sub?: string; href?: string }[];
  emptyText: string;
}) {
  const max = Math.max(...rows.map((r) => r.value), 0);
  if (rows.length === 0 || max === 0) {
    return <p className="text-sm text-slate-400 dark:text-slate-500 py-6 text-center">{emptyText}</p>;
  }
  return (
    <ul className="space-y-1">
      {rows.map((row) => {
        const body = (
          <>
            <div className="flex items-baseline justify-between gap-3 text-sm mb-1.5">
              <span className="font-bold text-slate-700 dark:text-slate-200 truncate">{row.label}</span>
              <span className="shrink-0 font-bold text-slate-900 dark:text-white tabular-nums">{row.display}</span>
            </div>
            <div className={`h-2 rounded ${BAR_TRACK}`}>
              <div className={`h-full rounded ${BAR_FILL}`} style={{ width: `${row.value > 0 ? Math.max((row.value / max) * 100, 1) : 0}%` }} />
            </div>
            {row.sub && <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">{row.sub}</p>}
          </>
        );
        return (
          <li key={row.key} title={row.title}>
            {row.href ? (
              <Link href={row.href} className="block -mx-2 px-2 py-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors">
                {body}
              </Link>
            ) : (
              <div className="py-2">{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

// ---- Хугацаа хэтэрсэн ажлууд: шууд арга хэмжээ авах жагсаалт ----
function OverdueList({ data }: { data: AnalyticsData }) {
  const { overdueWorks, kpis } = data;
  if (kpis.overdue === 0) return null;
  return (
    <div className={CARD}>
      <SectionTitle
        title="Анхаарах ажлууд"
        subtitle={`Дуусах хугацаа нь өнгөрсөн ${formatNumber(kpis.overdue)} ажил байна (хамгийн их хоцорсноос)`}
        hint="Дуусах огноо нь өнөөдрөөс өмнө боловч дуусаагүй, цуцлагдаагүй ажлууд. Хамгийн их хоцорсон эхний 5-ыг харуулна. Сонгосон хугацаанаас хамаарахгүй."
        action={
          <Link
            href={workshopHref({ due: 'overdue', sort: 'due' })}
            className="shrink-0 inline-flex items-center gap-1 text-xs font-bold text-red-600 dark:text-red-400 hover:underline"
          >
            Бүгдийг харах <ChevronRight size={14} aria-hidden />
          </Link>
        }
      />
      <ul className="divide-y divide-slate-100 dark:divide-slate-800">
        {overdueWorks.map((w) => (
          <li key={w.workId}>
            <Link
              href={`/dashboard/workshop/${w.workId}`}
              className="flex items-center gap-3 py-3 -mx-2 px-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors group"
            >
              <Tooltip text={`Дуусах огноо (${w.dueDate.replaceAll('-', '.')})-ноос хойш өнгөрсөн хоног`} className="shrink-0">
                <span className="w-16 text-center rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 py-1.5">
                  <span className="block text-sm font-black tabular-nums">{formatNumber(w.daysOverdue)}</span>
                  <span className="block text-[10px] font-bold">хоног</span>
                </span>
              </Tooltip>
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-bold text-slate-800 dark:text-slate-100 truncate group-hover:text-red-600 dark:group-hover:text-red-400">
                  {w.title}
                </span>
                <span className="block text-xs text-slate-500 dark:text-slate-400 truncate">
                  {w.customerName || 'Харилцагчгүй'} · {w.employeeName || 'Ажилтан томилоогүй'} · {w.dueDate.replaceAll('-', '.')}
                </span>
              </span>
              <span className="shrink-0 text-sm font-bold text-slate-900 dark:text-white tabular-nums hidden sm:block"><Money value={w.price} /></span>
              <ChevronRight size={14} className="text-slate-300 dark:text-slate-600 group-hover:text-red-500 shrink-0" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function AnalyticsPage() {
  const [range, setRange] = useState<RangeKey>('30d');
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let ignore = false;
    async function fetchAnalytics() {
      try {
        const res = await fetch(`/api/analytics?range=${range}`);
        const result = await res.json();
        if (ignore) return;
        if (result.success) {
          setData(result.data);
          setError('');
        } else {
          setError(result.error || 'Аналитик мэдээлэл авахад алдаа гарлаа');
        }
      } catch (err) {
        console.error('Failed to fetch analytics:', err);
        if (!ignore) setError('Сервертэй холбогдож чадсангүй');
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    fetchAnalytics();
    return () => {
      ignore = true;
    };
  }, [range]);

  const changeRange = (key: RangeKey) => {
    if (key === range) return;
    setLoading(true);
    setRange(key);
  };

  const rangeOption = RANGE_OPTIONS.find((r) => r.key === range)!;
  const completedNow = data?.kpis.completed.current ?? 0;
  const avgTicket = data && completedNow > 0 ? (data.kpis.revenue.current ?? 0) / completedNow : null;
  const avgTicketPrev =
    data && (data.kpis.completed.previous ?? 0) > 0 ? (data.kpis.revenue.previous ?? 0) / (data.kpis.completed.previous ?? 1) : null;

  return (
    <div className="max-w-7xl mx-auto space-y-6 text-slate-800 dark:text-slate-100">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">Аналитик тойм</h1>
          <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm mt-1">
            Ажил, орлого, харилцагчийн үзүүлэлтүүд. Сонгосон хугацаанд бүртгэгдсэн өгөгдлөөр тооцож, өмнөх ижил хугацаатай харьцуулна.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <div className="flex bg-white dark:bg-slate-900 p-1 rounded-2xl border border-slate-200 dark:border-slate-800" role="group" aria-label="Хугацаа сонгох">
            {RANGE_OPTIONS.map((option) => (
              <Tooltip key={option.key} text={option.hint} className="flex-1 sm:flex-none">
              <button
                type="button"
                onClick={() => changeRange(option.key)}
                aria-pressed={range === option.key}
                className={`w-full px-2 sm:px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all cursor-pointer ${
                  range === option.key
                    ? 'bg-red-600 text-white shadow-lg shadow-red-500/20'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                {option.label}
              </button>
              </Tooltip>
            ))}
          </div>
          <Link
            href="/dashboard/data"
            className="flex items-center justify-center gap-2 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs transition-all text-sm"
          >
            <Database size={16} className="text-red-600 dark:text-red-400" /> Өгөгдөл татах
          </Link>
        </div>
      </div>

      {!data ? (
        loading ? (
          <Loading />
        ) : (
          <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 p-6 rounded-3xl text-sm font-bold text-center">
            {error}
          </div>
        )
      ) : (
        <div className={`space-y-6 transition-opacity ${loading ? 'opacity-50 pointer-events-none' : ''}`} aria-busy={loading}>
          {error && <p className="text-sm font-bold text-rose-600 dark:text-rose-400">{error}</p>}

          <Summary data={data} periodLabel={rangeOption.periodLabel} previousLabel={rangeOption.previousLabel} />

          {/* Гүйцэтгэл: сонгосон хугацааны үзүүлэлтүүд */}
          <section aria-label="Гол үзүүлэлтүүд">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <StatTile
                icon={Briefcase}
                label="Бүртгэгдсэн ажил"
                hint="Сонгосон хугацаанд шинээр бүртгэгдсэн бүх ажил (төлөв харгалзахгүй)."
                value={formatNumber(data.kpis.works.current ?? 0)}
              >
                <Delta value={data.kpis.works} previousLabel={rangeOption.previousLabel} />
              </StatTile>
              <StatTile
                icon={CheckCircle2}
                label="Гүйцэтгэлийн хувь"
                hint="Дууссан ажил ÷ (бүртгэгдсэн ажил − цуцлагдсан) × 100. Сонгосон хугацаанд бүртгэгдсэн ажлаар тооцно. Өөрчлөлтийг пунктээр (хувийн зөрүү) харуулна."
                value={data.kpis.completionRate.current === null ? '—' : `${data.kpis.completionRate.current}%`}
              >
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  <span className="font-bold text-slate-700 dark:text-slate-200">{formatNumber(completedNow)}</span> ажил дууссан
                </p>
                <Delta value={data.kpis.completionRate} previousLabel={rangeOption.previousLabel} isPercentPoint />
              </StatTile>
              <StatTile
                icon={Wallet}
                label="Орлого"
                hint="Сонгосон хугацаанд бүртгэгдсэн ажлаас одоогоор 'Дууссан' төлөвтэй ажлуудын нийт үнэ."
                value={formatMoney(data.kpis.revenue.current ?? 0)}
                exact={data.kpis.revenue.current ?? 0}
              >
                <Delta value={data.kpis.revenue} previousLabel={rangeOption.previousLabel} format={formatMoney} />
              </StatTile>
              <StatTile
                icon={Receipt}
                label="Дундаж ажлын үнэ"
                hint="Орлогыг дууссан ажлын тоонд хуваасан дүн — нэг ажлаас дунджаар хэдэн төгрөг орж байгаа."
                value={avgTicket === null ? '—' : formatMoney(avgTicket)}
                exact={avgTicket === null ? undefined : Math.round(avgTicket)}
              >
                <Delta value={{ current: avgTicket, previous: avgTicketPrev }} previousLabel={rangeOption.previousLabel} format={formatMoney} />
              </StatTile>
              <StatTile
                icon={UserPlus}
                label="Шинэ харилцагч"
                hint="Сонгосон хугацаанд бүртгэгдсэн хувь хүн болон байгууллага харилцагч."
                value={formatNumber(data.kpis.newCustomers.current ?? 0)}
              >
                <Delta value={data.kpis.newCustomers} previousLabel={rangeOption.previousLabel} />
              </StatTile>
              <StatTile
                icon={FileText}
                label="Анкетын хариулт"
                hint="Сонгосон хугацаанд нийтийн анкетаар (холбоосоор) ирсэн хариултын тоо."
                value={formatNumber(data.kpis.submissions.current ?? 0)}
              >
                <Delta value={data.kpis.submissions} previousLabel={rangeOption.previousLabel} />
              </StatTile>

              {/* Одоогийн байдал: хугацаанаас үл хамаарна */}
              <StatTile
                icon={Hourglass}
                label="Хүлээгдэж буй орлого"
                hint="Одоогоор 'Хүлээгдэж буй' болон 'Хийгдэж байна' төлөвтэй бүх ажлын нийт үнэ — дуусвал орлого болно. Сонгосон хугацаанаас хамаарахгүй."
                value={formatMoney(data.kpis.openAmount)}
                exact={data.kpis.openAmount}
              >
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  <span className="font-bold text-slate-700 dark:text-slate-200">{formatNumber(data.kpis.openWorks)}</span> ажил дуусаагүй · одоогийн байдлаар
                </p>
              </StatTile>
              <StatTile
                icon={AlertTriangle}
                label="Хугацаа хэтэрсэн"
                hint="Дуусах огноо нь өнөөдрөөс өмнө боловч дуусаагүй, цуцлагдаагүй ажил. Сонгосон хугацаанаас хамаарахгүй, одоогийн байдлаар."
                value={formatNumber(data.kpis.overdue)}
                tone={data.kpis.overdue > 0 ? 'warning' : 'default'}
              >
                {data.kpis.overdue > 0 ? (
                  <Link
                    href={workshopHref({ due: 'overdue', sort: 'due' })}
                    className="text-xs font-bold text-amber-700 dark:text-amber-400 inline-flex items-center gap-1 hover:underline"
                  >
                    <CalendarClock size={14} aria-hidden /> Жагсаалтыг харах →
                  </Link>
                ) : (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 font-bold inline-flex items-center gap-1">
                    <CheckCircle2 size={14} aria-hidden /> Хоцорсон ажилгүй
                  </p>
                )}
              </StatTile>
            </div>
          </section>

          <TrendChart data={data.trend} unit={data.unit} />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <StatusBreakdown data={data} />
            <OverdueList data={data} />

            <div className={CARD}>
              <SectionTitle
                title="Шилдэг үйлчилгээ"
                subtitle="Дууссан ажлын орлогоор эрэмбэлсэн эхний 5"
                hint="Орлого = дууссан ажил доторх тухайн үйлчилгээний (үнэ × тоо ширхэг)-ийн нийлбэр. Нэг ажилд олон үйлчилгээ байж болно. Цуцлагдсан ажлыг тооцохгүй. Баганын урт нь тэргүүлэгчтэй харьцуулсан."
              />
              <BarList
                emptyText="Энэ хугацаанд үйлчилгээтэй ажил алга"
                rows={data.topServices.map((s) => ({
                  key: `${s.serviceId ?? s.name}`,
                  label: s.name,
                  value: s.revenue,
                  display: <Money value={s.revenue} />,
                  title: `${s.name}: ${formatNumber(s.revenue)} ₮`,
                  sub: `${s.works} ажилд орсноос ${s.completed} нь дууссан${s.quantity > s.completed ? ` · нийт ${s.quantity} удаа (ширхэг)` : ''}`,
                  href: s.serviceId ? workshopHref({ service: String(s.serviceId), createdFrom: data.since }) : undefined,
                }))}
              />
            </div>

            <div className={CARD}>
              <SectionTitle
                title="Ажилчдын гүйцэтгэл"
                subtitle="Дуусгасан ажлын тоогоор эрэмбэлсэн эхний 5"
                hint="Сонгосон хугацаанд бүртгэгдэж, тухайн ажилтанд хуваарилагдсан ажлаар тооцно. Хувь = дууссан ÷ хуваарилсан × 100. Орлого = дууссан ажлын үнийн нийлбэр."
              />
              {data.topEmployees.length === 0 ? (
                <p className="text-sm text-slate-400 dark:text-slate-500 py-6 text-center">Энэ хугацаанд хуваарилсан ажил алга</p>
              ) : (
                <div className="overflow-x-auto -mx-1">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="text-xs text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-slate-800">
                        <th className="font-bold py-2 px-1">Ажилтан</th>
                        <th className="font-bold py-2 px-1 text-right">
                          <span className="inline-flex items-center gap-1">Дууссан / Хуваарилсан <InfoTip size={12} text="Дууссан: “Дууссан” төлөвтэй ажил. Хуваарилсан: тухайн ажилтанд оноосон бүх ажил (төлөв харгалзахгүй)." /></span>
                        </th>
                        <th className="font-bold py-2 px-1 text-right">
                          <span className="inline-flex items-center gap-1">Орлого <InfoTip size={12} text="Тухайн ажилтны дуусгасан ажлуудын үнийн нийлбэр." /></span>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {data.topEmployees.map((e) => {
                        const rate = percent(e.completed, e.assigned);
                        return (
                          <tr key={e.userId}>
                            <td className="py-3 px-1">
                              <Link
                                href={workshopHref({ employee: e.userId, createdFrom: data.since })}
                                className="font-bold text-slate-700 dark:text-slate-200 hover:text-red-600 dark:hover:text-red-400"
                              >
                                {e.name}
                              </Link>
                              <Tooltip text={`Гүйцэтгэл: ${e.completed} дууссан ÷ ${e.assigned} хуваарилсан = ${rate}%`} className="w-full">
                                <div className="flex items-center gap-2 mt-1.5 w-full">
                                  <div className={`h-1.5 rounded flex-1 max-w-32 ${BAR_TRACK}`}>
                                    <div className={`h-full rounded ${BAR_FILL}`} style={{ width: `${rate}%` }} />
                                  </div>
                                  <span className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">{rate}%</span>
                                </div>
                              </Tooltip>
                            </td>
                            <td className="py-3 px-1 text-right tabular-nums text-slate-600 dark:text-slate-300 whitespace-nowrap">
                              <span className="font-bold text-slate-900 dark:text-white">{e.completed}</span> / {e.assigned}
                            </td>
                            <td className="py-3 px-1 text-right tabular-nums text-slate-600 dark:text-slate-300 whitespace-nowrap">
                              <Money value={e.revenue} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
