'use client';

import Link from 'next/link';
import { homePathFor, normalizeRole } from '@/src/lib/roles';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Lock, Mail, Loader2 } from 'lucide-react';
import LoadingComponent from '../components/loading';
import PasswordInput from '@/src/components/PasswordInput';
import BrandLogo from '@/src/components/BrandLogo';

export default function LoginPage() {
  const router = useRouter();

  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Имэйлээ баталгаажуулаагүй үед холбоосыг дахин илгээх товч харуулна
  const [notVerified, setNotVerified] = useState(false);
  const [resendMessage, setResendMessage] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsInitialLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setNotVerified(false);
    setResendMessage('');

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.code === 'email_not_verified') setNotVerified(true);
        throw new Error(data.error || 'Нэвтрэх үед алдаа гарлаа.');
      }

      // Ажилтанд зөвхөн "Ажил" цэс харагддаг тул шууд тийш нь оруулна
      router.push(homePathFor(normalizeRole(data.user?.role)));

    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Нэвтрэх үед алдаа гарлаа.');
      }
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResendMessage('');
    try {
      const res = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: formData.email }),
      });
      const data = await res.json();
      setResendMessage(data.message || data.error || '');
    } catch {
      setResendMessage('Сервертэй холбогдож чадсангүй.');
    }
  };

  if (isInitialLoading || loading) {
    return <LoadingComponent />;
  }

  return (
    <div className="min-h-screen bg-[#fffafa] dark:bg-slate-950 flex items-center justify-center relative overflow-hidden px-4 sm:px-6 py-12 transition-colors duration-300">
      
      {/* Blueprint Grid Pattern */}
      <div 
        className="absolute inset-0 opacity-[0.7] dark:opacity-[0.08] pointer-events-none -z-10"
        style={{
          backgroundImage: `
            linear-gradient(to right, #fecaca 1.5px, transparent 1.5px),
            linear-gradient(to bottom, #fecaca 1.5px, transparent 1.5px),
            linear-gradient(to right, #fee2e2 1px, transparent 1px),
            linear-gradient(to bottom, #fee2e2 1.5px, transparent 1.5px)
          `,
          backgroundSize: '128px 128px, 128px 128px, 32px 32px, 32px 32px',
          backgroundPosition: '0 0, 0 0, 0 0, 0 0'
        }}
      />

      {/* Decorative soft glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 sm:w-125 sm:h-75 bg-red-200/50 dark:bg-red-900/15 blur-[120px] sm:blur-[140px] rounded-full pointer-events-none -z-10" />

      <div className="max-w-md w-full bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200/95 dark:border-slate-800 p-6 sm:p-10 rounded-3xl shadow-xl shadow-red-500/10 dark:shadow-none relative z-10">
        
        {/* Header */}
        <div className="text-center mb-6 sm:mb-8">
          <Link href="/" className="inline-flex items-center gap-3 mb-4 group">
            <BrandLogo markClassName="w-11 h-11 group-hover:scale-105 transition-transform" />
          </Link>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">Системд нэвтрэх</h1>
          <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm mt-1">Бизнесийн удирдлагын хэсэг рүүгээ орох</p>
        </div>

        {/* Алдааны мессеж харуулах */}
        {error && (
          <div className="bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 p-3 rounded-xl text-xs sm:text-sm mb-4 font-bold text-center animate-in fade-in">
            {error}
            {notVerified && (
              <div className="mt-2 font-semibold">
                <button type="button" onClick={handleResend} className="underline cursor-pointer">
                  Баталгаажуулах холбоосыг дахин илгээх
                </button>
                {resendMessage && <p className="mt-1 text-slate-600 dark:text-slate-300">{resendMessage}</p>}
              </div>
            )}
          </div>
        )}

        {/* Form */}
        <form className="space-y-4 sm:space-y-5" onSubmit={handleSubmit}>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              Имэйл хаяг
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-400 dark:text-slate-500">
                <Mail size={18} />
              </span>
              <input 
                type="email" 
                name="email"
                required
                value={formData.email}
                onChange={handleChange}
                placeholder="example@business.mn" 
                className="w-full pl-11 pr-4 py-3.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-2xl text-slate-900 dark:text-white text-sm focus:outline-none focus:border-red-500 dark:focus:border-red-400 focus:bg-white dark:focus:bg-slate-800 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Нууц үг
              </label>
              <Link href="/forgot-password" className="text-xs font-bold text-red-600 dark:text-red-400 hover:underline">
                Нууц үгээ мартсан уу?
              </Link>
            </div>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-4 flex items-center z-10 pointer-events-none text-slate-400 dark:text-slate-500">
                <Lock size={18} />
              </span>
              <PasswordInput
                name="password"
                required
                value={formData.password}
                onChange={handleChange}
                placeholder="••••••••" 
                className="w-full pl-11 pr-11 py-3.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-2xl text-slate-900 dark:text-white text-sm focus:outline-none focus:border-red-500 dark:focus:border-red-400 focus:bg-white dark:focus:bg-slate-800 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500"
              />
            </div>
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="w-full mt-2 inline-flex items-center justify-center gap-2 bg-linear-to-r from-red-600 to-red-500 hover:from-red-700 hover:to-red-600 text-white font-extrabold px-6 py-4 rounded-2xl shadow-lg shadow-red-500/20 dark:shadow-none transition-all hover:scale-[1.01] disabled:opacity-70 text-sm cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 size={18} className="animate-spin" /> Нэвтэрч байна...
              </>
            ) : (
              <>
                <span>Нэвтрэх</span> <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        {/* Footer Link */}
        <div className="text-center mt-6 sm:mt-8 pt-6 border-t border-slate-100 dark:border-slate-800 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
          Бүртгэлгүй юу?{' '}
          <Link href="/register" className="font-bold text-red-600 dark:text-red-400 hover:underline">
            Энд дарж бүртгүүлэх
          </Link>
        </div>

      </div>
    </div>
  );
}