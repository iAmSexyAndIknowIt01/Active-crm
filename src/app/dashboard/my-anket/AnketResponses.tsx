'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, BarChart3, ChevronDown, Download, Inbox, ListChecks, Pencil } from 'lucide-react';
import LoadingComponent from '@/src/app/components/loading';
import { QUESTION_TYPES, hasOptions, parseScaleOption, splitMultiAnswer, type TemplateQuestion } from '@/src/lib/form-templates';

interface ResponseRow {
  id: string;
  submitted_at: string;
  answers: { question_id: string; question_label: string | null; value: string | null }[];
}

interface ResponsesData {
  template: { id: string; title: string; description: string | null; questions: TemplateQuestion[] };
  total: number;
  responses: ResponseRow[];
}

// Хариултыг асуултын ID-аар (байхгүй бол асуултын нэрээр) тулгана
interface Column {
  key: string;
  label: string;
  question?: TemplateQuestion;
}

function formatDateTime(value: string) {
  const d = new Date(value);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Excel "=", "+", "-", "@"-ээр эхэлсэн утгыг томьёо гэж ажиллуулдаг тул (хариулт гаднаас ирдэг)
// эхэнд нь ' нэмж текст болгоно. Зөвхөн тоо бол хэвээр.
function csvCell(value: string) {
  let v = value ?? '';
  if (/^[=+\-@\t\r]/.test(v) && !/^[+-]?\d+([.,]\d+)?$/.test(v)) v = `'${v}`;
  return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export default function AnketResponses({ templateId }: { templateId: string }) {
  const [data, setData] = useState<ResponsesData | null>(null);
  const [error, setError] = useState('');
  const [notFound, setNotFound] = useState(false);
  const [tab, setTab] = useState<'summary' | 'individual'>('summary');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/templates/${templateId}/responses`);
        const json = await res.json();
        if (res.status === 404) return setNotFound(true);
        if (!res.ok || !json.success) throw new Error(json.error || 'Хариултуудыг ачаалахад алдаа гарлаа.');
        setData(json.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Сүлжээний алдаа гарлаа.');
      }
    })();
  }, [templateId]);

  // Баганууд: анкетын одоогийн асуултууд дарааллаараа, дараа нь асуулт нь хасагдсан хуучин хариултууд (нэрээр)
  const { columns, rows } = useMemo(() => {
    if (!data) return { columns: [] as Column[], rows: [] as { id: string; submittedAt: string; values: Map<string, string> }[] };
    const questions = (Array.isArray(data.template.questions) ? data.template.questions : []).map((q) => ({
      ...q,
      id: String(q.id),
      type: (QUESTION_TYPES as readonly string[]).includes(q.type) ? q.type : 'text',
    }));
    const byId = new Map(questions.map((q) => [q.id, q]));
    const byLabel = new Map(questions.map((q) => [q.label.trim(), q]));
    const extra = new Map<string, Column>();

    const rows = data.responses.map((r) => {
      const values = new Map<string, string>();
      for (const a of r.answers) {
        if (!a.value) continue;
        const q = byId.get(String(a.question_id)) ?? byLabel.get((a.question_label ?? '').trim());
        if (q) {
          values.set(q.id, a.value);
        } else {
          const label = (a.question_label ?? '').trim() || `Асуулт ${a.question_id}`;
          const key = `label:${label}`;
          if (!extra.has(key)) extra.set(key, { key, label });
          values.set(key, a.value);
        }
      }
      return { id: r.id, submittedAt: r.submitted_at, values };
    });

    const columns: Column[] = [...questions.map((q) => ({ key: q.id, label: q.label, question: q })), ...extra.values()];
    return { columns, rows };
  }, [data]);

  const downloadCsv = () => {
    if (!data) return;
    const header = ['Огноо', ...columns.map((c) => c.label)];
    const lines = [header, ...rows.map((r) => [formatDateTime(r.submittedAt), ...columns.map((c) => r.values.get(c.key) ?? '')])];
    const csv = '﻿' + lines.map((l) => l.map(csvCell).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(data.template.title || 'anket').replace(/[\\/:*?"<>|]+/g, ' ').trim().slice(0, 80)} - хариулт.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (notFound) {
    return (
      <div className="max-w-xl mx-auto bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-100 dark:border-slate-800 text-center space-y-4">
        <p className="font-bold text-slate-900 dark:text-white">Анкет олдсонгүй.</p>
        <Link href="/dashboard/my-anket" className="inline-flex items-center gap-2 text-sm font-bold text-red-600 dark:text-red-400">
          <ArrowLeft size={16} /> Анкетуудын жагсаалт руу буцах
        </Link>
      </div>
    );
  }
  if (!data && !error) return <LoadingComponent text="Хариултуудыг ачаалж байна..." />;

  return (
    <div className="max-w-5xl mx-auto space-y-5 pb-24 text-slate-800 dark:text-slate-100">
      <div className="bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5 min-w-0">
          <Link
            href="/dashboard/my-anket"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
          >
            <ArrowLeft size={14} /> Анкетууд
          </Link>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">{data?.template.title ?? 'Хариултууд'}</h1>
          {data && (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              <span className="font-bold text-slate-900 dark:text-white">{data.total}</span> хариулт ирсэн
              {rows.length > 0 && <> · сүүлд {formatDateTime(rows[0].submittedAt)}</>}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href={`/dashboard/my-anket/${templateId}`}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            <Pencil size={15} /> Анкет засах
          </Link>
          <button
            type="button"
            onClick={downloadCsv}
            disabled={!rows.length}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-bold text-white bg-red-600 hover:bg-red-700 shadow-md shadow-red-500/20 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download size={15} /> CSV татах
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 px-5 py-3.5 rounded-2xl text-sm font-bold">
          {error}
        </div>
      )}

      {data && rows.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 p-10 rounded-3xl border border-dashed border-slate-300 dark:border-slate-700 text-center space-y-3">
          <Inbox size={36} className="mx-auto text-slate-300 dark:text-slate-600" />
          <p className="font-bold text-slate-900 dark:text-white">Одоогоор хариулт ирээгүй байна</p>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Анкетын QR код, холбоосыг{' '}
            <Link href={`/dashboard/my-anket/${templateId}`} className="font-bold text-red-600 dark:text-red-400 hover:underline">
              засах хуудаснаас
            </Link>{' '}
            авч хуваалцана уу.
          </p>
        </div>
      ) : data ? (
        <>
          {data.total > rows.length && (
            <p className="text-xs font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 rounded-xl px-4 py-2.5">
              Сүүлийн {rows.length} хариултыг харуулж байна (нийт {data.total}).
            </p>
          )}

          <div className="bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl inline-flex items-center gap-1">
            {(
              [
                ['summary', 'Хураангуй', BarChart3],
                ['individual', 'Хариу тус бүр', ListChecks],
              ] as const
            ).map(([key, label, Icon]) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                  tab === key ? 'bg-white dark:bg-slate-900 text-red-600 dark:text-red-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Icon size={15} /> {label}
              </button>
            ))}
          </div>

          {tab === 'summary' ? (
            <div className="space-y-4">
              {columns.map((c, i) => (
                <QuestionSummary key={c.key} number={i + 1} column={c} values={rows.map((r) => r.values.get(c.key)).filter((v): v is string => !!v)} total={rows.length} />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {rows.map((r, i) => (
                <ResponseCard key={r.id} number={rows.length - i} row={r} columns={columns} />
              ))}
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}

function QuestionSummary({ number, column, values, total }: { number: number; column: Column; values: string[]; total: number }) {
  const [showAll, setShowAll] = useState(false);
  const q = column.question;
  const answered = values.length;

  let body: React.ReactNode;
  if (q && hasOptions(q.type)) {
    // Сонголт бүрийн тоо. Олон сонголтод нэг хүн хэд хэдийг сонгож болно (хувь нь хариулсан хүнээс).
    const counts = new Map<string, number>((q.options ?? []).map((o) => [o, 0]));
    for (const v of values) {
      for (const choice of q.type === 'multiselect' ? splitMultiAnswer(v) : [v]) counts.set(choice, (counts.get(choice) ?? 0) + 1);
    }
    const max = Math.max(1, ...counts.values());
    // Үнэлгээ / оноо мэт сонголтод дундаж оноо
    const numeric = values.map((v) => parseScaleOption(v)?.number).filter((n): n is string => n !== undefined).map(Number);
    const average = numeric.length && (q.type === 'rating' || numeric.length === answered) ? numeric.reduce((a, b) => a + b, 0) / numeric.length : null;
    body = (
      <div className="space-y-2">
        {average !== null && (
          <p className="text-sm">
            Дундаж оноо: <span className="font-black text-slate-900 dark:text-white">{average.toFixed(1)}</span>
            <span className="text-xs text-slate-400"> ({numeric.length} хүний)</span>
          </p>
        )}
        {[...counts.entries()].map(([option, count]) => {
          const percent = answered ? Math.round((count / answered) * 100) : 0;
          return (
            <div key={option} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 items-center text-sm">
              <span className="truncate" title={option}>
                {option}
              </span>
              <span className="text-xs font-bold tabular-nums text-slate-600 dark:text-slate-300 text-right">
                {count} · {percent}%
              </span>
              <div className="col-span-2 h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div className="h-full rounded-full bg-red-600" style={{ width: `${(count / max) * 100}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    );
  } else {
    const list = showAll ? values : values.slice(0, 5);
    const numbers = q?.type === 'number' ? values.map((v) => Number(v.replace(',', '.').replace(/\s/g, ''))).filter((n) => !Number.isNaN(n)) : [];
    body = values.length ? (
      <div className="space-y-2">
        {numbers.length > 0 && (
          <p className="text-sm">
            Дундаж: <span className="font-black text-slate-900 dark:text-white">{(numbers.reduce((a, b) => a + b, 0) / numbers.length).toFixed(1)}</span>
          </p>
        )}
        <ul className="space-y-1.5">
          {list.map((v, i) => (
            <li key={i} className="text-sm bg-slate-50 dark:bg-slate-800/60 rounded-xl px-3 py-2 whitespace-pre-line break-words">
              {v}
            </li>
          ))}
        </ul>
        {values.length > 5 && (
          <button type="button" onClick={() => setShowAll(!showAll)} className="text-xs font-bold text-red-600 dark:text-red-400 hover:underline cursor-pointer">
            {showAll ? 'Цөөнийг харуулах' : `Бүгдийг харах (${values.length})`}
          </button>
        )}
      </div>
    ) : (
      <p className="text-sm text-slate-400">Хариулт алга.</p>
    );
  }

  return (
    <section className="bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-2xs space-y-3">
      <div className="flex items-start justify-between gap-3">
        <p className="font-bold text-slate-900 dark:text-white leading-snug">
          <span className="text-slate-400 font-semibold mr-1.5">{number}.</span>
          {column.label}
          {!q && <span className="ml-2 text-xs font-medium text-slate-400">(анкетаас хасагдсан асуулт)</span>}
        </p>
        <span className="shrink-0 text-xs font-semibold text-slate-400 whitespace-nowrap">
          {answered} / {total} хариулсан
        </span>
      </div>
      {body}
    </section>
  );
}

function ResponseCard({
  number,
  row,
  columns,
}: {
  number: number;
  row: { submittedAt: string; values: Map<string, string> };
  columns: Column[];
}) {
  const [open, setOpen] = useState(false);
  const answered = columns.filter((c) => row.values.has(c.key)).length;
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-2xs overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="w-full flex items-center gap-3 px-4 sm:px-5 py-3.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
      >
        <span className="w-10 shrink-0 text-xs font-black text-slate-400 tabular-nums">#{number}</span>
        <span className="flex-1 text-sm font-semibold text-slate-900 dark:text-white tabular-nums">{formatDateTime(row.submittedAt)}</span>
        <span className="text-xs text-slate-400 whitespace-nowrap">
          {answered} / {columns.length} асуулт
        </span>
        <ChevronDown size={16} className={`shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <dl className="border-t border-slate-100 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 animate-in fade-in">
          {columns.map((c, i) => (
            <div key={c.key} className="px-4 sm:px-5 py-3 grid sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-1 sm:gap-4 text-sm">
              <dt className="text-slate-500 dark:text-slate-400">
                <span className="mr-1">{i + 1}.</span>
                {c.label}
              </dt>
              <dd className={row.values.has(c.key) ? 'font-semibold text-slate-900 dark:text-white whitespace-pre-line break-words' : 'text-slate-300 dark:text-slate-600'}>
                {row.values.get(c.key) ?? '—'}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
