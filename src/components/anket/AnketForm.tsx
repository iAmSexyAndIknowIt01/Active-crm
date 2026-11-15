'use client';

import { forwardRef } from 'react';
import { AlertCircle, Check, Loader2, Send } from 'lucide-react';
import { hasOptions, parseScaleOption, type TemplateQuestion } from '@/src/lib/form-templates';

// Үйлчлүүлэгчийн бөглөх анкет. Нийтийн анкетын хуудас болон засварлагчийн "Урьдчилан харах" хоёуланд
// ижил харагдана. Төлөв (хариулт, алдаа)-ийг эх компонент удирдана.

export type AnketAnswers = Record<string, string | string[]>;

export function isAnswered(value: string | string[] | undefined) {
  return Array.isArray(value) ? value.length > 0 : !!value?.trim();
}

// Бөглөөгүй заавал асуултууд: { асуултын id: алдааны текст }
export function findMissingAnswers(questions: TemplateQuestion[], answers: AnketAnswers) {
  const errors: Record<string, string> = {};
  for (const q of questions) {
    if (q.required && !isAnswered(answers[q.id])) {
      errors[q.id] = hasOptions(q.type) ? 'Сонголтоо хийнэ үү.' : 'Энэ асуултад хариулна уу.';
    }
  }
  return errors;
}

interface AnketFormProps {
  title: string;
  description?: string | null;
  questions: TemplateQuestion[];
  answers: AnketAnswers;
  errors: Record<string, string>;
  onAnswer: (questionId: string, value: string | string[]) => void;
  onSubmit?: (e: React.FormEvent) => void;
  submitting?: boolean;
  submitError?: string;
  // Засварлагчийн урьдчилан харах горим: илгээх товч ажиллахгүй, явцын мөр наалдахгүй
  preview?: boolean;
  // Роботын эсрэг далд талбар гэх мэт нэмэлт элемент (form дотор)
  hiddenFields?: React.ReactNode;
}

const AnketForm = forwardRef<HTMLFormElement, AnketFormProps>(function AnketForm(
  { title, description, questions, answers, errors, onAnswer, onSubmit, submitting, submitError, preview, hiddenFields },
  ref
) {
  const total = questions.length;
  const answered = questions.filter((q) => isAnswered(answers[q.id])).length;
  const percent = total ? Math.round((answered / total) * 100) : 0;
  const minutes = Math.max(1, Math.round((total * 15) / 60));
  const missingCount = Object.keys(errors).length;

  return (
    <form ref={ref} onSubmit={onSubmit ?? ((e) => e.preventDefault())} noValidate className="space-y-4 text-slate-800">
      {hiddenFields}

      {/* Гарчиг */}
      <div className="bg-white rounded-3xl border border-slate-200/70 shadow-sm overflow-hidden">
        <div className="h-1.5 bg-linear-to-r from-red-600 to-rose-400" />
        <div className="p-6 sm:p-8 space-y-3">
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 leading-tight">{title || 'Анкет'}</h1>
          {description && <p className="text-sm sm:text-base text-slate-600 leading-relaxed whitespace-pre-line">{description}</p>}
          <p className="text-xs text-slate-400 flex flex-wrap gap-x-3 gap-y-1">
            <span>{total} асуулт</span>
            <span>· ойролцоогоор {minutes} минут</span>
            <span>
              · <span className="text-red-600">*</span> заавал хариулах
            </span>
          </p>
        </div>
      </div>

      {/* Явцын мөр */}
      {total > 3 && (
        <div className={`${preview ? '' : 'sticky top-0 z-10 -mx-4 px-4 pt-3 pb-2 bg-slate-100/90 backdrop-blur'}`}>
          <div className="flex items-center gap-3 text-xs font-semibold text-slate-500">
            <div className="flex-1 h-2 rounded-full bg-slate-200 overflow-hidden" role="progressbar" aria-valuenow={answered} aria-valuemin={0} aria-valuemax={total}>
              <div className="h-full bg-red-600 rounded-full transition-[width] duration-300" style={{ width: `${percent}%` }} />
            </div>
            <span className="tabular-nums whitespace-nowrap">
              {answered} / {total}
            </span>
          </div>
        </div>
      )}

      {questions.map((q, index) => (
        <QuestionCard
          key={q.id}
          question={q}
          number={index + 1}
          total={total}
          value={answers[q.id]}
          error={errors[q.id]}
          onChange={(v) => onAnswer(q.id, v)}
        />
      ))}

      {/* Илгээх */}
      <div className="bg-white rounded-3xl border border-slate-200/70 shadow-sm p-5 sm:p-6 space-y-3">
        {(missingCount > 0 || submitError) && (
          <p className="flex items-start gap-2 text-sm font-semibold text-rose-600" role="alert">
            <AlertCircle size={18} className="shrink-0 mt-0.5" />
            {submitError || `${missingCount} асуултад хариулаагүй байна. Улаанаар тэмдэглэсэн асуултуудыг бөглөнө үү.`}
          </p>
        )}
        <button
          type={preview ? 'button' : 'submit'}
          disabled={submitting || preview}
          className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold py-4 rounded-2xl text-base shadow-md shadow-red-500/20 transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
          {submitting ? 'Илгээж байна...' : 'Илгээх'}
        </button>
        {preview && <p className="text-center text-xs text-slate-400">Урьдчилан харах горимд илгээгдэхгүй.</p>}
      </div>
    </form>
  );
});

export default AnketForm;

function QuestionCard({
  question: q,
  number,
  total,
  value,
  error,
  onChange,
}: {
  question: TemplateQuestion;
  number: number;
  total: number;
  value: string | string[] | undefined;
  error?: string;
  onChange: (value: string | string[]) => void;
}) {
  const labelId = `q-${q.id}-label`;
  const errorId = `q-${q.id}-error`;
  const text = typeof value === 'string' ? value : '';
  const inputClass = `w-full px-4 py-3 bg-white border rounded-xl text-base text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-4 transition-colors ${
    error ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/15' : 'border-slate-300 focus:border-red-600 focus:ring-red-500/10'
  }`;
  const describedBy = error ? errorId : undefined;

  let control: React.ReactNode;
  // Харагдах байдлыг зөвхөн асуултын төрөл тодорхойлно (сонголтын текстээс таамаглахгүй)
  if (hasOptions(q.type)) {
    const options = Array.isArray(q.options) ? q.options : [];
    const multi = q.type === 'multiselect';
    const picked = Array.isArray(value) ? value : [];

    if (q.type === 'rating') {
      // "1 - Маш муу" хэлбэрийн сонголт товчин дээр тоогоороо, тайлбар нь шкалын хоёр үзүүрт харагдана.
      // Тоогүй сонголтууд ("Хамаарахгүй" г.м.) шкалын доор тусдаа. Нэг ч тоотой сонголтгүй бол бүгд текстээрээ мөрөнд.
      const parsed = options.map((o) => ({ value: o, scale: parseScaleOption(o) }));
      const numeric = parsed.filter((p) => p.scale);
      const steps = (numeric.length ? numeric : parsed).map((p) => ({
        value: p.value,
        number: p.scale?.number ?? '',
        caption: p.scale?.caption ?? '',
      }));
      const extras = numeric.length ? parsed.filter((p) => !p.scale).map((p) => p.value) : [];
      control = (
        <div role="radiogroup" aria-labelledby={labelId} aria-describedby={describedBy} className="space-y-2">
          <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
            {steps.map((s) => {
              const active = text === s.value;
              return (
                <button
                  key={s.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  aria-label={s.value}
                  title={s.caption || undefined}
                  onClick={() => onChange(active && !q.required ? '' : s.value)}
                  className={`min-h-12 rounded-xl border text-base font-bold tabular-nums transition-colors cursor-pointer ${
                    active ? 'bg-red-600 border-red-600 text-white shadow-sm' : 'bg-white border-slate-300 text-slate-700 hover:border-red-400 hover:bg-red-50'
                  }`}
                >
                  {s.number || <span className="text-xs sm:text-sm font-semibold leading-tight px-1">{s.value}</span>}
                </button>
              );
            })}
          </div>
          {steps.length > 0 && (steps[0].caption || steps[steps.length - 1].caption) && (
            <div className="flex justify-between gap-4 text-xs text-slate-500">
              <span>{steps[0].caption}</span>
              <span className="text-right">{steps[steps.length - 1].caption}</span>
            </div>
          )}
          {extras.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {extras.map((o) => {
                const active = text === o;
                return (
                  <button
                    key={o}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => onChange(active && !q.required ? '' : o)}
                    className={`px-4 py-2 rounded-xl border text-sm font-semibold transition-colors cursor-pointer ${
                      active ? 'bg-slate-800 border-slate-800 text-white' : 'bg-white border-slate-300 text-slate-600 hover:border-slate-400 hover:bg-slate-50'
                    }`}
                  >
                    {o}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      );
    } else {
      const twoColumns = options.every((o) => o.length <= 28);
      control = (
        <div
          role={multi ? 'group' : 'radiogroup'}
          aria-labelledby={labelId}
          aria-describedby={describedBy}
          className={`grid gap-2 ${twoColumns ? 'sm:grid-cols-2' : ''}`}
        >
          {options.map((o) => {
            const active = multi ? picked.includes(o) : text === o;
            return (
              <button
                key={o}
                type="button"
                role={multi ? 'checkbox' : 'radio'}
                aria-checked={active}
                onClick={() => {
                  if (multi) onChange(active ? picked.filter((p) => p !== o) : [...picked, o]);
                  else onChange(active && !q.required ? '' : o);
                }}
                className={`flex items-center gap-3 text-left px-4 py-3 rounded-xl border text-sm sm:text-base transition-colors cursor-pointer ${
                  active ? 'border-red-600 bg-red-50 text-slate-900 font-semibold' : 'border-slate-300 bg-white text-slate-700 hover:border-red-300 hover:bg-red-50/50'
                }`}
              >
                <span
                  className={`shrink-0 w-5 h-5 flex items-center justify-center border-2 transition-colors ${multi ? 'rounded-md' : 'rounded-full'} ${
                    active ? 'border-red-600 bg-red-600 text-white' : 'border-slate-300 bg-white'
                  }`}
                >
                  {active && (multi ? <Check size={13} strokeWidth={3} /> : <span className="w-2 h-2 rounded-full bg-white" />)}
                </span>
                <span>{o}</span>
              </button>
            );
          })}
        </div>
      );
    }
  } else if (q.type === 'textarea') {
    control = (
      <textarea
        rows={3}
        value={text}
        maxLength={2000}
        onChange={(e) => onChange(e.target.value)}
        aria-labelledby={labelId}
        aria-describedby={describedBy}
        placeholder="Хариултаа бичнэ үү"
        className={`${inputClass} resize-y min-h-24`}
      />
    );
  } else {
    // Утасны гарыг асуултын текстээс сонгоно (утас → тоон гар, имэйл → @-тэй гар). Хадгалах утгад нөлөөлөхгүй.
    const label = q.label.toLowerCase();
    const kind =
      q.type === 'number'
        ? { type: 'text', inputMode: 'decimal' as const, placeholder: '0' }
        : /утас|phone/.test(label)
          ? { type: 'tel', inputMode: 'tel' as const, placeholder: '9911 2233' }
          : /имэйл|и-мэйл|email|e-mail/.test(label)
            ? { type: 'email', inputMode: 'email' as const, placeholder: 'name@example.com' }
            : { type: 'text', inputMode: undefined, placeholder: 'Хариултаа бичнэ үү' };
    control = (
      <input
        type={kind.type}
        inputMode={kind.inputMode}
        autoComplete="off"
        value={text}
        maxLength={1000}
        onChange={(e) => onChange(e.target.value)}
        aria-labelledby={labelId}
        aria-describedby={describedBy}
        placeholder={kind.placeholder}
        className={inputClass}
      />
    );
  }

  return (
    <div
      id={`q-${q.id}`}
      className={`bg-white rounded-3xl border shadow-sm p-5 sm:p-6 space-y-4 scroll-mt-20 transition-colors ${
        error ? 'border-rose-300 ring-4 ring-rose-500/10' : 'border-slate-200/70'
      }`}
    >
      <div className="space-y-1">
        <p className="text-xs font-semibold text-slate-400">
          Асуулт {number} / {total}
        </p>
        <p id={labelId} className="text-base sm:text-lg font-bold text-slate-900 leading-snug">
          {q.label}
          {q.required ? <span className="text-red-600"> *</span> : <span className="ml-2 text-xs font-medium text-slate-400">заавал биш</span>}
        </p>
        {q.type === 'multiselect' && <p className="text-xs text-slate-500">Хэд хэдэн хариулт сонгож болно.</p>}
      </div>
      {control}
      {error && (
        <p id={errorId} className="flex items-center gap-1.5 text-sm font-semibold text-rose-600">
          <AlertCircle size={15} /> {error}
        </p>
      )}
    </div>
  );
}
