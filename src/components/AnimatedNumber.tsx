'use client';

import { useEffect, useRef, useState } from 'react';

// Тоог өмнөх утгаас (анх 0-ээс) шинэ утга руу гүйлгэж харуулна. Хөдөлгөөнийг багасгах
// тохиргоотой хэрэглэгчид шууд эцсийн утгыг харуулна.
export default function AnimatedNumber({
  value,
  format = (n) => Math.round(n).toLocaleString('mn-MN'),
  duration = 900,
}: {
  value: number;
  format?: (n: number) => string;
  duration?: number;
}) {
  const [display, setDisplay] = useState(0);
  const fromRef = useRef(0);

  useEffect(() => {
    const from = fromRef.current;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || from === value) {
      fromRef.current = value;
      // Хөдөлгөөнгүйгээр эцсийн утгыг шууд харуулна
      setDisplay(value);
      return;
    }

    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      const current = from + (value - from) * eased;
      fromRef.current = current;
      setDisplay(current);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);

  return <span className="tabular-nums">{format(display)}</span>;
}
