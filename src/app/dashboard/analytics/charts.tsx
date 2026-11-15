'use client';

import { useState } from 'react';

// Аналитик хуудасны жижиг графикууд (гадны сангүй, SVG + Tailwind).
// Өнгийг Tailwind fill-/stroke- классаар өгнө — цайвар, бараан горимд тус тусдаа.

// ---- Sparkline: StatTile доторх жижиг хандлагын шугам (нэг цуваа, тэнхлэггүй) ----
export function Sparkline({ values, label }: { values: number[]; label: string }) {
  if (values.length < 2 || values.every((v) => v === 0)) return <div className="h-8" aria-hidden />;
  const max = Math.max(...values);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  const points = values.map((v, i) => [(i / (values.length - 1)) * 100, 30 - ((v - min) / span) * 28]);
  const line = points.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
  const [lx, ly] = points[points.length - 1];
  return (
    <div className="relative h-8" role="img" aria-label={label}>
      <svg viewBox="0 0 100 32" preserveAspectRatio="none" className="absolute inset-0 w-full h-full overflow-visible">
        <polygon points={`0,32 ${line} 100,32`} className="fill-red-600/10 dark:fill-red-500/15" />
        <polyline points={line} fill="none" strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" className="stroke-red-600 dark:stroke-red-500" />
      </svg>
      {/* Сүүлийн цэг (HTML тул сунахгүй) */}
      <span
        className="absolute w-2 h-2 -ml-1 -mt-1 rounded-full bg-red-600 dark:bg-red-500 ring-2 ring-white dark:ring-slate-900"
        style={{ left: `${lx}%`, top: `${(ly / 32) * 100}%` }}
        aria-hidden
      />
    </div>
  );
}

// ---- Цагираг хэмжүүр: 0–100% ----
export function RingGauge({ value, size = 56 }: { value: number | null; size?: number }) {
  const r = 22;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value ?? 0));
  return (
    <svg width={size} height={size} viewBox="0 0 56 56" className="shrink-0 -rotate-90" aria-hidden>
      <circle cx="28" cy="28" r={r} fill="none" strokeWidth="6" className="stroke-slate-100 dark:stroke-slate-800" />
      {value !== null && pct > 0 && (
        <circle
          cx="28"
          cy="28"
          r={r}
          fill="none"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={`${(pct / 100) * c} ${c}`}
          className="stroke-red-600 dark:stroke-red-500 transition-[stroke-dasharray] duration-700"
        />
      )}
    </svg>
  );
}

// ---- Donut: хэсэг бүрийн хооронд 2px зай, hover хийхэд голд нь тухайн хэсгийн утга ----
export interface DonutSegment {
  key: string;
  label: string;
  value: number;
  strokeClass: string; // stroke-[#hex] dark:stroke-[#hex]
}

export function Donut({ segments, centerLabel, format = (v: number) => String(v) }: { segments: DonutSegment[]; centerLabel: string; format?: (v: number) => string }) {
  const [active, setActive] = useState<string | null>(null);
  const total = segments.reduce((s, x) => s + x.value, 0);
  const r = 40;
  const c = 2 * Math.PI * r;
  const visible = segments.filter((s) => s.value > 0);
  const gap = visible.length > 1 ? 2.2 : 0; // хэсгүүдийн хоорондох зай (stroke уртаар)
  let offset = 0;
  const activeSeg = segments.find((s) => s.key === active);

  return (
    <div className="relative w-40 h-40 shrink-0" onMouseLeave={() => setActive(null)}>
      <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90" role="img" aria-label={segments.map((s) => `${s.label} ${s.value}`).join(', ')}>
        <circle cx="50" cy="50" r={r} fill="none" strokeWidth="14" className="stroke-slate-100 dark:stroke-slate-800" />
        {total > 0 &&
          visible.map((s) => {
            const len = (s.value / total) * c;
            const dash = Math.max(len - gap, 0.5);
            const el = (
              <circle
                key={s.key}
                cx="50"
                cy="50"
                r={r}
                fill="none"
                strokeWidth={active === s.key ? 17 : 14}
                strokeDasharray={`${dash} ${c - dash}`}
                strokeDashoffset={-offset}
                className={`${s.strokeClass} transition-[stroke-width,opacity] duration-200 cursor-pointer ${active && active !== s.key ? 'opacity-35' : ''}`}
                onMouseEnter={() => setActive(s.key)}
              >
                <title>{`${s.label}: ${format(s.value)} (${Math.round((s.value / total) * 100)}%)`}</title>
              </circle>
            );
            offset += len;
            return el;
          })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none px-6">
        <span className="text-2xl font-black text-slate-900 dark:text-white tabular-nums leading-none">{format(activeSeg ? activeSeg.value : total)}</span>
        <span className="mt-1 text-[length:max(11px,0.75rem)] font-semibold text-slate-500 dark:text-slate-400 leading-tight">
          {activeSeg ? `${activeSeg.label} · ${total ? Math.round((activeSeg.value / total) * 100) : 0}%` : centerLabel}
        </span>
      </div>
    </div>
  );
}

// ---- Талбайн график: нэг цуваа, нэг тэнхлэг, crosshair + tooltip ----
export function AreaChart({
  points,
  format,
  ariaLabel,
}: {
  points: { key: string; short: string; long: string; value: number }[];
  format: (v: number) => string;
  ariaLabel: string;
}) {
  const [active, setActive] = useState<number | null>(null);
  const n = points.length;
  const rawMax = Math.max(...points.map((p) => p.value), 0);
  const max = niceMax(rawMax);
  const x = (i: number) => (n === 1 ? 50 : (i / (n - 1)) * 100);
  const y = (v: number) => 100 - (v / max) * 100;
  const line = points.map((p, i) => `${x(i).toFixed(2)},${y(p.value).toFixed(2)}`).join(' ');
  // Хагас өргөнтэй карт, утасны дэлгэцэнд шошго давхцахгүйн тулд ~4 шошго
  const labelEvery = Math.ceil(n / 4);
  const a = active !== null ? points[active] : null;

  return (
    <div className="flex gap-3">
      <div className="relative h-48 shrink-0 text-[length:max(10px,0.7rem)] text-slate-400 dark:text-slate-500 text-right tabular-nums">
        <span className="block invisible whitespace-nowrap">{format(max)}</span>
        {[max, max / 2, 0].map((tick, i) => (
          <span key={i} className="absolute right-0 -translate-y-1/2 whitespace-nowrap" style={{ top: `${i * 50}%` }}>
            {format(tick)}
          </span>
        ))}
      </div>
      <div className="flex-1 min-w-0">
        <div className="relative h-48" role="img" aria-label={ariaLabel} onMouseLeave={() => setActive(null)}>
          <div className="absolute inset-x-0 top-0 border-t border-slate-100 dark:border-slate-800" />
          <div className="absolute inset-x-0 top-1/2 border-t border-slate-100 dark:border-slate-800" />
          <div className="absolute inset-x-0 bottom-0 border-t border-slate-200 dark:border-slate-700" />
          {rawMax > 0 && (
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full overflow-visible">
              <polygon points={`0,100 ${line} 100,100`} className="fill-red-600/10 dark:fill-red-500/15" />
              <polyline points={line} fill="none" strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" className="stroke-red-600 dark:stroke-red-500" />
            </svg>
          )}
          {/* Hover бүс: цэг бүрд нэг багана (цэгээс өргөн) */}
          <div className="absolute inset-0 flex">
            {points.map((p, i) => (
              <div
                key={p.key}
                tabIndex={0}
                aria-label={`${p.long}: ${format(p.value)}`}
                onMouseEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
                className="flex-1 h-full outline-none"
              />
            ))}
          </div>
          {a && active !== null && (
            <>
              <div className="absolute top-0 bottom-0 w-px bg-slate-300 dark:bg-slate-600 pointer-events-none" style={{ left: `${x(active)}%` }} />
              <span
                className="absolute w-2.5 h-2.5 -ml-[5px] -mt-[5px] rounded-full bg-red-600 dark:bg-red-500 ring-2 ring-white dark:ring-slate-900 pointer-events-none"
                style={{ left: `${x(active)}%`, top: `${y(a.value)}%` }}
              />
              <div
                className={`absolute z-10 top-0 pointer-events-none whitespace-nowrap bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs rounded-xl px-3 py-2 shadow-lg ${
                  x(active) > 66 ? '-translate-x-full -ml-2' : 'ml-2'
                }`}
                style={{ left: `${x(active)}%` }}
              >
                <p className="font-bold">{a.long}</p>
                <p>{format(a.value)}</p>
              </div>
            </>
          )}
        </div>
        <div className="flex mt-2">
          {points.map((p, i) => (
            <span key={p.key} className="flex-1 text-center text-[length:max(10px,0.7rem)] text-slate-400 dark:text-slate-500 tabular-nums whitespace-nowrap">
              {i % labelEvery === 0 ? p.short : ''}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// Тэнхлэгийн дээд утгыг 1, 2, 5 × 10^n хэлбэрийн цэвэр тоо болгох
export function niceMax(value: number) {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 5, 10].find((s) => s * magnitude >= value) ?? 10;
  return step * magnitude;
}
