'use client';

import { useEffect } from 'react';

// Утасны дэлгэцэнд (< 768px) олон баганатай хүснэгтийн зөвхөн эхний багана харагдаж, үлдсэн мэдээлэл
// хажуу тийш гүйлгэхэд нуугддаг тул жагсаалтыг анхнаасаа карт хэлбэрээр харуулна.
// Хэрэглэгч өөрөө сонгосон (жнь. URL-д ?view=) бол хүндэтгэнэ. Сервер дээр рендерлэхтэй зөрөхгүйн тулд
// mount болсны дараа нэг удаа шалгана.
export function useMobileCardView(setViewMode: (mode: 'grid') => void, explicitChoice = false) {
  useEffect(() => {
    if (explicitChoice) return;
    if (window.matchMedia('(max-width: 767px)').matches) setViewMode('grid');
    // Зөвхөн анх нэг удаа
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
