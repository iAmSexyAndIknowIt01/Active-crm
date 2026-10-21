'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import BrandLogo from '@/src/components/BrandLogo';

function VerifyEmailContent() {
  const token = useSearchParams().get('token');
  const [state, setState] = useState<{ status: 'loading' | 'ok' | 'error'; message?: string }>({ status: 'loading' });

  useEffect(() => {
    if (!token) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState({ status: 'error', message: 'Баталгаажуулах холбоос буруу байна.' });
      return;
    }
    fetch('/api/auth/verify-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then((res) => res.json())
      .then((json) =>
        setState(json.success ? { status: 'ok' } : { status: 'error', message: json.error || 'Баталгаажуулж чадсангүй.' })
      )
      .catch(() => setState({ status: 'error', message: 'Сервертэй холбогдож чадсангүй.' }));
  }, [token]);

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-16 bg-slate-50 dark:bg-slate-950">
      <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 sm:p-10 rounded-3xl shadow-xl text-center space-y-5">
        <Link href="/" className="inline-flex">
          <BrandLogo markClassName="w-10 h-10" />
        </Link>
        {state.status === 'loading' && (
          <p className="flex items-center justify-center gap-2 text-sm font-bold text-slate-500">
            <Loader2 size={18} className="animate-spin" /> Баталгаажуулж байна...
          </p>
        )}
        {state.status === 'ok' && (
          <>
            <CheckCircle2 size={44} className="mx-auto text-emerald-500" />
            <h1 className="text-xl font-black text-slate-900 dark:text-white">Имэйл баталгаажлаа</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">Одоо имэйл, нууц үгээрээ нэвтэрч болно.</p>
            <Link href="/login" className="inline-block bg-red-600 hover:bg-red-700 text-white font-bold px-6 py-3 rounded-2xl text-sm">
              Нэвтрэх
            </Link>
          </>
        )}
        {state.status === 'error' && (
          <>
            <AlertTriangle size={44} className="mx-auto text-rose-500" />
            <h1 className="text-xl font-black text-slate-900 dark:text-white">Баталгаажуулж чадсангүй</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">{state.message}</p>
            <Link href="/login" className="inline-block text-red-600 dark:text-red-400 font-bold text-sm hover:underline">
              Нэвтрэх хуудас руу очих
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailContent />
    </Suspense>
  );
}
