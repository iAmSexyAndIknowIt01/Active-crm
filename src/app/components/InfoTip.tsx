'use client';

import type { ReactNode } from 'react';
import { Info } from 'lucide-react';
import Tooltip from './Tooltip';

// Тоон үзүүлэлт, гарчгийн хажууд "энэ тоо яаж гарсан бэ" гэдгийг тайлбарлах жижиг (i) тэмдэг.
// button учир гараар (Tab) focus хийж уншиж болно.
export default function InfoTip({ text, size = 13, className = '' }: { text: ReactNode; size?: number; className?: string }) {
  return (
    <Tooltip text={text} className={`align-middle ${className}`}>
      <button
        type="button"
        aria-label="Тайлбар"
        onClick={(e) => e.stopPropagation()}
        className="inline-flex text-slate-300 hover:text-slate-500 dark:text-slate-600 dark:hover:text-slate-300 focus-visible:text-red-600 outline-none rounded-full cursor-help normal-case tracking-normal"
      >
        <Info size={size} aria-hidden />
      </button>
    </Tooltip>
  );
}
