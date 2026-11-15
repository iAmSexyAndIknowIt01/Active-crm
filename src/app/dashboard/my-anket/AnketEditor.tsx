/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import QRCode from 'qrcode';
import { Save, Plus, Trash2, CheckCircle2, Copy, Eye, Settings2, Sparkles, ExternalLink, ArrowLeft, QrCode, Star } from 'lucide-react';
import LoadingComponent from '@/src/app/components/loading';
import { CUSTOMER_FIELD_OPTIONS, inferCustomerField } from '@/src/lib/form-customer';
import { DEFAULT_TEMPLATE, type TemplateQuestion } from '@/src/lib/form-templates';
import { anketFormUrl } from './form-url';

// Анкет үүсгэх (templateId-гүй) болон засах (templateId-тэй) хуудасны засварлагч
export default function AnketEditor({ templateId, justCreated = false }: { templateId?: string; justCreated?: boolean }) {
  const router = useRouter();
  const isNew = !templateId;

  const [formTitle, setFormTitle] = useState(DEFAULT_TEMPLATE.title);
  const [formDescription, setFormDescription] = useState(DEFAULT_TEMPLATE.description ?? '');
  const [questions, setQuestions] = useState<TemplateQuestion[]>(DEFAULT_TEMPLATE.questions);

  const [companyId, setCompanyId] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [activeTab, setActiveTab] = useState<'editor' | 'preview'>('editor');
  const [loading, setLoading] = useState(!isNew);
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState(justCreated ? 'Анкет амжилттай үүслээ. Доорх QR код, холбоосоор хуваалцана уу.' : '');
  const [errorMessage, setErrorMessage] = useState('');
  const [copied, setCopied] = useState(false);
  const [baseUrl, setBaseUrl] = useState('');

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
        setFormTitle(json.data.title || '');
        setFormDescription(json.data.description || '');
        setCompanyId(json.data.company_id || '');
        setIsDefault(!!json.data.is_default);
        setIsActive(!!json.data.is_active);
        if (Array.isArray(json.data.questions)) {
          // Хуучин загварт maps_to байхгүй бол асуултын нэрээс таамаглаж харуулна (хадгалахад тодорхой болно)
          setQuestions(
            json.data.questions.map((q: TemplateQuestion) => ({
              ...q,
              id: String(q.id),
              maps_to: q.maps_to ?? inferCustomerField(q.label ?? '') ?? '',
            }))
          );
        }
      } catch (err) {
        console.error('Failed to load template:', err);
        setErrorMessage('Сүлжээний алдаа гарлаа.');
      } finally {
        setLoading(false);
      }
    }
    fetchTemplate();
  }, [templateId]);

  const handleAddQuestion = () => {
    setQuestions([
      ...questions,
      { id: Date.now().toString(), label: 'Шинэ асуулт', type: 'text', required: false, maps_to: '' },
    ]);
  };

  const handleDeleteQuestion = (id: string) => {
    setQuestions(questions.filter((q) => q.id !== id));
  };

  const handleQuestionChange = (id: string, field: keyof TemplateQuestion, value: unknown) => {
    setQuestions(questions.map((q) => (q.id === id ? { ...q, [field]: value } : q)));
  };

  // Шинэ анкет бол үүсгээд засах хуудас руу шилжинэ, байгаа анкетыг байранд нь хадгална
  const handleSave = async () => {
    setSaving(true);
    setSavedMessage('');
    setErrorMessage('');

    try {
      const response = await fetch(isNew ? '/api/templates' : `/api/templates/${templateId}`, {
        method: isNew ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: formTitle, description: formDescription, questions }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Хадгалахад алдаа гарлаа.');
      }

      if (isNew) {
        router.replace(`/dashboard/my-anket/${data.data.id}?created=1`);
        return;
      }
      setSavedMessage('Өөрчлөлт амжилттай хадгалагдлаа!');
      setTimeout(() => setSavedMessage(''), 3000);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Сүлжээний алдаа гарлаа.');
    } finally {
      setSaving(false);
    }
  };

  const clientFormUrl = companyId && templateId && baseUrl ? anketFormUrl(baseUrl, companyId, templateId, isDefault) : '';

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

  if (loading) {
    return <LoadingComponent text="Анкетын мэдээллийг ачаалж байна..." />;
  }

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
    <div className="max-w-6xl mx-auto space-y-6 sm:space-y-8 pb-20 font-sans antialiased text-slate-800 dark:text-slate-100 relative">
      {/* Хадгалж байх үед гарч ирэх бүтэн дэлгэцийн лоадер */}
      {saving && <LoadingComponent text="Анкетыг хадгалж байна..." />}

      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-2xs">
        <div className="space-y-2">
          <Link
            href="/dashboard/my-anket"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
          >
            <ArrowLeft size={14} /> Анкетууд
          </Link>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 text-xs font-bold tracking-wide uppercase border border-red-100 dark:border-red-900">
              <Sparkles size={12} /> {isNew ? 'Шинэ анкет' : 'Анкет засах'}
            </div>
            {!isNew && isDefault && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 text-xs font-bold">
                <Star size={12} /> Үндсэн
              </span>
            )}
            {!isNew && !isActive && (
              <span className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-xs font-bold">
                Идэвхгүй
              </span>
            )}
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
            {isNew ? 'Анкет нэмэх' : formTitle || 'Нэргүй анкет'}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm">
            Үйлчлүүлэгчдэд зориулсан асуулга болон бүртгэлийн хуудсаа тохируулах.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="bg-slate-100/80 dark:bg-slate-800 p-1.5 rounded-2xl flex items-center gap-1 border border-slate-200/60 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setActiveTab('editor')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'editor'
                  ? 'bg-white dark:bg-slate-900 text-red-600 dark:text-red-400 shadow-sm border border-slate-200/50 dark:border-slate-700'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Settings2 size={15} /> Засварлах
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('preview')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'preview'
                  ? 'bg-white dark:bg-slate-900 text-red-600 dark:text-red-400 shadow-sm border border-slate-200/50 dark:border-slate-700'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Eye size={15} /> Урьдчилан харах
            </button>
          </div>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 bg-red-600 hover:bg-red-700 active:scale-98 text-white px-6 py-3 rounded-2xl font-bold text-sm transition-all shadow-md shadow-red-500/20 cursor-pointer disabled:opacity-50"
          >
            <Save size={16} />
            {isNew ? 'Анкет үүсгэх' : 'Өөрчлөлтийг хадгалах'}
          </button>
        </div>
      </div>

      {savedMessage && (
        <div className="bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 px-5 py-4 rounded-2xl flex items-center gap-3 text-xs sm:text-sm font-bold shadow-2xs animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 size={20} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
          {savedMessage}
        </div>
      )}

      {errorMessage && (
        <div className="bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 px-5 py-4 rounded-2xl flex items-center gap-3 text-xs sm:text-sm font-bold shadow-2xs animate-in fade-in slide-in-from-top-2">
          <span className="text-rose-600 dark:text-rose-400 font-bold">Алдаа:</span> {errorMessage}
        </div>
      )}

      {activeTab === 'editor' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
          <div className="lg:col-span-2 space-y-6">
            {/* Form Details */}
            <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-2xs space-y-5">
              <h2 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white flex items-center gap-2.5 pb-4 border-b border-slate-100 dark:border-slate-800">
                <span className="w-2.5 h-2.5 rounded-full bg-red-600 dark:bg-red-500 ring-4 ring-red-50 dark:ring-red-950"></span> Ерөнхий мэдээлэл
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">Анкетын гарчиг</label>
                  <input
                    type="text"
                    value={formTitle}
                    maxLength={200}
                    onChange={(e) => setFormTitle(e.target.value)}
                    className="w-full px-4.5 py-3.5 bg-slate-50/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-slate-100 text-sm font-semibold focus:outline-none focus:border-red-600 focus:bg-white dark:focus:bg-slate-900 focus:ring-4 focus:ring-red-500/10 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">Тайлбар текст</label>
                  <textarea
                    rows={2}
                    value={formDescription}
                    maxLength={2000}
                    onChange={(e) => setFormDescription(e.target.value)}
                    className="w-full px-4.5 py-3.5 bg-slate-50/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-slate-100 text-sm font-medium leading-relaxed focus:outline-none focus:border-red-600 focus:bg-white dark:focus:bg-slate-900 focus:ring-4 focus:ring-red-500/10 transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Questions Section */}
            <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-2xs space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <h2 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white flex items-center gap-2.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-600 dark:bg-red-500 ring-4 ring-red-50 dark:ring-red-950"></span> Асуултуудын жагсаалт
                  </h2>
                  <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">
                    Үйлчлүүлэгчээс асуух талбаруудыг удирдах. «Харилцагч: …» гэж холбосон хариултаар анкет бөглөсөн хүн
                    харилцагчийн жагсаалтад автоматаар нэмэгдэнэ (утас эсвэл имэйлээр нь өмнөх бүртгэлтэй тулгана).
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddQuestion}
                  className="flex items-center gap-2 text-xs font-bold bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-900 hover:bg-red-100 dark:hover:bg-red-900 px-4 py-2.5 rounded-xl transition-all cursor-pointer shrink-0"
                >
                  <Plus size={16} /> Асуулт нэмэх
                </button>
              </div>

              <div className="space-y-4">
                {questions.map((q, index) => (
                  <div
                    key={q.id}
                    className="p-5 sm:p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-800/40 hover:bg-slate-50/80 dark:hover:bg-slate-800/85 transition-all space-y-4 animate-in fade-in slide-in-from-bottom-2"
                  >
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center gap-3.5 flex-1">
                        <span className="w-8 h-8 rounded-xl bg-slate-200/80 dark:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center text-xs font-black shrink-0">
                          {index + 1}
                        </span>
                        <input
                          type="text"
                          value={q.label}
                          maxLength={300}
                          onChange={(e) => handleQuestionChange(q.id, 'label', e.target.value)}
                          placeholder="Асуултын нэр..."
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:border-red-600 transition-all"
                        />
                      </div>

                      <div className="flex items-center gap-2 sm:pl-11.5 flex-wrap">
                        <select
                          value={q.type}
                          onChange={(e) => handleQuestionChange(q.id, 'type', e.target.value)}
                          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:border-red-600 cursor-pointer"
                        >
                          <option value="text">Текст</option>
                          <option value="number">Тоо</option>
                          <option value="select">Сонголт</option>
                        </select>

                        <select
                          value={q.maps_to ?? ''}
                          onChange={(e) => handleQuestionChange(q.id, 'maps_to', e.target.value)}
                          title="Хариултыг харилцагчийн бүртгэлийн аль талбарт хадгалах"
                          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:border-red-600 cursor-pointer"
                        >
                          {CUSTOMER_FIELD_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.value ? `Харилцагч: ${o.label}` : o.label}
                            </option>
                          ))}
                        </select>

                        <button
                          type="button"
                          onClick={() => handleQuestionChange(q.id, 'required', !q.required)}
                          className={`px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            q.required
                              ? 'bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'
                              : 'bg-slate-200/60 dark:bg-slate-700 text-slate-500 dark:text-slate-300'
                          }`}
                        >
                          {q.required ? 'Заавал' : 'Заавал биш'}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteQuestion(q.id)}
                          disabled={questions.length <= 1}
                          title={questions.length <= 1 ? 'Анкетад дор хаяж нэг асуулт байна' : 'Асуулт устгах'}
                          className="p-2.5 text-slate-400 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                    {q.type === 'select' && (
                      <div className="pt-1">
                        <input
                          type="text"
                          defaultValue={Array.isArray(q.options) ? q.options.join(', ') : ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            const optionsArray = val ? val.split(',').map((s) => s.trim()).filter(Boolean) : [];
                            handleQuestionChange(q.id, 'options', optionsArray);
                          }}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:border-red-600"
                          placeholder="Сонголтууд (таслалаар тусгаарлах, жнь: Авто угаалга, Тос солих)"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* QR & Public Link */}
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-2xs text-center space-y-6 sticky top-24">
              <div className="text-left pb-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <h2 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">QR Код</h2>
                  <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">Камераар уншуулж бөглөх</p>
                </div>
                {clientFormUrl && (
                  <a
                    href={clientFormUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 bg-slate-50 dark:bg-slate-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-xl transition-all"
                    title="Шинэ цонхоор нээх"
                  >
                    <ExternalLink size={16} />
                  </a>
                )}
              </div>

              {isNew ? (
                <div className="bg-slate-50/80 dark:bg-slate-800/50 p-6 rounded-3xl border border-dashed border-slate-300 dark:border-slate-700 flex flex-col items-center justify-center gap-3 text-center">
                  <QrCode size={40} className="text-slate-300 dark:text-slate-600" />
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 leading-relaxed">
                    Анкетыг үүсгэсний дараа QR код болон хуваалцах холбоос энд гарна.
                  </p>
                </div>
              ) : (
                <>
                  <div className="bg-slate-50/80 dark:bg-slate-800/50 p-6 rounded-3xl border border-slate-200/60 dark:border-slate-700 flex flex-col items-center justify-center space-y-4">
                    <div className="w-44 h-44 bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200/80 dark:border-slate-700 flex items-center justify-center shadow-2xs relative">
                      {qrCodeImageUrl && (
                        <Image
                          src={qrCodeImageUrl}
                          alt="Анкетын QR код"
                          width={176}
                          height={176}
                          className="w-full h-full object-contain rounded-lg"
                          unoptimized
                        />
                      )}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3.5 py-2.5 rounded-2xl">
                      <input
                        type="text"
                        readOnly
                        value={clientFormUrl}
                        className="w-full bg-transparent text-xs font-semibold text-slate-600 dark:text-slate-300 focus:outline-none truncate"
                      />
                      <button
                        type="button"
                        onClick={handleCopyLink}
                        title="Холбоос хуулах"
                        className="bg-red-600 hover:bg-red-700 text-white p-2.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer"
                      >
                        <Copy size={15} />
                      </button>
                    </div>
                    {copied && <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">Линк хуулагдлаа!</p>}
                    {!isActive && (
                      <p className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                        Анкет идэвхгүй тул одоогоор хариулт хүлээн авахгүй. Жагсаалтаас идэвхжүүлнэ.
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Preview Mode */
        <div className="max-w-xl mx-auto bg-white dark:bg-slate-900 p-8 sm:p-12 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-2xs space-y-8">
          <div className="text-center space-y-2 pb-6 border-b border-slate-100 dark:border-slate-800">
            <span className="bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-900 text-xs font-bold px-3.5 py-1 rounded-full uppercase">Урьдчилан харах</span>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">{formTitle}</h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">{formDescription}</p>
          </div>

          <div className="space-y-5">
            {questions.map((q, idx) => (
              <div key={q.id} className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  {idx + 1}. {q.label} {q.required && <span className="text-rose-500 dark:text-rose-400">*</span>}
                </label>
                {q.type === 'select' ? (
                  <select className="w-full px-4.5 py-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:border-red-600 cursor-pointer">
                    <option value="">Сонгох...</option>
                    {(Array.isArray(q.options) ? q.options : []).map((o, i) => (
                      <option key={i} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={q.type}
                    placeholder="Бөглөх хэсэг..."
                    className="w-full px-4.5 py-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:border-red-600"
                  />
                )}
              </div>
            ))}
            <button
              type="button"
              className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-4 rounded-2xl transition-all mt-6 text-sm cursor-pointer shadow-md shadow-red-500/20"
            >
              Илгээх
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
