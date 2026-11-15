'use client';

import { useState, useEffect, use } from 'react';
import { CheckCircle2, FileX } from 'lucide-react';
import LoadingComponent from '@/src/app/components/loading';
import AnketForm, { findMissingAnswers, type AnketAnswers } from '@/src/components/anket/AnketForm';
import type { TemplateQuestion } from '@/src/lib/form-templates';

// Үйлчлүүлэгчийн бөглөх нийтийн анкет (QR кодоор нээгдэнэ)
export default function PublicAnketPage({
  params,
  searchParams,
}: {
  params: Promise<{ companyid: string }>;
  searchParams: Promise<{ t?: string | string[] }>;
}) {
  const companyId = use(params).companyid;
  // ?t=<анкетын id>: компанийн олон анкетаас аль нь болохыг заана. Байхгүй бол үндсэн анкет.
  const requestedTemplate = use(searchParams).t;
  const templateQuery = typeof requestedTemplate === 'string' && requestedTemplate ? `?t=${encodeURIComponent(requestedTemplate)}` : '';

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const [templateId, setTemplateId] = useState('');
  const [formToken, setFormToken] = useState('');
  // Роботын эсрэг далд талбар: хүн харахгүй, бөглөхгүй
  const [website, setWebsite] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [questions, setQuestions] = useState<TemplateQuestion[]>([]);
  const [answers, setAnswers] = useState<AnketAnswers>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    async function fetchPublicTemplate() {
      try {
        const res = await fetch(`/api/active-crm/form/${companyId}${templateQuery}`);
        const json = await res.json();
        if (json.success && json.data) {
          setTemplateId(json.data.id || '');
          setFormToken(json.data.form_token || '');
          setFormTitle(json.data.title || 'Үйлчлүүлэгчийн анкет');
          setFormDescription(json.data.description || '');
          setQuestions(
            (Array.isArray(json.data.questions) ? json.data.questions : []).map((q: TemplateQuestion) => ({ ...q, id: String(q.id) }))
          );
        } else {
          setLoadError(json.error || 'Анкет олдсонгүй.');
        }
      } catch (err) {
        console.error('Failed to load public template:', err);
        setLoadError('Сервертэй холбогдоход алдаа гарлаа. Интернэт холболтоо шалгаад хуудсыг дахин ачаална уу.');
      } finally {
        setLoading(false);
      }
    }
    if (companyId) fetchPublicTemplate();
  }, [companyId, templateQuery]);

  const handleAnswer = (questionId: string, value: string | string[]) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
    // Хариулмагц тухайн асуултын алдааг арилгана
    setErrors((prev) => {
      if (!prev[questionId]) return prev;
      const next = { ...prev };
      delete next[questionId];
      return next;
    });
    setSubmitError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');

    // Бөглөөгүй заавал асуултыг тэмдэглээд эхнийх рүү нь гүйлгэнэ
    const missing = findMissingAnswers(questions, answers);
    setErrors(missing);
    const firstMissing = questions.find((q) => missing[q.id]);
    if (firstMissing) {
      document.getElementById(`q-${firstMissing.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(`/api/active-crm/form/${companyId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId, formToken, website, answers }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Илгээхэд алдаа гарлаа. Дахин оролдоно уу.');
      setSubmitted(true);
      window.scrollTo({ top: 0 });
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'Сүлжээний алдаа гарлаа. Дахин оролдоно уу.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <LoadingComponent text="Анкетыг ачаалж байна..." />;
  }

  if (loadError) {
    return (
      <Centered>
        <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto">
          <FileX size={30} />
        </div>
        <h1 className="text-xl font-black text-slate-900">Анкет нээгдсэнгүй</h1>
        <p className="text-sm text-slate-500 leading-relaxed">{loadError}</p>
      </Centered>
    );
  }

  if (submitted) {
    return (
      <Centered>
        <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
          <CheckCircle2 size={34} />
        </div>
        <h1 className="text-xl font-black text-slate-900">Баярлалаа!</h1>
        <p className="text-sm text-slate-500 leading-relaxed">Таны хариулт амжилттай илгээгдлээ. Энэ хуудсыг хааж болно.</p>
      </Centered>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 py-6 sm:py-10 px-4 font-sans antialiased">
      <div className="max-w-2xl mx-auto">
        <AnketForm
          title={formTitle}
          description={formDescription}
          questions={questions}
          answers={answers}
          errors={errors}
          onAnswer={handleAnswer}
          onSubmit={handleSubmit}
          submitting={submitting}
          submitError={submitError}
          hiddenFields={
            // Роботын эсрэг далд талбар (дэлгэц уншигч, Tab-аас ч нуусан)
            <div aria-hidden="true" className="absolute -left-[10000px] w-px h-px overflow-hidden">
              <label>
                Website
                <input type="text" name="website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
              </label>
            </div>
          }
        />
      </div>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white p-8 rounded-3xl border border-slate-200/70 shadow-sm text-center space-y-4">{children}</div>
    </div>
  );
}
