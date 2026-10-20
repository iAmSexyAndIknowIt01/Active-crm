'use client';

import { useEffect, useRef, type ReactNode } from 'react';

type Variant = 'up' | 'left' | 'right' | 'zoom';

// Дэлгэцэнд орж ирэхэд нэг удаа зөөлөн гарч ирэх хөдөлгөөн (globals.css-ийн .reveal).
// JS ажиллахгүй үед ч агуулга харагдахаар <noscript> загвар нь landing page дээр бий.
export default function Reveal({
  children,
  delay = 0,
  variant = 'up',
  className = '',
}: {
  children: ReactNode;
  delay?: number;
  variant?: Variant;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!('IntersectionObserver' in window)) {
      el.classList.add('is-visible');
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add('is-visible');
          observer.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const variantClass = variant === 'up' ? '' : `reveal-${variant}`;
  return (
    <div ref={ref} className={`reveal ${variantClass} ${className}`} style={{ ['--reveal-delay' as string]: `${delay}ms` }}>
      {children}
    </div>
  );
}
