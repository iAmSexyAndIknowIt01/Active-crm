'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Lock, Mail, User, Building2, Loader2, CheckCircle2 } from 'lucide-react';
import LoadingComponent from '@/src/app/components/loading';
import PasswordInput from '@/src/components/PasswordInput';
import BrandLogo from '@/src/components/BrandLogo';

export default function RegisterPage() {
  const router = useRouter();
  
  const [formData, setFormData] = useState({
    companyName: '',
    lastName: '',  // Овог
    firstName: '', // Нэр
    email: '',
    password: '',
  });

  const [pageLoading, setPageLoading] = useState(false); // Бүтэн хуудасны loader-г идэвхжүүлэх
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setPageLoading(true); // Дата илгээх үед бүтэн хуудасны loader харуулах
    setError(null);
    setSuccess(false);

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Бүртгүүлэхэд алдаа гарлаа.');
      }

      setSuccess(true);
      
      setTimeout(() => {
        router.push('/login');
      }, 3500);

    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Сүлжээний алдаа гарлаа.';
      setError(errorMsg);
      setPageLoading(false); // Алдаа гарсан үед loader-г болиулах
    } finally {
      setLoading(false);
    }
  };

  if (pageLoading) {
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
          
          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/60 px-3 py-1 rounded-full border border-red-200/60 dark:border-red-900/50 inline-block">
              Үнэгүй турших
            </span>
          </div>

          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight mt-3">Бизнесээ бүртгүүлэх</h1>
          <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm mt-1">Хэдхэн жилийн дотор харилцагчийн базаа бүрдүүлээрэй</p>
        </div>

        {/* Алдаа болон амжилтын мессеж */}
        {error && (
          <div className="bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 p-3 rounded-xl text-xs sm:text-sm mb-4 font-bold text-center animate-in fade-in">
            {error}
          </div>
        )}
        {success && (
          <div className="bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300 p-3 rounded-xl text-xs sm:text-sm mb-4 font-bold flex items-center justify-center gap-2 animate-in fade-in">
            <CheckCircle2 size={18} className="shrink-0" /> Бүртгэлийн хүсэлтийг хүлээн авлаа. Имэйлээ шалгана уу. Нэвтрэх хуудас руу шилжиж байна...
          </div>
        )}

        {/* Form */}
        <form className="space-y-4" onSubmit={handleSubmit}>
          {/* Бизнесийн нэр */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              Бизнесийн нэр
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-400 dark:text-slate-500">
                <Building2 size={18} />
              </span>
              <input 
                type="text" 
                name="companyName"
                required
                value={formData.companyName}
                onChange={handleChange}
                placeholder="Жнь: Авто засвар ХХК" 
                className="w-full pl-11 pr-4 py-3.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-2xl text-slate-900 dark:text-white text-sm focus:outline-none focus:border-red-500 dark:focus:border-red-400 focus:bg-white dark:focus:bg-slate-800 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500"
              />
            </div>
          </div>

          {/* Овог болон Нэр */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                Овог
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 dark:text-slate-500">
                  <User size={16} />
                </span>
                <input 
                  type="text" 
                  name="lastName"
                  required
                  value={formData.lastName}
                  onChange={handleChange}
                  placeholder="Овог" 
                  className="w-full pl-9 pr-3.5 py-3.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-2xl text-slate-900 dark:text-white text-sm focus:outline-none focus:border-red-500 dark:focus:border-red-400 focus:bg-white dark:focus:bg-slate-800 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                Нэр
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 dark:text-slate-500">
                  <User size={16} />
                </span>
                <input 
                  type="text" 
                  name="firstName"
                  required
                  value={formData.firstName}
                  onChange={handleChange}
                  placeholder="Нэр" 
                  className="w-full pl-9 pr-3.5 py-3.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-2xl text-slate-900 dark:text-white text-sm focus:outline-none focus:border-red-500 dark:focus:border-red-400 focus:bg-white dark:focus:bg-slate-800 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500"
                />
              </div>
            </div>
          </div>

          {/* Имэйл хаяг */}
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

          {/* Нууц үг */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              Нууц үг үүсгэх
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-4 flex items-center z-10 pointer-events-none text-slate-400 dark:text-slate-500">
                <Lock size={18} />
              </span>
              <PasswordInput
                name="password"
                required
                minLength={6}
                value={formData.password}
                onChange={handleChange}
                placeholder="••••••••" 
                className="w-full pl-11 pr-11 py-3.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-2xl text-slate-900 dark:text-white text-sm focus:outline-none focus:border-red-500 dark:focus:border-red-400 focus:bg-white dark:focus:bg-slate-800 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500"
              />
            </div>
          </div>

          {/* Submit товч */}
          <button 
            type="submit"
            disabled={loading}
            className="w-full mt-2 inline-flex items-center justify-center gap-2 bg-linear-to-r from-red-600 to-red-500 hover:from-red-700 hover:to-red-600 text-white font-extrabold px-6 py-4 rounded-2xl shadow-lg shadow-red-500/20 dark:shadow-none transition-all hover:scale-[1.01] disabled:opacity-70 text-sm cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 size={18} className="animate-spin" /> Бүртгэж байна...
              </>
            ) : (
              <>
                Бүртгүүлэх (Үнэгүй) <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        {/* Footer Link */}
        <div className="text-center mt-6 sm:mt-8 pt-6 border-t border-slate-100 dark:border-slate-800 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
          Аль хэдийн бүртгэлтэй юу?{' '}
          <Link href="/login" className="font-bold text-red-600 dark:text-red-400 hover:underline">
            Нэвтрэх
          </Link>
        </div>

      </div>
    </div>
  );
}