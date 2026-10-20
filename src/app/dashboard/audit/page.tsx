'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { History, ChevronLeft, ChevronRight } from 'lucide-react';
import LoadingComponent from '@/src/app/components/loading';

interface AuditRow {
  id: string;
  user_name: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  summary: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

const ACTION_LABELS: Record<string, string> = {
  'customer.create': 'Харилцагч нэмсэн',
  'customer.update': 'Харилцагч зассан',
  'customer.delete': 'Харилцагч устгасан',
  'customer.import': 'Файлаас харилцагч оруулсан',
  'work.create': 'Ажил бүртгэсэн',
  'work.update': 'Ажил зассан',
  'employee.create': 'Ажилтан нэмсэн',
  'employee.update': 'Ажилтан зассан',
  'data.export': 'Өгөгдөл татсан (CSV)',
};

const FIELD_LABELS: Record<string, string> = {
  first_name: 'Нэр',
  last_name: 'Овог',
  name: 'Нэр',
  email: 'Имэйл',
  phone: 'Утас',
  address: 'Хаяг',
  male: 'Хүйс',
  birth_date: 'Төрсөн огноо',
  tax_number: 'Регистр',
  title: 'Гарчиг',
  price: 'Үнэ',
  status: 'Төлөв',
  assigned_employee: 'Хариуцагч',
  due_date: 'Дуусах огноо',
  role: 'Эрх',
  is_active: 'Идэвхтэй',
  position: 'Албан тушаал',
  rows: 'Мөр',
  created: 'Шинэ',
  merged: 'Нөхсөн',
  failed: 'Алгассан',
};

const FILTERS = [
  { value: '', label: 'Бүгд' },
  { value: 'customer', label: 'Харилцагч' },
  { value: 'work', label: 'Ажил' },
  { value: 'employee', label: 'Ажилчид' },
  { value: 'dataset', label: 'Өгөгдөл' },
];

function formatValue(value: unknown) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Тийм' : 'Үгүй';
  const text = String(value);
  // ISO огноог уншигдахуйц болгоно
  if (/^\d{4}-\d{2}-\d{2}T/.test(text)) return new Date(text).toLocaleDateString();
  return text;
}

// details: { талбар: [хуучин, шинэ] } (өөрчлөлт) эсвэл { талбар: утга }
function Details({ details }: { details: Record<string, unknown> | null }) {
  if (!details) return null;
  return (
    <ul className="mt-1 space-y-0.5">
      {Object.entries(details).map(([key, value]) => (
        <li key={key} className="text-[11px] text-slate-500 dark:text-slate-400">
          <span className="font-bold">{FIELD_LABELS[key] ?? key}:</span>{' '}
          {Array.isArray(value) && value.length === 2 ? (
            <>
              <span className="line-through opacity-70">{formatValue(value[0])}</span> → {formatValue(value[1])}
            </>
          ) : (
            formatValue(value)
          )}
        </li>
      ))}
    </ul>
  );
}

function entityHref(row: AuditRow) {
  if (!row.entity_id || row.action.endsWith('.delete')) return null;
  if (row.entity_type === 'customer') return `/dashboard/customers/${row.entity_id}?type=individual`;
  if (row.entity_type === 'customer_company') return `/dashboard/customers/${row.entity_id}?type=company`;
  if (row.entity_type === 'work') return `/dashboard/workshop/${row.entity_id}`;
  if (row.entity_type === 'employee') return `/dashboard/employees/${row.entity_id}`;
  return null;
}

export default function AuditPage() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [page, setPage] = useState(1);
  const [entity, setEntity] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ page: String(page) });
    if (entity) params.set('entity', entity);
    fetch(`/api/audit?${params}`, { signal: controller.signal })
      .then((res) => res.json())
      .then((json) => {
        if (!json.success) throw new Error(json.error || 'Түүх авахад алдаа гарлаа.');
        setRows(json.data);
        setTotal(json.total);
        setPageSize(json.pageSize);
        setError('');
      })
      .catch((err) => {
        if (err.name !== 'AbortError') setError(err.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [page, entity]);

  if (loading) return <LoadingComponent text="Үйлдлийн түүхийг ачаалж байна..." />;

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20 text-slate-800 dark:text-slate-100">
      <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl border border-slate-100 dark:border-slate-800 space-y-1">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 text-xs font-bold uppercase border border-red-100 dark:border-red-900">
          <History size={12} /> Үйлдлийн түүх
        </div>
        <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">Хэн, хэзээ, юуг өөрчилсөн</h1>
        <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm">
          Харилцагч, ажил, ажилчдын өөрчлөлт болон өгөгдөл татсан, оруулсан үйлдлүүд.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => {
              setEntity(f.value);
              setPage(1);
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
              entity === f.value
                ? 'bg-red-600 text-white border-red-600'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 px-5 py-4 rounded-2xl text-sm font-bold">
          {error}
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 overflow-hidden">
        {rows.length === 0 ? (
          <p className="p-8 text-sm text-slate-400 text-center">Бүртгэгдсэн үйлдэл алга.</p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {rows.map((row) => {
              const href = entityHref(row);
              return (
                <li key={row.id} className="px-5 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-6">
                  <div className="sm:w-40 shrink-0 text-xs text-slate-400 font-semibold">
                    {new Date(row.created_at).toLocaleString()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">
                      <span className="font-bold text-slate-900 dark:text-white">{row.user_name ?? 'Систем'}</span>{' '}
                      <span className="text-slate-500 dark:text-slate-400">— {ACTION_LABELS[row.action] ?? row.action}</span>
                      {row.summary &&
                        (href ? (
                          <Link href={href} className="ml-1 font-bold text-red-600 dark:text-red-400 hover:underline">
                            {row.summary}
                          </Link>
                        ) : (
                          <span className="ml-1 font-bold">{row.summary}</span>
                        ))}
                    </p>
                    <Details details={row.details} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 disabled:opacity-40 cursor-pointer"
            aria-label="Өмнөх хуудас"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-xs font-bold text-slate-500">
            {page} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 disabled:opacity-40 cursor-pointer"
            aria-label="Дараагийн хуудас"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
