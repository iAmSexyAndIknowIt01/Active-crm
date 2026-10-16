'use client';

import { useEffect, useState } from 'react';
import {
  Database, Search, Download, Eye, X, UserCheck, Building2, Wrench, Briefcase, Users, FileText,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import Loading from '@/src/app/components/loading';
import InfoTip from '@/src/app/components/InfoTip';
import Tooltip from '@/src/app/components/Tooltip';

interface DatasetSummary {
  key: string;
  label: string;
  description: string;
  count: number;
  lastUpdated: string | null;
}

interface DatasetPreview {
  key: string;
  label: string;
  columns: string[];
  rows: string[][];
  total: number;
}

const DATASET_ICONS: Record<string, LucideIcon> = {
  customers: UserCheck,
  'customer-companies': Building2,
  works: Wrench,
  services: Briefcase,
  employees: Users,
  submissions: FileText,
};

export default function DataPage() {
  const [datasets, setDatasets] = useState<DatasetSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const [preview, setPreview] = useState<DatasetPreview | null>(null);
  const [previewKey, setPreviewKey] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState('');

  useEffect(() => {
    async function fetchDatasets() {
      try {
        const res = await fetch('/api/data');
        const result = await res.json();
        if (result.success) {
          setDatasets(result.data);
        } else {
          setError(result.error || 'Өгөгдлийн мэдээлэл авахад алдаа гарлаа');
        }
      } catch (err) {
        console.error('Failed to fetch datasets:', err);
        setError('Сервертэй холбогдож чадсангүй');
      } finally {
        setLoading(false);
      }
    }
    fetchDatasets();
  }, []);

  const openPreview = async (key: string) => {
    setPreviewKey(key);
    setPreview(null);
    setPreviewError('');
    try {
      const res = await fetch(`/api/data/${key}`);
      const result = await res.json();
      if (result.success) {
        setPreview(result.data);
      } else {
        setPreviewError(result.error || 'Өгөгдөл авахад алдаа гарлаа');
      }
    } catch (err) {
      console.error('Failed to fetch dataset preview:', err);
      setPreviewError('Сервертэй холбогдож чадсангүй');
    }
  };

  const closePreview = () => {
    setPreviewKey(null);
    setPreview(null);
    setPreviewError('');
  };

  const query = searchQuery.trim().toLowerCase();
  const filteredDatasets = datasets.filter(
    (d) => d.label.toLowerCase().includes(query) || d.description.toLowerCase().includes(query)
  );
  const totalRows = datasets.reduce((sum, d) => sum + d.count, 0);
  const previewLabel = datasets.find((d) => d.key === previewKey)?.label;

  return (
    <div className="max-w-7xl mx-auto space-y-6 sm:space-y-8 text-slate-800 dark:text-slate-100">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">Өгөгдлийн менежмент</h1>
          <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm mt-1">
            Компанийнхаа өгөгдлийг урьдчилан харж, CSV (Excel) файлаар татаж авна уу.
          </p>
        </div>

        {!loading && !error && (
          <div className="flex items-center gap-2 bg-white dark:bg-slate-900 px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 text-sm self-start sm:self-auto">
            <Database size={16} className="text-red-600 dark:text-red-400" />
            <span className="text-slate-500 dark:text-slate-400">Нийт</span>
            <span className="font-black text-slate-900 dark:text-white">{totalRows.toLocaleString()}</span>
            <span className="text-slate-500 dark:text-slate-400">мөр</span>
            <InfoTip text="Доорх бүх өгөгдлийн багцын мөрийн тооны нийлбэр. Нэг мөр = нэг бичлэг (харилцагч, ажил, анкет гэх мэт)." />
          </div>
        )}
      </div>

      {/* Search Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="relative w-full sm:w-96">
          <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-400 dark:text-slate-500">
            <Search size={18} />
          </span>
          <input
            type="text"
            placeholder="Өгөгдлийн багц хайх..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-white text-sm focus:outline-none focus:border-red-500 dark:focus:border-red-400 focus:bg-white dark:focus:bg-slate-900 transition-all"
          />
        </div>
      </div>

      {/* Dataset cards */}
      {loading ? (
        <Loading />
      ) : error ? (
        <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 p-6 rounded-3xl text-sm font-bold text-center">
          {error}
        </div>
      ) : filteredDatasets.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 py-16 rounded-3xl border border-slate-200 dark:border-slate-800 text-center space-y-3">
          <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 rounded-full flex items-center justify-center mx-auto">
            <Database size={24} />
          </div>
          <p className="text-slate-600 dark:text-slate-300 font-bold text-sm">Өгөгдлийн багц олдсонгүй</p>
          <p className="text-slate-400 dark:text-slate-500 text-xs">Хайлтын үгээ өөрчилж үзнэ үү.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {filteredDatasets.map((dataset) => {
            const Icon = DATASET_ICONS[dataset.key] ?? Database;
            const isEmpty = dataset.count === 0;
            const isActive = previewKey === dataset.key;
            return (
              <div
                key={dataset.key}
                className={`bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-3xl border shadow-xs flex flex-col gap-4 transition-all ${
                  isActive
                    ? 'border-red-500 dark:border-red-400 ring-2 ring-red-500/20'
                    : 'border-slate-200 dark:border-slate-800'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 rounded-2xl flex items-center justify-center shrink-0">
                    <Icon size={20} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-extrabold text-slate-900 dark:text-white">{dataset.label}</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{dataset.description}</p>
                  </div>
                </div>

                <div className="flex items-end justify-between gap-2">
                  <div>
                    <p className="text-2xl font-black text-slate-900 dark:text-white">{dataset.count.toLocaleString()}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1">
                      мөр <InfoTip size={12} text={`Танай байгууллагын “${dataset.label}” багцад байгаа бүх бичлэгийн тоо. CSV татахад яг ийм тооны мөр гарна.`} />
                    </p>
                  </div>
                  <Tooltip text={dataset.lastUpdated ? 'Хамгийн сүүлд нэмэгдсэн бичлэгийн огноо. Засвар хийсэн огноог тооцохгүй.' : 'Энэ багцад бичлэг алга'}>
                    <p className="text-xs text-slate-400 dark:text-slate-500 text-right cursor-help">
                      {dataset.lastUpdated ? `Сүүлд: ${dataset.lastUpdated}` : 'Өгөгдөлгүй'}
                    </p>
                  </Tooltip>
                </div>

                <div className="flex gap-2 mt-auto">
                  <button
                    type="button"
                    onClick={() => openPreview(dataset.key)}
                    disabled={isEmpty}
                    className="flex-1 flex items-center justify-center gap-2 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold px-3 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 transition-all text-sm cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Eye size={16} /> Харах
                  </button>
                  {isEmpty ? (
                    <span className="flex-1 flex items-center justify-center gap-2 bg-red-600 text-white font-bold px-3 py-2.5 rounded-2xl text-sm opacity-40 cursor-not-allowed">
                      <Download size={16} /> CSV татах
                    </span>
                  ) : (
                    <a
                      href={`/api/data/${dataset.key}?format=csv`}
                      download
                      className="flex-1 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold px-3 py-2.5 rounded-2xl shadow-lg shadow-red-500/20 transition-all text-sm"
                    >
                      <Download size={16} /> CSV татах
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Preview section */}
      {previewKey && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
          <div className="flex items-center justify-between gap-4 px-5 sm:px-6 py-4 border-b border-slate-100 dark:border-slate-800">
            <div className="min-w-0">
              <h3 className="font-extrabold text-slate-900 dark:text-white truncate">{previewLabel}</h3>
              {preview && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Нийт {preview.total.toLocaleString()} мөрөөс эхний {preview.rows.length}-г харуулж байна. Бүгдийг нь CSV-ээр татна уу.
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={closePreview}
              title="Хаах"
              className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all cursor-pointer shrink-0"
            >
              <X size={18} />
            </button>
          </div>

          {previewError ? (
            <p className="p-6 text-sm font-bold text-center text-rose-600 dark:text-rose-400">{previewError}</p>
          ) : !preview ? (
            <div className="py-10">
              <Loading fullScreen={false} />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 text-slate-400 text-xs font-bold uppercase tracking-wider">
                    {preview.columns.map((column) => (
                      <th key={column} className="py-3 px-4 whitespace-nowrap">{column}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                  {preview.rows.map((row, rowIndex) => (
                    <tr key={rowIndex} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/60 transition-colors">
                      {row.map((cell, cellIndex) => (
                        <td
                          key={cellIndex}
                          className="py-3 px-4 text-slate-600 dark:text-slate-300 whitespace-nowrap max-w-xs truncate"
                          title={cell}
                        >
                          {cell || <span className="text-slate-300 dark:text-slate-600">—</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
