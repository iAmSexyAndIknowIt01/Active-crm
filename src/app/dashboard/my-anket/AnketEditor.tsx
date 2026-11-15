/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import QRCode from 'qrcode';
import {
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  CheckCircle2,
  Copy,
  CopyPlus,
  ExternalLink,
  Eye,
  Loader2,
  Pencil,
  Plus,
  QrCode,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import LoadingComponent from '@/src/app/components/loading';
import AnketForm, { type AnketAnswers } from '@/src/components/anket/AnketForm';
import {
  DEFAULT_TEMPLATE,
  QUESTION_TYPES,
  QUESTION_TYPE_INFO,
  hasOptions,
  looksLikeRating,
  parseTemplateInput,
  type QuestionType,
  type TemplateQuestion,
} from '@/src/lib/form-templates';
import { anketFormUrl } from './form-url';

const newId = () => `${Date.now()}${Math.floor(Math.random() * 1000)}`;
const snapshot = (title: string, description: string, questions: TemplateQuestion[]) => JSON.stringify({ title, description, questions });

// Анкет үүсгэх (templateId-гүй) болон засах (templateId-тэй) хуудасны засварлагч
export default function AnketEditor({ templateId, justCreated = false }: { templateId?: string; justCreated?: boolean }) {
  const router = useRouter();
  const isNew = !templateId;

  const [formTitle, setFormTitle] = useState(DEFAULT_TEMPLATE.title);
  const [formDescription, setFormDescription] = useState(DEFAULT_TEMPLATE.description ?? '');
  const [questions, setQuestions] = useState<TemplateQuestion[]>(DEFAULT_TEMPLATE.questions);
  const [saved, setSaved] = useState(() => snapshot(DEFAULT_TEMPLATE.title, DEFAULT_TEMPLATE.description ?? '', DEFAULT_TEMPLATE.questions));
  const [focusId, setFocusId] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [tab, setTab] = useState<'editor' | 'preview'>('editor');
  const [previewAnswers, setPreviewAnswers] = useState<AnketAnswers>({});
  const [loading, setLoading] = useState(!isNew);
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState(justCreated ? 'Анкет үүслээ. Баруун талын QR код, холбоосоор хуваалцана уу.' : '');
  const [errorMessage, setErrorMessage] = useState('');
  const [copied, setCopied] = useState(false);
  const [baseUrl, setBaseUrl] = useState('');

  const dirty = snapshot(formTitle, formDescription, questions) !== saved;

  useEffect(() => {
    setBaseUrl(window.location.origin);
    if (!templateId) return;

    async function fetchTemplate() {
      try {
        const res = await fetch(`/api/templates/${templateId}`);
        const json = await res.json();
        if (!res.ok || !json.success) {
          if (res.status === 404) setNotFound(true);
          else setErrorMessage(json.error || 'Анкетыг ачаалахад алдаа гарлаа.');
          return;
        }
        const title = json.data.title || '';
        const description = json.data.description || '';
        // Хуучин анкетад хадгалагдсан харилцагчийн талбарын холболтыг (maps_to) хаяна — хадгалахад арилна
        const loaded: TemplateQuestion[] = (Array.isArray(json.data.questions) ? json.data.questions : []).map(
          (q: TemplateQuestion & { maps_to?: unknown }) => ({
            id: String(q.id),
            label: q.label ?? '',
            type: (QUESTION_TYPES as readonly string[]).includes(q.type) ? q.type : 'text',
            required: q.required === true,
            ...(Array.isArray(q.options) ? { options: q.options } : {}),
          })
        );
        setFormTitle(title);
        setFormDescription(description);
        setQuestions(loaded);
        setSaved(snapshot(title, description, loaded));
        setCompanyId(json.data.company_id || '');
        setIsActive(!!json.data.is_active);
      } catch (err) {
        console.error('Failed to load template:', err);
        setErrorMessage('Сүлжээний алдаа гарлаа.');
      } finally {
        setLoading(false);
      }
    }
    fetchTemplate();
  }, [templateId]);

  // Хадгалаагүй өөрчлөлттэй хуудсыг хаах үед анхааруулна
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const updateQuestion = (id: string, patch: Partial<TemplateQuestion>) =>
    setQuestions((qs) => qs.map((q) => (q.id === id ? { ...q, ...patch } : q)));

  const addQuestion = () => {
    const id = newId();
    setQuestions((qs) => [...qs, { id, label: '', type: 'text', required: false }]);
    setFocusId(id);
  };

  const duplicateQuestion = (index: number) => {
    const id = newId();
    setQuestions((qs) => [...qs.slice(0, index + 1), { ...qs[index], id }, ...qs.slice(index + 1)]);
    setFocusId(id);
  };

  const moveQuestion = (index: number, direction: -1 | 1) =>
    setQuestions((qs) => {
      const target = index + direction;
      if (target < 0 || target >= qs.length) return qs;
      const next = [...qs];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

  const removeQuestion = (id: string) => setQuestions((qs) => qs.filter((q) => q.id !== id));

  // Шинэ анкет бол үүсгээд засах хуудас руу шилжинэ, байгаа анкетыг байранд нь хадгална
  const handleSave = async () => {
    setSavedMessage('');
    setErrorMessage('');

    // Сервертэй ижил дүрмээр урьдчилж шалгана (хоосон асуулт, сонголтгүй асуулт г.м.)
    const parsed = parseTemplateInput({ title: formTitle, description: formDescription, questions });
    if (!parsed.ok) {
      setErrorMessage(parsed.error);
      setTab('editor');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(isNew ? '/api/templates' : `/api/templates/${templateId}`, {
        method: isNew ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: formTitle, description: formDescription, questions }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Хадгалахад алдаа гарлаа.');

      setSaved(snapshot(formTitle, formDescription, questions));
      if (isNew) {
        router.replace(`/dashboard/my-anket/${data.data.id}?created=1`);
        return;
      }
      setSavedMessage('Өөрчлөлт хадгалагдлаа.');
      setTimeout(() => setSavedMessage(''), 3000);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Сүлжээний алдаа гарлаа.');
    } finally {
      setSaving(false);
    }
  };

  const clientFormUrl = companyId && templateId && baseUrl ? anketFormUrl(baseUrl, companyId, templateId) : '';

  // QR кодыг браузер дотор үүсгэнэ (анкетын холбоосыг гуравдагч сервис рүү илгээхгүй)
  const [qrCodeImageUrl, setQrCodeImageUrl] = useState('');
  useEffect(() => {
    if (!clientFormUrl) return;
    let cancelled = false;
    QRCode.toDataURL(clientFormUrl, { width: 352, margin: 1 })
      .then((url) => !cancelled && setQrCodeImageUrl(url))
      .catch((err) => console.error('QR code generation failed:', err));
    return () => {
      cancelled = true;
    };
  }, [clientFormUrl]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(clientFormUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) return <LoadingComponent text="Анкетыг ачаалж байна..." />;

  if (notFound) {
    return (
      <div className="max-w-xl mx-auto bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-100 dark:border-slate-800 text-center space-y-4">
        <p className="font-bold text-slate-900 dark:text-white">Анкет олдсонгүй.</p>
        <p className="text-sm text-slate-500 dark:text-slate-400">Устгагдсан эсвэл буруу холбоос байж магадгүй.</p>
        <Link href="/dashboard/my-anket" className="inline-flex items-center gap-2 text-sm font-bold text-red-600 dark:text-red-400">
          <ArrowLeft size={16} /> Анкетуудын жагсаалт руу буцах
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-5 pb-24 text-slate-800 dark:text-slate-100">
      {/* Толгой */}
      <div className="bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1.5 min-w-0">
          <Link
            href="/dashboard/my-anket"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
          >
            <ArrowLeft size={14} /> Анкетууд
          </Link>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white truncate">
            {isNew ? 'Шинэ анкет' : formTitle || 'Нэргүй анкет'}
          </h1>
          <div className="flex items-center gap-2 flex-wrap text-xs font-bold">
            <span className="text-slate-500 dark:text-slate-400 font-semibold">{questions.length} асуулт</span>
            {!isNew && (
              <span
                className={`px-2 py-0.5 rounded-full ${
                  isActive ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                }`}
              >
                {isActive ? 'Хариулт хүлээн авч байна' : 'Идэвхгүй'}
              </span>
            )}
            {dirty && <span className="px-2 py-0.5 rounded-full bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300">Хадгалаагүй өөрчлөлттэй</span>}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl flex items-center gap-1">
            {(
              [
                ['editor', 'Засах', Pencil],
                ['preview', 'Урьдчилан харах', Eye],
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
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || (!isNew && !dirty)}
            className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-5 py-2.5 rounded-2xl font-bold text-sm transition-colors shadow-md shadow-red-500/20 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {isNew ? 'Анкет үүсгэх' : dirty ? 'Хадгалах' : 'Хадгалагдсан'}
          </button>
        </div>
      </div>

      {savedMessage && (
        <div className="bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 px-5 py-3.5 rounded-2xl flex items-center gap-3 text-sm font-bold animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 size={18} className="shrink-0" /> {savedMessage}
        </div>
      )}
      {errorMessage && (
        <div className="bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 px-5 py-3.5 rounded-2xl flex items-center gap-3 text-sm font-bold animate-in fade-in slide-in-from-top-2">
          <AlertTriangle size={18} className="shrink-0" /> {errorMessage}
        </div>
      )}

      {tab === 'preview' ? (
        <div className="max-w-2xl mx-auto bg-slate-100 rounded-3xl p-4 sm:p-6">
          <AnketForm
            preview
            title={formTitle}
            description={formDescription}
            questions={questions}
            answers={previewAnswers}
            errors={{}}
            onAnswer={(id, value) => setPreviewAnswers((a) => ({ ...a, [id]: value }))}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-4">
            {/* Ерөнхий мэдээлэл */}
            <section className="bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-2xs space-y-4">
              <Field label="Анкетын гарчиг" hint="Үйлчлүүлэгчид хамгийн дээр харагдана.">
                <input
                  type="text"
                  value={formTitle}
                  maxLength={200}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="Жнь: Үйлчлүүлэгчийн бүртгэл"
                  className={`${inputClass} text-base font-bold`}
                />
              </Field>
              <Field label="Тайлбар" hint="Заавал биш. Анкет юунд зориулагдсаныг товч бичнэ.">
                <textarea
                  rows={2}
                  value={formDescription}
                  maxLength={2000}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className={`${inputClass} resize-y`}
                />
              </Field>
            </section>

            {/* Асуултууд */}
            {questions.map((q, index) => (
              <QuestionEditor
                key={q.id}
                question={q}
                index={index}
                count={questions.length}
                autoFocus={focusId === q.id}
                onChange={(patch) => updateQuestion(q.id, patch)}
                onMove={(dir) => moveQuestion(index, dir)}
                onDuplicate={() => duplicateQuestion(index)}
                onRemove={() => removeQuestion(q.id)}
              />
            ))}

            <button
              type="button"
              onClick={addQuestion}
              className="w-full flex items-center justify-center gap-2 py-4 rounded-3xl border-2 border-dashed border-slate-300 dark:border-slate-700 text-sm font-bold text-slate-600 dark:text-slate-300 hover:border-red-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50/50 dark:hover:bg-red-950/20 transition-colors cursor-pointer"
            >
              <Plus size={18} /> Асуулт нэмэх
            </button>
          </div>

          {/* Баруун багана: хуваалцах, харилцагчийн бүртгэл */}
          <aside className="space-y-4 lg:sticky lg:top-24 self-start">
            <section className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-2xs space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-sm text-slate-900 dark:text-white">Хуваалцах</h2>
                {clientFormUrl && (
                  <a
                    href={clientFormUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-bold text-red-600 dark:text-red-400 hover:underline"
                  >
                    Нээх <ExternalLink size={13} />
                  </a>
                )}
              </div>
              {isNew ? (
                <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-5 flex flex-col items-center gap-2 text-center">
                  <QrCode size={36} className="text-slate-300 dark:text-slate-600" />
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">Анкетыг үүсгэсний дараа QR код, холбоос энд гарна.</p>
                </div>
              ) : (
                <>
                  <div className="w-40 h-40 mx-auto bg-white p-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center justify-center">
                    {qrCodeImageUrl && (
                      <Image src={qrCodeImageUrl} alt="Анкетын QR код" width={160} height={160} className="w-full h-full object-contain" unoptimized />
                    )}
                  </div>
                  <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 pl-3 pr-1.5 py-1.5 rounded-xl">
                    <input readOnly value={clientFormUrl} className="w-full bg-transparent text-xs font-semibold text-slate-600 dark:text-slate-300 focus:outline-none truncate" />
                    <button
                      type="button"
                      onClick={handleCopyLink}
                      className="shrink-0 inline-flex items-center gap-1 bg-red-600 hover:bg-red-700 text-white px-2.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer"
                    >
                      <Copy size={13} /> {copied ? 'Хуулсан' : 'Хуулах'}
                    </button>
                  </div>
                  {!isActive && (
                    <p className="text-xs font-semibold text-amber-600 dark:text-amber-400">Идэвхгүй тул хариулт хүлээн авахгүй. Жагсаалтаас идэвхжүүлнэ.</p>
                  )}
                </>
              )}
            </section>

          </aside>
        </div>
      )}
    </div>
  );
}

const inputClass =
  'w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-red-600 focus:bg-white dark:focus:bg-slate-900 focus:ring-4 focus:ring-red-500/10 transition-colors';

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="block text-xs font-bold text-slate-600 dark:text-slate-300">{label}</span>
      {children}
      {hint && <span className="block text-xs text-slate-400">{hint}</span>}
    </label>
  );
}

function QuestionEditor({
  question: q,
  index,
  count,
  autoFocus,
  onChange,
  onMove,
  onDuplicate,
  onRemove,
}: {
  question: TemplateQuestion;
  index: number;
  count: number;
  autoFocus: boolean;
  onChange: (patch: Partial<TemplateQuestion>) => void;
  onMove: (direction: -1 | 1) => void;
  onDuplicate: () => void;
  onRemove: () => void;
}) {
  const labelRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (autoFocus) {
      labelRef.current?.focus();
      labelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [autoFocus]);

  const changeType = (type: QuestionType) => {
    const patch: Partial<TemplateQuestion> = { type };
    if (hasOptions(type) && !(q.options && q.options.length)) patch.options = ['Сонголт 1', 'Сонголт 2'];
    onChange(patch);
  };

  const iconButton =
    'p-2 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed';

  return (
    <section className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-2xs p-4 sm:p-5 space-y-4">
      {/* Утсанд товчууд дараагийн мөрөнд шилжиж, асуултын текст бүтэн өргөнөө авна */}
      <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
        <span className="mt-1 w-8 h-8 shrink-0 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center text-xs font-black">
          {index + 1}
        </span>
        <input
          ref={labelRef}
          type="text"
          value={q.label}
          maxLength={300}
          onChange={(e) => onChange({ label: e.target.value })}
          placeholder="Асуултаа бичнэ үү"
          aria-label={`${index + 1}-р асуулт`}
          className={`${inputClass} flex-1 basis-48 min-w-0 text-base font-semibold ${!q.label.trim() ? 'border-rose-300 dark:border-rose-800' : ''}`}
        />
        <div className="flex items-center shrink-0 ml-auto">
          <button type="button" title="Дээш зөөх" onClick={() => onMove(-1)} disabled={index === 0} className={iconButton}>
            <ArrowUp size={16} />
          </button>
          <button type="button" title="Доош зөөх" onClick={() => onMove(1)} disabled={index === count - 1} className={iconButton}>
            <ArrowDown size={16} />
          </button>
          <button type="button" title="Хуулбарлах" onClick={onDuplicate} className={iconButton}>
            <CopyPlus size={16} />
          </button>
          <button
            type="button"
            title={count <= 1 ? 'Анкетад дор хаяж нэг асуулт байна' : 'Устгах'}
            onClick={onRemove}
            disabled={count <= 1}
            className={`${iconButton} hover:text-rose-600! dark:hover:text-rose-400! hover:bg-rose-50! dark:hover:bg-rose-950/40!`}
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      <div className="sm:pl-11 grid sm:grid-cols-[1fr_auto] gap-3 items-end">
        <Field label="Хариултын төрөл">
          <select value={q.type} onChange={(e) => changeType(e.target.value as QuestionType)} className={`${inputClass} cursor-pointer`}>
            {QUESTION_TYPES.map((t) => (
              <option key={t} value={t}>
                {QUESTION_TYPE_INFO[t].label} — {QUESTION_TYPE_INFO[t].hint}
              </option>
            ))}
          </select>
        </Field>
        <button
          type="button"
          role="switch"
          aria-checked={q.required}
          onClick={() => onChange({ required: !q.required })}
          className="inline-flex items-center gap-2 h-[42px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer"
        >
          <span className={`relative w-9 h-5 rounded-full transition-colors ${q.required ? 'bg-red-600' : 'bg-slate-300 dark:bg-slate-700'}`}>
            <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${q.required ? 'translate-x-4' : ''}`} />
          </span>
          <span className="text-xs font-bold text-slate-700 dark:text-slate-200">Заавал</span>
        </button>
      </div>

      {hasOptions(q.type) && (
        <div className="sm:pl-11 space-y-3">
          <OptionsEditor type={q.type} options={q.options ?? []} onChange={(options) => onChange({ options })} />
          {q.type === 'select' && looksLikeRating(q.options) && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs bg-sky-50 dark:bg-sky-950/40 text-sky-800 dark:text-sky-200 rounded-xl px-3 py-2.5">
              <span>Сонголтууд оноо шиг байна. «Үнэлгээ» төрөл болговол нэг мөрөнд 1, 2, 3... гэж харагдана.</span>
              <button
                type="button"
                onClick={() => onChange({ type: 'rating' })}
                className="shrink-0 font-bold text-sky-700 dark:text-sky-300 hover:underline cursor-pointer"
              >
                Үнэлгээ болгох
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

// Сонголт бүр тусдаа мөр: Enter — дараагийн сонголт, хоосон мөрөнд Backspace — устгах,
// олон мөр paste хийвэл мөр бүр тусдаа сонголт болно. Сонголтын текстэд таслал байж болно.
function OptionsEditor({ type, options, onChange }: { type: QuestionType; options: string[]; onChange: (options: string[]) => void }) {
  const multi = type === 'multiselect';
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const [focusIndex, setFocusIndex] = useState<number | null>(null);
  useEffect(() => {
    if (focusIndex !== null) {
      refs.current[focusIndex]?.focus();
      setFocusIndex(null);
    }
  }, [focusIndex, options.length]);

  const set = (i: number, value: string) => onChange(options.map((o, j) => (j === i ? value : o)));
  const insertAfter = (i: number, values: string[] = ['']) => {
    onChange([...options.slice(0, i + 1), ...values, ...options.slice(i + 1)]);
    setFocusIndex(i + values.length);
  };
  const remove = (i: number) => {
    onChange(options.filter((_, j) => j !== i));
    setFocusIndex(Math.max(0, i - 1));
  };

  return (
    <div className="space-y-2">
      <span className="block text-xs font-bold text-slate-600 dark:text-slate-300">
        Сонголтууд{' '}
        <span className="font-normal text-slate-400">
          ·{' '}
          {type === 'rating'
            ? 'нэг мөрөнд оноо мэт харагдана; «1 - Маш муу» гэж бичвэл товчин дээр 1, тайлбар нь доор гарна'
            : multi
              ? 'хэд хэдийг сонгож болно'
              : 'нэгийг сонгоно'}
        </span>
      </span>
      {options.map((o, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className={`shrink-0 w-4 h-4 border-2 border-slate-300 dark:border-slate-600 ${multi ? 'rounded' : 'rounded-full'}`} />
          <input
            ref={(el) => {
              refs.current[i] = el;
            }}
            value={o}
            maxLength={200}
            onChange={(e) => set(i, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                insertAfter(i);
              } else if (e.key === 'Backspace' && !o && options.length > 1) {
                e.preventDefault();
                remove(i);
              }
            }}
            onPaste={(e) => {
              const lines = e.clipboardData.getData('text').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
              if (lines.length > 1) {
                e.preventDefault();
                const next = [...options];
                next[i] = o ? o : lines[0];
                onChange([...next.slice(0, i + 1), ...(o ? lines : lines.slice(1)), ...next.slice(i + 1)]);
              }
            }}
            placeholder={`Сонголт ${i + 1}`}
            className={`${inputClass} ${!o.trim() ? 'border-rose-300 dark:border-rose-800' : ''}`}
          />
          <button
            type="button"
            title="Сонголт устгах"
            onClick={() => remove(i)}
            disabled={options.length <= 1}
            className="shrink-0 p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <X size={15} />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => insertAfter(options.length - 1)}
        className="inline-flex items-center gap-1.5 text-xs font-bold text-red-600 dark:text-red-400 hover:underline cursor-pointer pl-6"
      >
        <Plus size={14} /> Сонголт нэмэх
      </button>
    </div>
  );
}
