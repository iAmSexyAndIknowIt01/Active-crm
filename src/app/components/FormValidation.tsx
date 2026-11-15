'use client';

import { useCallback, useRef, useState } from 'react';
import { AlertCircle, X } from 'lucide-react';

type Field = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

const isField = (el: EventTarget | null): el is Field =>
  el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement;

// Нуугдмал input (жишээ нь SearchSelect-ийн) бол хэрэглэгчийн харж буй талбарыг олно
function focusField(el: Field) {
  const visible =
    el.getClientRects().length > 0 && el.offsetWidth > 1
      ? el
      : el.parentElement?.querySelector<HTMLElement>('input[role="combobox"], input:not([tabindex="-1"]), select, textarea');
  const target = visible ?? el;
  target.scrollIntoView({ block: 'center', behavior: 'smooth' });
  target.focus({ preventScroll: true });
}

// Формын шалгалтын алдааг браузерын bubble-ээр биш, талбар бүрийн доор харуулах.
// Хэрэглээ: const { formRef, errors, resetErrors } = useFormValidation();
//           <form ref={formRef}> ... <FieldError message={errors.title} />
// Талбарууд name attribute-тай байх ёстой. Мессежийг ValidationMessages монголоор бэлдэнэ.
export function useFormValidation() {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const pass = useRef<{ errors: Record<string, string>; first: Field } | null>(null);

  const formRef = useCallback((form: HTMLFormElement | null) => {
    if (!form) return;

    // Submit үед invalid бүх талбар дээр дараалан ирнэ; нэг удаагийн шалгалтыг нэгтгэж state-д оруулна
    const onInvalid = (e: Event) => {
      if (!isField(e.target)) return;
      const el = e.target;
      e.preventDefault(); // браузерын bubble-ийг харуулахгүй
      if (!pass.current) {
        pass.current = { errors: {}, first: el };
        queueMicrotask(() => {
          const current = pass.current;
          pass.current = null;
          if (!current) return;
          setErrors(current.errors);
          focusField(current.first);
        });
      }
      const key = el.name;
      if (key && !pass.current.errors[key]) pass.current.errors[key] = el.validationMessage;
    };

    // Хэрэглэгч талбарыг засмагц тухайн алдааг арилгана
    const onEdit = (e: Event) => {
      if (!isField(e.target) || !e.target.name) return;
      const name = e.target.name;
      setErrors((prev) => {
        if (!(name in prev)) return prev;
        const next = { ...prev };
        delete next[name];
        return next;
      });
    };

    form.addEventListener('invalid', onInvalid, true);
    form.addEventListener('input', onEdit, true);
    form.addEventListener('change', onEdit, true);
    return () => {
      form.removeEventListener('invalid', onInvalid, true);
      form.removeEventListener('input', onEdit, true);
      form.removeEventListener('change', onEdit, true);
    };
  }, []);

  const resetErrors = useCallback(() => setErrors({}), []);

  return { formRef, errors, resetErrors };
}

// Алдаатай талбарын хүрээ
export const invalidClass = 'border-rose-400! dark:border-rose-500! focus:border-rose-500! focus-within:border-rose-500!';

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="mt-1.5 flex items-center gap-1 text-[length:max(11px,0.75rem)] font-bold text-rose-600 dark:text-rose-400">
      <AlertCircle size={12} className="shrink-0" />
      {message}
    </p>
  );
}

// Серверээс ирсэн алдааг формын дотор харуулах
export function FormErrorBanner({ message, onClose }: { message?: string; onClose?: () => void }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="flex items-start gap-2.5 px-3.5 py-3 rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300"
    >
      <AlertCircle size={16} className="shrink-0 mt-px" />
      <p className="flex-1 text-xs font-bold leading-relaxed">{message}</p>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="p-0.5 rounded text-rose-400 hover:text-rose-600 dark:hover:text-rose-200 cursor-pointer"
          aria-label="Хаах"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}
