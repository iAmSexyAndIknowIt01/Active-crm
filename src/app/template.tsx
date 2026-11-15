'use client';

import { usePathname } from 'next/navigation';

// Дээд түвшний хуудас солигдох бүрт (нэвтрэх, бүртгүүлэх, анкет ...) шинээр mount болж
// хуудасны орох хөдөлгөөнийг (globals.css .page-enter) тоглуулна.
// Нүүр хуудас өөрийн хөдөлгөөнтэй, dashboard нь өөрийн template.tsx-тэй тул алгасна.
export default function RootTemplate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const animate = pathname !== '/' && !pathname.startsWith('/dashboard');

  return <div className={`flex-1 flex flex-col${animate ? ' page-enter' : ''}`}>{children}</div>;
}
