'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

const MAX_WIDTH = 256; // max-w-64
const EDGE = 8;

// Хулгана очих эсвэл гараар focus хийхэд тайлбар харуулна.
// body руу portal-оор, дэлгэцийн байрлалаар (fixed) зурдаг тул scroll-той, overflow-hidden
// сав дотор байсан ч тасрахгүй. Дээр зай багатай бол доор нь гаргана.
export default function Tooltip({ text, children, className = '' }: { text: ReactNode; children: ReactNode; className?: string }) {
  const [pos, setPos] = useState<{ x: number; y: number; below: boolean } | null>(null);
  const ref = useRef<HTMLSpanElement>(null);
  const id = useId();

  const show = () => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const below = rect.top < 96;
    const half = MAX_WIDTH / 2;
    const x = Math.min(Math.max(rect.left + rect.width / 2, half + EDGE), window.innerWidth - half - EDGE);
    setPos({ x, y: below ? rect.bottom + EDGE : rect.top - EDGE, below });
  };
  const hide = () => setPos(null);

  // Scroll хийхэд байрлал зөрөх тул нууна
  useEffect(() => {
    if (!pos) return;
    window.addEventListener('scroll', hide, true);
    return () => window.removeEventListener('scroll', hide, true);
  }, [pos]);

  return (
    <span
      ref={ref}
      className={`inline-flex ${className}`}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocusCapture={show}
      onBlurCapture={hide}
      aria-describedby={pos ? id : undefined}
    >
      {children}
      {pos &&
        createPortal(
          <span
            id={id}
            role="tooltip"
            style={{ position: 'fixed', left: pos.x, top: pos.y, transform: `translate(-50%, ${pos.below ? '0' : '-100%'})` }}
            className="z-100 pointer-events-none w-max max-w-64 text-[length:max(11px,0.75rem)] font-medium leading-relaxed bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl px-3 py-2 shadow-lg"
          >
            {text}
          </span>,
          document.body
        )}
    </span>
  );
}
