'use client';

import { useState, useMemo, useRef, useEffect, useId } from 'react';
import { Search, X, ChevronDown, Check } from 'lucide-react';
import { invalidClass } from './FormValidation';

export interface SearchSelectOption {
  value: string;
  label: string;
  // Нэмэлт мэдээлэл (утас, регистр, үнэ гэх мэт) — жагсаалтад саарал өнгөөр харагдаж, хайлтад орно
  sub?: string;
  // Харагдахгүй ч хайлтад тооцох үгс
  keywords?: string;
}

const digitsOnly = (value: string) => value.replace(/\D/g, '');
const MAX_RESULTS = 50;

// Бичиж хайгаад сонгодог select. Нэр, утас (зай, зураасгүй цифрээр), нэмэлт мэдээллээр хайна.
// Товчлуур: ↑/↓ шилжих, Enter сонгох, Esc хаах.
export default function SearchSelect({
  options,
  value,
  onChange,
  placeholder = 'Хайх...',
  emptyText = 'Илэрц олдсонгүй',
  required = false,
  requiredMessage,
  name,
  invalid = false,
  size = 'md',
  clearable = true,
  fallbackLabel,
  className = '',
  'aria-label': ariaLabel,
}: {
  options: SearchSelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  emptyText?: string;
  required?: boolean;
  // Сонгоогүй үед харуулах мессеж (жишээ нь "Харилцагчаа сонгоно уу.")
  requiredMessage?: string;
  // Формын шалгалтад (useFormValidation) ашиглах нэр
  name?: string;
  // Алдаатай үед улаан хүрээ
  invalid?: boolean;
  // sm: шүүлтүүрийн select-үүдтэй ижил өндөр
  size?: 'sm' | 'md';
  clearable?: boolean;
  // Утга нь сонголтуудын дунд байхгүй үед (жишээ нь устсан харилцагч) харуулах текст
  fallbackLabel?: string;
  className?: string;
  'aria-label'?: string;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const listId = useId();
  const listRef = useRef<HTMLUListElement>(null);
  const hiddenRef = useRef<HTMLInputElement>(null);

  // Утгыг кодоор сольдог тул нуугдмал input дээр input event өгч, өмнөх шалгалтын
  // мессеж болон формын алдааг цэвэрлэнэ (эс бөгөөд дараагийн submit хаагдана)
  useEffect(() => {
    hiddenRef.current?.dispatchEvent(new Event('input', { bubbles: true }));
  }, [value]);

  const selected = options.find((o) => o.value === value);

  const indexed = useMemo(
    () =>
      options.map((o) => {
        const text = `${o.label} ${o.sub ?? ''} ${o.keywords ?? ''}`.toLowerCase();
        return { option: o, text, digits: digitsOnly(text) };
      }),
    [options]
  );

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options.slice(0, MAX_RESULTS);
    const qDigits = digitsOnly(q);
    // Хэд хэдэн үгээр хайвал бүх үг тааралдах ёстой ("бат 9911")
    const words = q.split(/\s+/);
    return indexed
      .filter(({ text, digits }) =>
        words.every((w) => text.includes(w)) || (qDigits.length >= 3 && qDigits === q.replace(/[\s-]/g, '') && digits.includes(qDigits))
      )
      .slice(0, MAX_RESULTS)
      .map(({ option }) => option);
  }, [indexed, options, query]);

  // Гараар шилжих үед тодорсон мөрийг харагдах хэсэгт байлгана
  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.children[highlight] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [highlight, open]);

  const openList = () => {
    setQuery('');
    setHighlight(Math.max(0, options.slice(0, MAX_RESULTS).findIndex((o) => o.value === value)));
    setOpen(true);
  };

  const choose = (next: string) => {
    onChange(next);
    setQuery('');
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) return openList();
      setHighlight((h) => Math.min(h + 1, matches.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter' && open) {
      e.preventDefault();
      if (matches[highlight]) choose(matches[highlight].value);
    } else if (e.key === 'Escape' && open) {
      // Modal-ийн Esc handler цонхыг хаахгүйн тулд
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
    }
  };

  const displayValue = selected ? (selected.sub ? `${selected.label} · ${selected.sub}` : selected.label) : fallbackLabel ?? '';

  return (
    <div className="relative">
      <div
        className={`w-full flex items-center gap-2 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus-within:border-red-500 dark:focus-within:border-red-400 transition-colors ${invalid ? invalidClass : ''} ${className}`}
      >
        <Search size={14} className="text-slate-400 shrink-0" />
        <input
          type="text"
          value={open ? query : displayValue}
          onChange={(e) => {
            setQuery(e.target.value);
            setHighlight(0);
            setOpen(true);
          }}
          onFocus={openList}
          onClick={() => !open && openList()}
          onBlur={() => setOpen(false)}
          onKeyDown={onKeyDown}
          placeholder={open && displayValue ? displayValue : placeholder}
          className={`w-full min-w-0 ${size === 'sm' ? 'py-2' : 'py-2.5'} bg-transparent outline-none text-xs font-bold text-slate-800 dark:text-slate-100 placeholder:text-slate-400 placeholder:font-semibold`}
          role="combobox"
          aria-label={ariaLabel}
          aria-expanded={open}
          aria-invalid={invalid || undefined}
          aria-controls={listId}
          aria-autocomplete="list"
          autoComplete="off"
        />
        {clearable && value && !open ? (
          <button
            type="button"
            onClick={() => onChange('')}
            className="p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer shrink-0"
            aria-label="Сонголтыг арилгах"
          >
            <X size={14} />
          </button>
        ) : (
          <ChevronDown size={14} className={`text-slate-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
        )}
      </div>

      {/* Браузерын "заавал бөглөх" шалгалтыг ашиглахын тулд харагдахгүй input */}
      {required && (
        <input
          ref={hiddenRef}
          name={name}
          tabIndex={-1}
          aria-hidden
          required
          data-required-message={requiredMessage}
          value={value || (fallbackLabel ? '-' : '')}
          onChange={() => {}}
          className="absolute bottom-0 left-4 w-px h-px opacity-0 pointer-events-none"
        />
      )}

      {open && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 w-full max-h-64 overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl py-1"
        >
          {matches.length === 0 ? (
            <li className="px-3.5 py-3 text-xs text-slate-400">{emptyText}</li>
          ) : (
            matches.map((o, i) => (
              <li
                key={o.value}
                role="option"
                aria-selected={o.value === value}
                // onBlur-ээс өмнө сонголтыг бүртгэхийн тулд mousedown ашиглана
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(o.value);
                }}
                onMouseEnter={() => setHighlight(i)}
                className={`flex items-center justify-between gap-2 px-3.5 py-2 cursor-pointer ${
                  i === highlight ? 'bg-red-50 dark:bg-slate-800' : ''
                }`}
              >
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">{o.label}</p>
                  {o.sub && <p className="text-[11px] text-slate-400 truncate">{o.sub}</p>}
                </div>
                {o.value === value && <Check size={14} className="text-red-600 dark:text-red-400 shrink-0" />}
              </li>
            ))
          )}
          {!query && options.length > MAX_RESULTS && (
            <li className="px-3.5 py-2 text-[11px] text-slate-400 border-t border-slate-100 dark:border-slate-800">
              Эхний {MAX_RESULTS}-г харуулж байна. Бичиж хайна уу.
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
