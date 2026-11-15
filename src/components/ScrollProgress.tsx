'use client';

import { useEffect, useRef } from 'react';

// Хуудасны scroll bar нуугдсан (globals.css) тул хуудасны аль хэсэгт явааг
// дэлгэцийн хамгийн дээд талд нимгэн шугамаар харуулна. Бүх хуудсанд (root layout) ажиллана.
// Гүйлгэх зүйлгүй богино хуудсанд шугам харагдахгүй.
export default function ScrollProgress() {
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // scroll event нь хөтөч дээр frame бүрт нэгээс илүү ирдэггүй тул шууд шинэчилнэ
    const update = () => {
      const bar = barRef.current;
      if (!bar) return;
      const doc = document.documentElement;
      const max = doc.scrollHeight - window.innerHeight;
      const progress = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      bar.style.transform = `scaleX(${progress})`;
      bar.style.opacity = max > 0 ? '1' : '0';
    };

    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    // Контент ачаалагдаж хуудасны өндөр өөрчлөгдөхөд (жагсаалт, зураг) дахин тооцно
    const observer = new ResizeObserver(update);
    observer.observe(document.body);

    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      observer.disconnect();
    };
  }, []);

  return (
    <div aria-hidden className="fixed inset-x-0 top-0 z-[100] h-[3px] pointer-events-none print:hidden">
      <div
        ref={barRef}
        className="h-full w-full origin-left bg-linear-to-r from-red-600 to-red-400 shadow-[0_0_8px_rgba(220,38,38,0.6)] opacity-0 transition-opacity duration-200"
        style={{ transform: 'scaleX(0)' }}
      />
    </div>
  );
}
