'use client';

import { useState, useEffect } from 'react';
import {
  User, Wallet, UserPlus, Briefcase, ArrowUpRight, ArrowDownRight,
  Sparkles, FileText, ArrowRight, AlertTriangle, CheckCircle2, BellRing,
  CheckCheck, BarChart3, Clock,
} from 'lucide-react';
import LoadingComponent from '@/src/app/components/loading';
import InfoTip from '@/src/app/components/InfoTip';
import Tooltip from '@/src/app/components/Tooltip';
import Link from 'next/link';

interface Comparison {
  current: number;
  previous: number;
}

interface DashboardOverview {
  user: { firstName: string; lastName: string };
  companyName: string;
  alerts: { overdue: number; dueSoon: number; submissionsToday: number };
  stats: {
    activeWorks: { pending: number; inProgress: number };
    revenue: Comparison;
    newCustomers: Comparison;
  };
  lastWeek: { day: string; works: number }[];
  submissionsLastWeek: number;
  recentSubmissions: { id: string; submittedAt: string; name: string; service: string }[];
  leaderboard: { id: string; name: string; position: string; completed: number; revenue: number }[];
}

const TZ = 'Asia/Ulaanbaatar';
const WEEKDAYS = ['Ням', 'Даваа', 'Мягмар', 'Лхагва', 'Пүрэв', 'Баасан', 'Бямба'];
const AVATAR_COLORS = ['bg-red-600', 'bg-rose-600', 'bg-emerald-600', 'bg-amber-600', 'bg-purple-600'];

// Графикийн өнгө: dataviz validator-оор цайвар (#dc2626) болон бараан (#ef4444, slate-900 дээр) горимд шалгасан
const BAR_FILL = 'bg-red-600 dark:bg-red-500';

function formatMoney(value: number) {
  if (value >= 1e9) return `${(value / 1e9).toFixed(1)} тэрбум ₮`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(1)} сая ₮`;
  return `${value.toLocaleString('en-US', { maximumFractionDigits: 0 })} ₮`;
}

// Улаанбаатарын цагаар "YYYY-MM-DD"
function localDate(date: Date) {
  return date.toLocaleDateString('sv-SE', { timeZone: TZ });
}

function formatToday(now: number) {
  const [year, month, day] = localDate(new Date(now)).split('-').map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return `${year} оны ${month}-р сарын ${day}, ${WEEKDAYS[weekday]} гараг`;
}

function formatRelative(iso: string, now: number) {
  const date = new Date(iso);
  const time = date.toLocaleTimeString('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });
  const diffDays = Math.round(
    (new Date(localDate(new Date(now))).getTime() - new Date(localDate(date)).getTime()) / 86_400_000
  );
  if (diffDays <= 0) return `Өнөөдөр, ${time}`;
  if (diffDays === 1) return `Өчигдөр, ${time}`;
  if (diffDays < 7) return `${diffDays} өдрийн өмнө`;
  return localDate(date);
}

function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function DeltaBadge({ value }: { value: Comparison }) {
  if (value.previous === 0) {
    return (
      <Tooltip text="Өмнөх сарын ижил хугацаанд 0 байсан тул хувиар харьцуулах боломжгүй.">
      <span className="text-xs font-bold text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800 px-2.5 py-1 rounded-full">
        Харьцуулах өгөгдөлгүй
      </span>
      </Tooltip>
    );
  }
  const pct = Math.round(((value.current - value.previous) / value.previous) * 1000) / 10;
  const up = pct >= 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <Tooltip text={`Өмнөх сарын ижил хугацаатай харьцуулсан өөрчлөлт: (${value.current.toLocaleString('en-US')} − ${value.previous.toLocaleString('en-US')}) ÷ ${value.previous.toLocaleString('en-US')} × 100`}>
    <span
      className={`inline-flex items-center gap-1 text-xs font-extrabold px-2.5 py-1 rounded-full ${
        up
          ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50'
          : 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50'
      }`}
    >
      <Icon size={14} aria-hidden /> {up ? '+' : ''}
      {Math.abs(pct) >= 100 ? Math.round(pct).toLocaleString('en-US') : pct}%
    </span>
    </Tooltip>
  );
}

function WeekChart({ data }: { data: DashboardOverview['lastWeek'] }) {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(...data.map((d) => d.works), 1);
  const total = data.reduce((sum, d) => sum + d.works, 0);
  const busiest = data.reduce((best, d) => (d.works > best.works ? d : best), data[0]);
  const weekdayOf = (day: string) => {
    const [y, m, dd] = day.split('-').map(Number);
    return WEEKDAYS[new Date(Date.UTC(y, m - 1, dd)).getUTCDay()];
  };
  const summary = [
    {
      label: 'Өдрийн дундаж',
      value: (total / data.length).toFixed(1),
      hint: `7 хоногийн нийт ажлыг өдрийн тоонд хуваасан: ${total} ÷ ${data.length}`,
    },
    {
      label: 'Хамгийн их',
      value: busiest && busiest.works > 0 ? `${weekdayOf(busiest.day)} · ${busiest.works}` : '—',
      hint: 'Сүүлийн 7 хоногт хамгийн олон ажил бүртгэгдсэн өдөр ба тэр өдрийн ажлын тоо',
    },
    {
      label: 'Өнөөдөр',
      value: String(data[data.length - 1]?.works ?? 0),
      hint: 'Өнөөдөр (Улаанбаатарын цагаар) бүртгэгдсэн ажлын тоо',
    },
  ];

  return (
    <div className="h-full flex flex-col gap-3">
      <p className="text-3xl font-black text-slate-900 dark:text-white">
        {total} <span className="text-sm font-bold text-slate-500 dark:text-slate-400">ажил бүртгэгдсэн</span>{' '}
        <InfoTip text="Өнөөдрийг оруулаад сүүлийн 7 хоногт (Улаанбаатарын цагаар) шинээр бүртгэгдсэн ажлын нийт тоо. Төлөвөөс үл хамаарна." />
      </p>
      {/* Хажуугийн картын өндрөөр сунаж, хоосон зай үлдээхгүй */}
      <div className="relative flex-1 min-h-44 border-b border-slate-200 dark:border-slate-700" onMouseLeave={() => setActive(null)}>
        <div className="absolute inset-x-0 top-0 border-t border-slate-100 dark:border-slate-800" />
        <div className="absolute inset-x-0 top-1/2 border-t border-slate-100 dark:border-slate-800" />
        <div className="absolute inset-0 flex items-end gap-2 sm:gap-4">
          {data.map((d, i) => {
            const height = d.works > 0 ? Math.max((d.works / max) * 100, 3) : 0;
            const [, month, day] = d.day.split('-');
            return (
              <div
                key={d.day}
                tabIndex={0}
                onMouseEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
                aria-label={`${d.day}: ${d.works} ажил`}
                className="relative flex-1 h-full flex items-end justify-center outline-none"
              >
                <div
                  className={`w-full max-w-6 rounded-t ${BAR_FILL} transition-opacity ${
                    active !== null && active !== i ? 'opacity-40' : ''
                  }`}
                  style={{ height: `${height}%` }}
                />
                {active === i && (
                  <div
                    className={`absolute z-10 pointer-events-none whitespace-nowrap bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs rounded-xl px-3 py-2 shadow-lg ${
                      i === 0 ? 'left-0' : i === data.length - 1 ? 'right-0' : 'left-1/2 -translate-x-1/2'
                    }`}
                    style={{ bottom: `calc(${height}% + 0.5rem)` }}
                  >
                    <p className="font-bold">{`${Number(month)}-р сарын ${Number(day)}`}</p>
                    <p>{d.works} ажил</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <div className="flex gap-2 sm:gap-4">
        {data.map((d) => {
          const [y, m, day] = d.day.split('-').map(Number);
          return (
            <span key={d.day} className="flex-1 text-center text-[10px] sm:text-xs text-slate-400 dark:text-slate-500 font-semibold">
              {WEEKDAYS[new Date(Date.UTC(y, m - 1, day)).getUTCDay()].slice(0, 2)}
            </span>
          );
        })}
      </div>
      <div className="grid grid-cols-3 gap-2 sm:gap-3 pt-2">
        {summary.map((s) => (
          <div key={s.label} className="rounded-2xl bg-slate-50/70 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 px-3 py-2.5 min-w-0">
            <p className="text-[10px] sm:text-[11px] font-bold text-slate-400 dark:text-slate-500 flex items-center gap-1">
              <span className="truncate">{s.label}</span> <InfoTip size={11} text={s.hint} />
            </p>
            <p className="text-sm sm:text-base font-black text-slate-900 dark:text-white tabular-nums truncate">{s.value}</p>
          </div>
        ))}
      </div>
      <table className="sr-only">
        <caption>Сүүлийн 7 хоногт бүртгэгдсэн ажил</caption>
        <tbody>
          {data.map((d) => (
            <tr key={d.day}><td>{d.day}</td><td>{d.works}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // Огноо, "Шинэ" тэмдгийг өгөгдөл ирсэн мөчөөр тооцно (render бүрт Date.now() дуудахгүй)
  const [now, setNow] = useState(0);

  useEffect(() => {
    async function fetchOverview() {
      try {
        const res = await fetch('/api/dashboard/overview');
        const json = await res.json();
        if (json.success) {
          setData(json.data);
          setNow(Date.now());
        } else {
          setError(json.error || 'Хяналтын самбарын мэдээлэл авахад алдаа гарлаа');
        }
      } catch (err) {
        console.error('Failed to load dashboard data:', err);
        setError('Сервертэй холбогдож чадсангүй');
      } finally {
        setLoading(false);
      }
    }
    fetchOverview();
  }, []);

  if (loading) {
    return <LoadingComponent text="Мэдээллийг ачаалж байна..." />;
  }

  if (!data) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 p-6 rounded-3xl text-sm font-bold text-center">
          {error}
        </div>
      </div>
    );
  }

  const { alerts, stats } = data;
  const activeTotal = stats.activeWorks.pending + stats.activeWorks.inProgress;
  const maxCompleted = Math.max(...data.leaderboard.map((e) => e.completed), 1);
  const hasUrgent = alerts.overdue > 0;

  const alertParts: string[] = [];
  if (alerts.overdue > 0) alertParts.push(`${alerts.overdue} ажлын хугацаа хэтэрсэн`);
  if (alerts.dueSoon > 0) alertParts.push(`${alerts.dueSoon} ажил 3 хоногийн дотор (өнөөдрийг оруулаад) дуусах ёстой`);
  if (alerts.submissionsToday > 0) alertParts.push(`өнөөдөр ${alerts.submissionsToday} шинэ анкет ирсэн`);
  const alertText = alertParts.length
    ? `${alertParts.join(', ')}.`.replace(/^./, (c) => c.toUpperCase())
    : 'Бүх ажил хугацаандаа явж байна. Анхаарах зүйл алга.';

  return (
    <div className="max-w-7xl mx-auto space-y-6 sm:space-y-8 pb-24 font-sans antialiased text-slate-800 dark:text-slate-100 px-4 sm:px-6">

      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-xs relative overflow-hidden">
        <div className="absolute -right-10 -top-10 w-48 h-48 bg-red-50/80 dark:bg-red-950/20 rounded-full blur-3xl pointer-events-none"></div>

        <div className="space-y-2 relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 text-xs font-extrabold tracking-wider uppercase">
            <Sparkles size={13} /> Хяналтын самбар
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            Сайн байна уу{data.user.firstName ? `, ${data.user.firstName}` : ''}! 👋
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm max-w-xl">
            {formatToday(now)} · Өнөөдрийн ажил, энэ сарын үзүүлэлт болон багийн гүйцэтгэл.
          </p>
        </div>

        {/* Company Badge */}
        <div className="flex items-center gap-3.5 bg-slate-50/90 dark:bg-slate-800/80 px-4 py-3.5 rounded-2xl border border-slate-200/60 dark:border-slate-700 shadow-xs self-start md:self-auto relative z-10">
          <div className="w-11 h-11 bg-linear-to-tr from-red-600 to-rose-600 text-white rounded-xl flex items-center justify-center shrink-0 shadow-sm shadow-red-500/20">
            <User size={20} />
          </div>
          <div className="space-y-0.5">
            <p className="text-[10px] uppercase font-extrabold tracking-wider text-slate-400">Байгууллага</p>
            <span className="font-extrabold text-sm text-slate-900 dark:text-white truncate max-w-50 block">
              {data.companyName || 'Компанийн нэр'}
            </span>
          </div>
        </div>
      </div>

      {/* Alert Banner */}
      <div className="bg-linear-to-r from-slate-900 via-red-950 to-slate-900 p-5 sm:p-6 rounded-3xl text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-10 -translate-y-10 w-56 h-56 bg-red-500/15 rounded-full blur-3xl pointer-events-none"></div>

        <div className="flex items-start gap-3.5 relative z-10">
          <div
            className={`w-10 h-10 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center shrink-0 shadow-inner ${
              hasUrgent ? 'text-amber-400' : 'text-emerald-400'
            }`}
          >
            {hasUrgent ? <AlertTriangle size={20} /> : alertParts.length ? <BellRing size={20} /> : <CheckCircle2 size={20} />}
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold tracking-wide text-red-300 uppercase">
                {hasUrgent ? 'Анхаарах шаардлагатай' : 'Шуурхай мэдээлэл'}
              </span>
              <span className={`w-2 h-2 rounded-full animate-pulse ${hasUrgent ? 'bg-amber-400' : 'bg-emerald-400'}`}></span>
            </div>
            <p className="text-xs sm:text-sm font-medium text-slate-200">{alertText}</p>
          </div>
        </div>

        <Link
          href="/dashboard/workshop"
          className="self-start sm:self-auto px-4.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-bold transition-all inline-flex items-center gap-2 shrink-0 relative z-10 shadow-xs"
        >
          Ажил руу очих <ArrowRight size={14} />
        </Link>
      </div>

      {/* Dashboard Stats Grid */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        <div className="bg-white dark:bg-slate-900 p-6 sm:p-7 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-xs hover:shadow-md transition-all space-y-4 group">
          <div className="flex items-center justify-between">
            <div className="w-12 h-12 rounded-2xl bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 flex items-center justify-center group-hover:scale-110 transition-transform shadow-xs">
              <Briefcase size={22} />
            </div>
            {alerts.overdue > 0 && (
              <Tooltip text="Хүлээгдэж буй эсвэл хийгдэж буй бөгөөд дуусах өдөр нь өнгөрсөн ажлын тоо. Дуусах өдөртөө хоцорсонд тооцогдохгүй.">
                <span className="inline-flex items-center gap-1 text-xs font-extrabold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 px-2.5 py-1 rounded-full">
                  <Clock size={14} aria-hidden /> {alerts.overdue} хоцорсон
                </span>
              </Tooltip>
            )}
          </div>
          <div>
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1.5">Идэвхтэй ажил <InfoTip text="Одоо “Хүлээгдэж буй” болон “Хийгдэж байна” төлөвтэй бүх ажлын нийлбэр. Дууссан, цуцлагдсан ажил орохгүй." /></h3>
            <p className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">{activeTotal}</p>
          </div>
          <div className="pt-3 border-t border-slate-50 dark:border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <span>Хүлээгдэж буй {stats.activeWorks.pending}</span>
            <span>Хийгдэж байна {stats.activeWorks.inProgress}</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-6 sm:p-7 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-xs hover:shadow-md transition-all space-y-4 group">
          <div className="flex items-center justify-between">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform shadow-xs">
              <Wallet size={22} />
            </div>
            <DeltaBadge value={stats.revenue} />
          </div>
          <div>
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1.5">Энэ сарын орлого <InfoTip text="Энэ сарын 1-нээс хойш “Дууссан” төлөвт орсон ажлуудын үнийн нийлбэр (хэзээ бүртгэгдсэнээс үл хамаарна). Хүлээгдэж буй, хийгдэж буй, цуцлагдсан ажлын үнэ орохгүй." /></h3>
            <p className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">{formatMoney(stats.revenue.current)}</p>
          </div>
          <div className="pt-3 border-t border-slate-50 dark:border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <span className="inline-flex items-center gap-1">Өмнөх сарын ижил хугацаанд <InfoTip size={12} text="Өмнөх сарын 1-нээс яг нэг сарын өмнөх өнөөдрийн мөч хүртэлх утга. Бүтэн сартай биш, ижил урттай хугацаатай харьцуулна." /></span>
            <span className="font-bold text-slate-600 dark:text-slate-300">{formatMoney(stats.revenue.previous)}</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-6 sm:p-7 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-xs hover:shadow-md transition-all space-y-4 group sm:col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between">
            <div className="w-12 h-12 rounded-2xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center group-hover:scale-110 transition-transform shadow-xs">
              <UserPlus size={22} />
            </div>
            <DeltaBadge value={stats.newCustomers} />
          </div>
          <div>
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1.5">Энэ сарын шинэ харилцагч <InfoTip text="Энэ сарын 1-нээс хойш бүртгэгдсэн хувь хүн болон байгууллага харилцагчийн нийт тоо." /></h3>
            <p className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">{stats.newCustomers.current}</p>
          </div>
          <div className="pt-3 border-t border-slate-50 dark:border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <span className="inline-flex items-center gap-1">Өмнөх сарын ижил хугацаанд <InfoTip size={12} text="Өмнөх сарын 1-нээс яг нэг сарын өмнөх өнөөдрийн мөч хүртэлх утга. Бүтэн сартай биш, ижил урттай хугацаатай харьцуулна." /></span>
            <span className="font-bold text-slate-600 dark:text-slate-300">{stats.newCustomers.previous}</span>
          </div>
        </div>
      </section>

      {/* Main Content & Recent Activity Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Last 7 days */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-xs space-y-6 flex flex-col">
          <div className="flex-1 flex flex-col">
            <div className="pb-4 border-b border-slate-100 dark:border-slate-800">
              <h2 className="font-extrabold text-base text-slate-900 dark:text-white">Сүүлийн 7 хоногийн ажил</h2>
              <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">Өдөр бүр бүртгэгдсэн ажлын тоо. Багана дээр очиж тухайн өдрийн тоог харна.</p>
            </div>
            <div className="mt-6 flex-1">
              <WeekChart data={data.lastWeek} />
            </div>
          </div>

          <div className="pt-4 flex items-center justify-end text-xs border-t border-slate-100 dark:border-slate-800">
            <Link href="/dashboard/analytics" className="font-bold text-red-600 dark:text-red-400 hover:underline inline-flex items-center gap-1">
              Дэлгэрэнгүй аналитик <ArrowRight size={12} />
            </Link>
          </div>
        </div>

        {/* Recent Submissions List */}
        <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-xs flex flex-col justify-between space-y-6">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <h2 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <FileText size={18} className="text-red-600 dark:text-red-400" /> Сүүлийн анкетууд
              </h2>
              <Tooltip text="Сүүлийн 7 хоногт (7 × 24 цаг) ирсэн анкетын тоо. Доорх жагсаалтад хамгийн сүүлийн 5-ыг харуулна.">
                <span className="text-xs font-extrabold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/60 px-2.5 py-1 rounded-full">
                  7 хоногт {data.submissionsLastWeek}
                </span>
              </Tooltip>
            </div>

            {data.recentSubmissions.length === 0 ? (
              <p className="mt-6 text-sm text-slate-400 dark:text-slate-500 text-center">Анкет хараахан ирээгүй байна</p>
            ) : (
              <div className="mt-4 space-y-3">
                {data.recentSubmissions.map((item) => {
                  const isNew = now - new Date(item.submittedAt).getTime() < 86_400_000;
                  return (
                    <div
                      key={item.id}
                      className="p-3.5 rounded-2xl bg-slate-50/70 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs font-extrabold text-slate-800 dark:text-slate-200 line-clamp-1">
                            {item.name || 'Нэргүй'}
                          </p>
                          {item.service && (
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">{item.service}</p>
                          )}
                        </div>
                        {isNew && (
                          <Tooltip text="Сүүлийн 24 цагт ирсэн анкет" className="shrink-0">
                            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300">
                              Шинэ
                            </span>
                          </Tooltip>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-medium">
                        <Clock size={12} className="text-slate-400" aria-hidden /> {formatRelative(item.submittedAt, now)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <Link
            href="/dashboard/data"
            className="w-full py-3.5 bg-slate-900 dark:bg-slate-800 hover:bg-red-600 dark:hover:bg-red-600 text-white rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-sm"
          >
            Бүх хариултыг харах <ArrowRight size={14} />
          </Link>
        </div>

      </div>

      {/* EMPLOYEE LEADERBOARD */}
      <section className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 text-[11px] font-black uppercase tracking-wider mb-2">
              <BarChart3 size={13} /> Гүйцэтгэлийн статистик
            </div>
            <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">Энэ сард дуусгасан ажил <InfoTip size={15} text="Энэ сарын 1-нээс хойш “Дууссан” төлөвт орсон, ажилтанд хуваарилагдсан ажлуудыг тоолно. Эрэмбэ: дуусгасан ажлын тоо, тэнцвэл орлогоор." /></h2>
            <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">Энэ сард хамгийн олон ажил дуусгасан 5 ажилтан</p>
          </div>
          <Link
            href="/dashboard/employees"
            className="text-xs font-bold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 hover:text-red-600 dark:hover:text-red-400 px-3 py-1.5 rounded-xl border border-slate-200/60 dark:border-slate-700 self-start sm:self-auto inline-flex items-center gap-1"
          >
            Бүх ажилчид <ArrowRight size={12} />
          </Link>
        </div>

        {data.leaderboard.length === 0 ? (
          <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-6">Энэ сард дууссан ажил хараахан алга</p>
        ) : (
          <div className="space-y-4">
            {data.leaderboard.map((emp, index) => {
              const percentage = Math.round((emp.completed / maxCompleted) * 100);
              return (
                <div key={emp.id} className="p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-800/50 border border-slate-100/80 dark:border-slate-800 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className={`w-8 h-8 rounded-xl font-black text-xs flex items-center justify-center shrink-0 ${
                        index === 0 ? 'bg-amber-500 text-white shadow-xs shadow-amber-500/30' :
                        index === 1 ? 'bg-slate-400 text-white' :
                        index === 2 ? 'bg-amber-700 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
                      }`}>
                        #{index + 1}
                      </div>
                      <div className={`w-10 h-10 rounded-xl ${AVATAR_COLORS[index % AVATAR_COLORS.length]} text-white flex items-center justify-center shrink-0 font-bold text-sm shadow-xs`}>
                        {initials(emp.name)}
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white truncate">{emp.name}</h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate">
                          {emp.position || 'Ажилтан'} •{' '}
                          <Tooltip text="Энэ сард дуусгасан ажлуудын үнийн нийлбэр">
                            <span>{formatMoney(emp.revenue)}</span>
                          </Tooltip>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      <span className="text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase">Дуусгасан:</span>
                      <span className="text-base sm:text-lg font-black text-slate-900 dark:text-white bg-white dark:bg-slate-900 px-3.5 py-1 rounded-xl border border-slate-200/60 dark:border-slate-700 shadow-2xs flex items-center gap-1.5">
                        <CheckCheck size={16} className="text-red-600 dark:text-red-400" /> {emp.completed}
                      </span>
                    </div>
                  </div>

                  <Tooltip text={`Тэргүүлэгчтэй харьцуулсан: ${emp.completed} ÷ ${maxCompleted} = ${percentage}%`} className="w-full">
                    <div className="w-full bg-slate-200/70 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${BAR_FILL}`} style={{ width: `${percentage}%` }}></div>
                    </div>
                  </Tooltip>
                </div>
              );
            })}
          </div>
        )}
      </section>

    </div>
  );
}
