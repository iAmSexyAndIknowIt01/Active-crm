'use client';

import { useState, useEffect, use } from 'react';
import { CheckCircle2, Sparkles, Send } from 'lucide-react';
import LoadingComponent from '@/src/app/components/loading';

interface Question {
  id: string;
  label: string;
  type: 'text' | 'number' | 'select';
  required: boolean;
  options?: string[];
}

export default function PublicAnketPage({ params }: { params: Promise<{ companyid: string }> }) {
  const resolvedParams = use(params);
  const companyId = resolvedParams.companyid;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const [templateId, setTemplateId] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [questions, setQuestions] = useState<Question[]>([]);
  
  const [answers, setAnswers] = useState<Record<string, string>>({});

  useEffect(() => {
    async function fetchPublicTemplate() {
      try {
        const res = await fetch(`/api/active-crm/form/${companyId}`);
        const json = await res.json();

        if (json.success && json.data) {
          setTemplateId(json.data.id || '');
          setFormTitle(json.data.title || 'Үйлчлүүлэгчийн анкет');
          setFormDescription(json.data.description || '');
          setQuestions(json.data.questions || []);
        } else {
          setErrorMessage(json.error || 'Анкет олдсонгүй.');
        }
      } catch (err) {
        console.error('Failed to load public template:', err);
        setErrorMessage('Сервертэй холбогдоход алдаа гарлаа.');
      } finally {
        setLoading(false);
      }
    }

    if (companyId) {
      fetchPublicTemplate();
    }
  }, [companyId]);

  const handleInputChange = (questionId: string, value: string) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMessage('');

    for (const q of questions) {
      if (q.required && !answers[q.id]) {
        setErrorMessage(`"${q.label}" талбарыг заавал бөглөнө үү.`);
        setSubmitting(false);
        return;
      }
    }

    try {
      const response = await fetch(`/api/active-crm/form/${companyId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          templateId,
          answers,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Хадгалахад алдаа гарлаа.');
      }

      setSubmitted(true);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Сүлжээний алдаа гарлаа.';
      setErrorMessage(errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <LoadingComponent text="Анкетын мэдээллийг татаж байна..." />;
  }

  if (submitting) {
    return <LoadingComponent text="Мэдээллийг илгээж байна..." />;
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white p-8 rounded-3xl border border-slate-100 shadow-sm text-center space-y-4">
          <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 size={32} />
          </div>
          <h1 className="text-xl font-black text-slate-900">Амжилттай илгээгдлээ!</h1>
          <p className="text-sm text-slate-500">Таны мэдээллийг хүлээн авлаа. Баярлалаа.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 font-sans antialiased text-slate-800">
      <div className="max-w-xl mx-auto space-y-6">
        
        {errorMessage && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 px-5 py-4 rounded-2xl text-xs sm:text-sm font-bold shadow-sm">
            {errorMessage}
          </div>
        )}

        <div className="bg-white p-8 sm:p-12 rounded-3xl border border-slate-100 shadow-sm space-y-8">
          <div className="text-center space-y-2 pb-6 border-b border-slate-100">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-600 text-xs font-bold uppercase">
              <Sparkles size={12} /> Бүртгэл
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900">{formTitle}</h1>
            <p className="text-xs sm:text-sm text-slate-500">{formDescription}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {questions.map((q, idx) => (
              <div key={q.id} className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                  {idx + 1}. {q.label} {q.required && <span className="text-rose-500">*</span>}
                </label>

                {q.type === 'select' ? (
                  <select
                    value={answers[q.id] || ''}
                    onChange={(e) => handleInputChange(q.id, e.target.value)}
                    className="w-full px-4.5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 text-sm focus:outline-none focus:border-blue-600 cursor-pointer"
                  >
                    <option value="">Сонгох...</option>
                    {Array.isArray(q.options) &&
                      q.options.map((opt, i) => (
                        <option key={i} value={opt}>
                          {opt}
                        </option>
                      ))}
                  </select>
                ) : (
                  <input
                    type={q.type}
                    value={answers[q.id] || ''}
                    onChange={(e) => handleInputChange(q.id, e.target.value)}
                    placeholder="Мэдээллээ оруулна уу..."
                    className="w-full px-4.5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 text-sm focus:outline-none focus:border-blue-600"
                  />
                )}
              </div>
            ))}

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-blue-600 hover:bg-blue-700 active:scale-98 text-white font-bold py-4 rounded-2xl transition-all mt-6 text-sm cursor-pointer shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Send size={16} /> Мэдээлэл илгээх
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}