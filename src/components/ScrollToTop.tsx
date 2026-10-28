'use client';

import { useEffect, useState } from 'react';
import { ArrowUp } from 'lucide-react';

// Хуудсыг дээш нь гүйлгэнэ. Хөдөлгөөнийг багасгах тохиргоотой хэрэглэгчид шууд үсэрнэ.
export function scrollToTop() {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
}

// Тодорхой хэмжээгээр доош гүйлгэсэн үед баруун доод буланд гарч ирэх "Дээш буцах" товч
export default function ScrollToTop({ threshold = 400 }: { threshold?: number }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > threshold);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [threshold]);

  return (
    <button
      type="button"
      onClick={scrollToTop}
      aria-label="Дээш буцах"
      title="Дээш буцах"
      tabIndex={visible ? 0 : -1}
      aria-hidden={!visible}
      className={`fixed bottom-5 right-5 sm:bottom-8 sm:right-8 z-40 p-3 rounded-full bg-red-600 text-white shadow-lg shadow-red-600/30 hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950 transition-all duration-300 cursor-pointer print:hidden ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
      }`}
    >
      <ArrowUp size={20} strokeWidth={2.5} />
    </button>
  );
}
