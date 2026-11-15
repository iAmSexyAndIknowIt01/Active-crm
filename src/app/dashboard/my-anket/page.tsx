/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import QRCode from 'qrcode';
import {
  Plus,
  Sparkles,
  FileText,
  Pencil,
  QrCode,
  Copy,
  Check,
  Star,
  Trash2,
  ExternalLink,
  UserPlus,
  Loader2,
  X,
  AlertTriangle,
} from 'lucide-react';
import LoadingComponent from '@/src/app/components/loading';
import { anketFormUrl } from './form-url';

interface TemplateRow {
  id: string;
  title: string;
  description: string | null;
  is_active: boolean;
  is_default: boolean;
  question_count: number;
  submission_count: number;
  last_submitted_at: string | null;
  created_at: string;
  updated_at: string | null;
}

interface SyncResult {
  processed: number;
  linked: number;
  created: number;
  skipped: number;
}

function formatDate(value: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-CA'); // YYYY-MM-DD
}

// Компанийн бүх QR анкетын жагсаалт. Анкет нэмэх, засах, идэвхжүүлэх, үндсэн болгох, устгах.
export default function MyAnketListPage() {
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [companyId, setCompanyId] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [qrTemplate, setQrTemplate] = useState<TemplateRow | null>(null);
  const [qrImage, setQrImage] = useState('');
  const [deleteTemplate, setDeleteTemplate] = useState<TemplateRow | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);

  const loadTemplates = useCallback(async () => {
    try {
      const res = await fetch('/api/templates');
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Анкетуудыг ачаалахад алдаа гарлаа.');
      setTemplates(json.data.templates);
      setCompanyId(json.data.companyId);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Сүлжээний алдаа гарлаа.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setBaseUrl(window.location.origin);
    loadTemplates();
  }, [loadTemplates]);

  const urlFor = (t: TemplateRow) => (companyId && baseUrl ? anketFormUrl(baseUrl, companyId, t.id, t.is_default) : '');

  // QR модалын зургийг браузер дотор үүсгэнэ
  useEffect(() => {
    if (!qrTemplate) {
      setQrImage('');
      return;
    }
    let cancelled = false;
    QRCode.toDataURL(anketFormUrl(baseUrl, companyId, qrTemplate.id, qrTemplate.is_default), { width: 480, margin: 1 })
      .then((url) => !cancelled && setQrImage(url))
      .catch((err) => console.error('QR code generation failed:', err));
    return () => {
      cancelled = true;
    };
  }, [qrTemplate, baseUrl, companyId]);

  const handleCopy = (t: TemplateRow) => {
    navigator.clipboard.writeText(urlFor(t));
    setCopiedId(t.id);
    setTimeout(() => setCopiedId((current) => (current === t.id ? null : current)), 2000);
  };

  const updateTemplate = async (t: TemplateRow, body: Record<string, unknown>) => {
    setBusyId(t.id);
    setErrorMessage('');
    try {
      const res = await fetch(`/api/templates/${t.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Хадгалахад алдаа гарлаа.');
      await loadTemplates();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Сүлжээний алдаа гарлаа.');
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTemplate) return;
    const t = deleteTemplate;
    setDeleteTemplate(null);
    setBusyId(t.id);
    setErrorMessage('');
    try {
      const res = await fetch(`/api/templates/${t.id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Устгахад алдаа гарлаа.');
      await loadTemplates();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Сүлжээний алдаа гарлаа.');
    } finally {
      setBusyId(null);
    }
  };

  // Харилцагчтай холбогдоогүй өмнөх анкетуудыг утас/имэйлээр нь харилцагч болгох
  const handleSyncCustomers = async () => {
    setSyncing(true);
    setSyncResult(null);
    setErrorMessage('');
    const total: SyncResult = { processed: 0, linked: 0, created: 0, skipped: 0 };
    try {
      let cursor: string | null = null;
      do {
        const res: Response = await fetch('/api/templates/sync-customers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cursor }),
        });
        const json: { success: boolean; error?: string; data: SyncResult & { nextCursor: string | null } } = await res.json();
        if (!res.ok || !json.success) throw new Error(json.error || 'Харилцагч болгоход алдаа гарлаа.');
        total.processed += json.data.processed;
        total.linked += json.data.linked;
        total.created += json.data.created;
        total.skipped += json.data.skipped;
        cursor = json.data.nextCursor;
      } while (cursor);
      setSyncResult(total);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Сүлжээний алдаа гарлаа.');
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return <LoadingComponent text="Анкетуудыг ачаалж байна..." />;
  }

  const iconButton =
    'p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-red-600 dark:hover:text-red-400 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed';

  return (
    <div className="max-w-6xl mx-auto space-y-6 sm:space-y-8 pb-20 font-sans antialiased text-slate-800 dark:text-slate-100">
      {/* Header: баруун дээд буланд "Анкет нэмэх" */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-2xs">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 text-xs font-bold tracking-wide uppercase border border-red-100 dark:border-red-900">
            <Sparkles size={12} /> Анкет
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">Үйлчлүүлэгчийн анкетууд</h1>
          <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm">
            Үүсгэсэн анкетууд, тэдгээрийн QR код, ирсэн хариултын тоо. Үндсэн анкет нь анкетын ID-гүй холбоосоор нээгдэнэ.
          </p>
        </div>

        <Link
          href="/dashboard/my-anket/new"
          className="self-start sm:self-auto inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-5 py-3 rounded-2xl font-bold text-sm transition-all shadow-md shadow-red-500/20 shrink-0"
        >
          <Plus size={18} /> Анкет нэмэх
        </Link>
      </div>

      {errorMessage && (
        <div className="bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 px-5 py-4 rounded-2xl flex items-center gap-3 text-xs sm:text-sm font-bold animate-in fade-in slide-in-from-top-2">
          <span className="text-rose-600 dark:text-rose-400 font-bold">Алдаа:</span> {errorMessage}
        </div>
      )}

      {templates.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 p-10 sm:p-14 rounded-3xl border border-dashed border-slate-300 dark:border-slate-700 text-center space-y-4">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 flex items-center justify-center">
            <FileText size={26} />
          </div>
          <div className="space-y-1">
            <p className="font-black text-slate-900 dark:text-white">Анкет үүсгээгүй байна</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Анкет үүсгээд QR кодыг нь байршуулбал үйлчлүүлэгчид утсаараа бөглөж, харилцагчийн бүртгэлд автоматаар нэмэгдэнэ.
            </p>
          </div>
          <Link
            href="/dashboard/my-anket/new"
            className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-5 py-3 rounded-2xl font-bold text-sm transition-all"
          >
            <Plus size={18} /> Анкет нэмэх
          </Link>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-slate-800">
                  <th className="px-5 sm:px-6 py-4 font-extrabold">Анкет</th>
                  <th className="px-4 py-4 font-extrabold text-center">Асуулт</th>
                  <th className="px-4 py-4 font-extrabold text-center">Хариулт</th>
                  <th className="px-4 py-4 font-extrabold">Төлөв</th>
                  <th className="px-4 py-4 font-extrabold">Шинэчилсэн</th>
                  <th className="px-5 sm:px-6 py-4 font-extrabold text-right">Үйлдэл</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {templates.map((t) => {
                  const busy = busyId === t.id;
                  return (
                    <tr key={t.id} className={`hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors ${busy ? 'opacity-60' : ''}`}>
                      <td className="px-5 sm:px-6 py-4 min-w-60">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Link
                            href={`/dashboard/my-anket/${t.id}`}
                            className="font-bold text-slate-900 dark:text-white hover:text-red-600 dark:hover:text-red-400 transition-colors"
                          >
                            {t.title}
                          </Link>
                          {t.is_default && (
                            <span
                              title="Анкетын ID-гүй холбоос, өмнө хэвлэсэн QR код энэ анкетыг нээнэ"
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 text-[11px] font-bold"
                            >
                              <Star size={11} /> Үндсэн
                            </span>
                          )}
                        </div>
                        {t.description && (
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-1 max-w-md">{t.description}</p>
                        )}
                      </td>
                      <td className="px-4 py-4 text-center font-bold tabular-nums">{t.question_count}</td>
                      <td className="px-4 py-4 text-center">
                        <p className="font-bold tabular-nums">{t.submission_count}</p>
                        {t.last_submitted_at && (
                          <p className="text-[11px] text-slate-400 dark:text-slate-500 whitespace-nowrap">сүүлд {formatDate(t.last_submitted_at)}</p>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <button
                          type="button"
                          role="switch"
                          aria-checked={t.is_active}
                          disabled={busy}
                          onClick={() => updateTemplate(t, { is_active: !t.is_active })}
                          title={t.is_active ? 'Хариулт хүлээн авч байна. Дарж идэвхгүй болгоно.' : 'Хариулт хүлээн авахгүй. Дарж идэвхжүүлнэ.'}
                          className="inline-flex items-center gap-2 cursor-pointer disabled:cursor-wait"
                        >
                          <span
                            className={`relative w-9 h-5 rounded-full transition-colors ${
                              t.is_active ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'
                            }`}
                          >
                            <span
                              className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                                t.is_active ? 'translate-x-4' : ''
                              }`}
                            />
                          </span>
                          <span
                            className={`text-xs font-bold whitespace-nowrap ${
                              t.is_active ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'
                            }`}
                          >
                            {t.is_active ? 'Идэвхтэй' : 'Идэвхгүй'}
                          </span>
                        </button>
                      </td>
                      <td className="px-4 py-4 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {formatDate(t.updated_at ?? t.created_at)}
                      </td>
                      <td className="px-5 sm:px-6 py-4">
                        <div className="flex items-center justify-end gap-0.5">
                          <Link href={`/dashboard/my-anket/${t.id}`} title="Засах" className={iconButton}>
                            <Pencil size={16} />
                          </Link>
                          <button type="button" title="QR код" onClick={() => setQrTemplate(t)} className={iconButton}>
                            <QrCode size={16} />
                          </button>
                          <button type="button" title="Холбоос хуулах" onClick={() => handleCopy(t)} className={iconButton}>
                            {copiedId === t.id ? <Check size={16} className="text-emerald-600" /> : <Copy size={16} />}
                          </button>
                          {!t.is_default && (
                            <button
                              type="button"
                              title="Үндсэн анкет болгох"
                              disabled={busy}
                              onClick={() => updateTemplate(t, { is_default: true })}
                              className={iconButton}
                            >
                              <Star size={16} />
                            </button>
                          )}
                          <button
                            type="button"
                            title="Устгах"
                            disabled={busy}
                            onClick={() => setDeleteTemplate(t)}
                            className={`${iconButton} hover:text-rose-600! dark:hover:text-rose-400! hover:bg-rose-50! dark:hover:bg-rose-950/40!`}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Өмнөх анкетуудыг харилцагч болгох */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-bold text-sm text-slate-900 dark:text-white">Хуучин анкетууд</h2>
          <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">
            Өмнө ирсэн, харилцагчтай холбогдоогүй анкетуудыг утас эсвэл имэйлээр нь харилцагч болгоно.
          </p>
          {syncResult && (
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 leading-relaxed mt-2">
              {syncResult.processed === 0
                ? 'Холбох шаардлагатай анкет алга.'
                : `${syncResult.linked} анкет холбогдлоо (${syncResult.created} шинэ харилцагч).` +
                  (syncResult.skipped > 0 ? ` ${syncResult.skipped} анкетад нэр, утас эсвэл имэйл дутуу тул алгаслаа.` : '')}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={handleSyncCustomers}
          disabled={syncing}
          className="shrink-0 flex items-center justify-center gap-2 text-xs font-bold bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-900 hover:bg-red-100 dark:hover:bg-red-900 px-4 py-2.5 rounded-xl transition-all cursor-pointer disabled:opacity-60"
        >
          {syncing ? <Loader2 size={15} className="animate-spin" /> : <UserPlus size={15} />}
          Хуучин анкетуудыг харилцагч болгох
        </button>
      </div>

      {/* QR кодын модал */}
      {qrTemplate && (
        <div
          className="fixed inset-0 bg-slate-900/40 dark:bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setQrTemplate(null);
          }}
        >
          <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-3xl p-6 shadow-2xl border border-slate-100 dark:border-slate-800 space-y-5 relative animate-in fade-in zoom-in-95 slide-in-from-bottom-4 duration-300">
            <button
              type="button"
              onClick={() => setQrTemplate(null)}
              aria-label="Хаах"
              className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
            >
              <X size={18} />
            </button>
            <div className="pr-8">
              <h3 className="font-black text-slate-900 dark:text-white">{qrTemplate.title}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Камераар уншуулж бөглөнө</p>
            </div>
            <div className="bg-white p-3 rounded-2xl border border-slate-200 dark:border-slate-700 w-60 h-60 mx-auto flex items-center justify-center">
              {qrImage && <Image src={qrImage} alt="Анкетын QR код" width={240} height={240} className="w-full h-full object-contain" unoptimized />}
            </div>
            {!qrTemplate.is_active && (
              <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 text-center">
                Анкет идэвхгүй тул одоогоор хариулт хүлээн авахгүй.
              </p>
            )}
            <div className="grid grid-cols-3 gap-2">
              <a
                href={qrImage || undefined}
                download={`anket-qr-${qrTemplate.id.slice(0, 8)}.png`}
                className="col-span-1 flex items-center justify-center text-xs font-bold bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-xl transition-all"
              >
                Татах
              </a>
              <button
                type="button"
                onClick={() => handleCopy(qrTemplate)}
                className="flex items-center justify-center gap-1.5 text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 py-2.5 rounded-xl transition-all cursor-pointer"
              >
                {copiedId === qrTemplate.id ? <Check size={14} /> : <Copy size={14} />} Хуулах
              </button>
              <a
                href={urlFor(qrTemplate)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 py-2.5 rounded-xl transition-all"
              >
                <ExternalLink size={14} /> Нээх
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Устгах баталгаажуулалт */}
      {deleteTemplate && (
        <div
          className="fixed inset-0 bg-slate-900/40 dark:bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setDeleteTemplate(null);
          }}
        >
          <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-3xl p-6 shadow-2xl border border-slate-100 dark:border-slate-800 space-y-4 text-center animate-in fade-in zoom-in-95 slide-in-from-bottom-4 duration-300">
            <div className="w-12 h-12 rounded-2xl mx-auto flex items-center justify-center bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400">
              <AlertTriangle size={24} />
            </div>
            <div className="space-y-1">
              <h3 className="font-black text-slate-900 dark:text-white">“{deleteTemplate.title}” анкетыг устгах уу?</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Анкетын холбоос, QR код ажиллахаа болино. Ирсэн {deleteTemplate.submission_count} хариулт харилцагч, өгөгдлийн
                хэсэгт хадгалагдсаар үлдэнэ.
                {deleteTemplate.is_default && ' Энэ нь үндсэн анкет тул өөр анкет үндсэн болно.'}
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTemplate(null)}
                className="flex-1 py-3 rounded-2xl text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all cursor-pointer"
              >
                Болих
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="flex-1 py-3 rounded-2xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 transition-all cursor-pointer"
              >
                Устгах
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
