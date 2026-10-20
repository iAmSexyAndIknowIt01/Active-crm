// src/components/ThemeToggle.tsx
'use client';

import { useTheme } from 'next-themes';
import { useMounted } from '@/src/lib/use-mounted';
import { Moon, Sun } from 'lucide-react';

export default function ThemeToggle() {
  const { setTheme, resolvedTheme } = useTheme();
  const mounted = useMounted();

  if (!mounted) {
    return <div className="w-9 h-9" />; // Server/Client зөрүү гарахаас сэргийлэх
  }

  return (
    <button
      onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
      className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
      aria-label="Toggle Theme"
    >
      {resolvedTheme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}