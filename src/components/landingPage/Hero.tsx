import Link from 'next/link';
import { ArrowRight, Sparkles, ShieldCheck, QrCode, CalendarClock, Users } from 'lucide-react';

export default function Hero() {
  return (
    <section className="relative pt-32 sm:pt-40 pb-20 sm:pb-32 overflow-hidden w-full bg-white dark:bg-slate-950 transition-colors duration-300">
      {/* Subtle modern accent glow */}
      <div className="absolute top-10 left-1/2 -translate-x-1/2 w-72 h-72 sm:w-150 sm:h-75 bg-red-50/80 dark:bg-red-950/20 blur-[100px] sm:blur-[120px] rounded-full pointer-events-none -z-10" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10">
        <div className="grid lg:grid-cols-12 gap-10 lg:gap-12 items-center">
          
          {/* ЗҮҮН ТАЛ: Active CRM үйлчилгээг харуулсан UI карт */}
          <div className="lg:col-span-6 order-2 lg:order-1">
            <div className="bg-slate-50/90 dark:bg-slate-900/90 backdrop-blur-xl border border-slate-100 dark:border-slate-800 p-5 sm:p-8 rounded-3xl shadow-xl shadow-slate-200/50 dark:shadow-none relative">
              
              {/* Floating Badge */}
              <div className="absolute -top-3 -right-2 sm:-top-4 sm:-right-4 bg-linear-to-r from-red-600 to-red-500 text-white text-[10px] sm:text-xs font-bold px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-2xl shadow-lg flex items-center gap-1.5">
                <Sparkles size={14} /> Live Preview
              </div>

              <div className="mb-5 sm:mb-6">
                <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/50 px-3 py-1 rounded-full inline-block">
                  Active CRM Удирдлага
                </span>
                <h3 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white mt-2">
                  Үйлчлүүлэгчийн ухаалаг урсгал
                </h3>
              </div>

              {/* Mockup UI items */}
              <div className="space-y-3 sm:space-y-4">
                <div className="flex items-center gap-3.5 sm:gap-4 bg-white dark:bg-slate-800/80 p-3.5 sm:p-4 rounded-2xl border border-slate-100 dark:border-slate-700/50 shadow-xs">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 rounded-xl flex items-center justify-center shrink-0">
                    <QrCode size={22} />
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100">QR Анкетын бүртгэл</h4>
                    <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">Үйлчлүүлэгч утсаараа шууд мэдээллээ үлдээнэ</p>
                  </div>
                </div>

                <div className="flex items-center gap-3.5 sm:gap-4 bg-white dark:bg-slate-800/80 p-3.5 sm:p-4 rounded-2xl border border-slate-100 dark:border-slate-700/50 shadow-xs">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 rounded-xl flex items-center justify-center shrink-0">
                    <CalendarClock size={22} />
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100">Оочер зохицуулагч</h4>
                    <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">Автоматаар эрт захиалга авах сануулга</p>
                  </div>
                </div>

                <div className="flex items-center gap-3.5 sm:gap-4 bg-white dark:bg-slate-800/80 p-3.5 sm:p-4 rounded-2xl border border-slate-100 dark:border-slate-700/50 shadow-xs">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-xl flex items-center justify-center shrink-0">
                    <Users size={22} />
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100">Байнгын харилцагчдын сан</h4>
                    <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">Үсчин, авто засвар, дэлгүүрийн бүх дата нэг дор</p>
                  </div>
                </div>
              </div>

              {/* Bottom mini status */}
              <div className="mt-5 sm:mt-6 pt-4 border-t border-slate-200/60 dark:border-slate-800 flex items-center justify-between text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 font-medium">
                <span>Бүртгэгдсэн харилцагч: <strong className="text-red-600 dark:text-red-400">1,240+</strong></span>
                <span className="text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-1 rounded-full font-bold">● Идэвхтэй</span>
              </div>
            </div>
          </div>

          {/* БАРУУН ТАЛ: Текстэн контент карт */}
          <div className="lg:col-span-6 text-center lg:text-left order-1 lg:order-2">
            <div className="inline-flex items-center gap-2 bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300 px-3.5 py-1.5 rounded-full text-xs font-bold mb-5 sm:mb-6 border border-red-100/80 dark:border-red-900/50 shadow-xs">
              <Sparkles size={14} className="text-red-600 dark:text-red-400 animate-pulse" /> Жижиг дунд бизнесүүдэд зориулсан шинэ үеийн CRM
            </div>
            
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 dark:text-white tracking-tight leading-[1.15]">
              Үйлчлүүлэгчдийнхээ мэдээллийг алдаж, оочер дарааллаас болж <span className="text-transparent bg-clip-text bg-linear-to-r from-red-600 to-red-500 dark:from-red-400 dark:to-red-300 underline decoration-red-200 dark:decoration-red-900">орлогоо бүү алд.</span>
            </h1>
            
            <p className="mt-4 sm:mt-6 text-sm sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed font-normal">
              &quot;Active CRM&quot; систем нь авто засвар, үсчин, худалдааны газруудад хэрэглэгчийн мэдээллийг хялбар цуглуулж, улирлын ачааллыг урьдчилан зохицуулах боломжийг олгоно.
            </p>

            <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3 sm:gap-4">
              <Link 
                href="/register" 
                className="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white font-bold px-7 py-4 rounded-2xl shadow-xl shadow-red-500/25 flex items-center justify-center gap-2 group transition-all hover:-translate-y-0.5 text-sm cursor-pointer"
              >
                Системийг үнэгүй туршиж үзэх 
                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </Link>
              <a 
                href="#features" 
                className="w-full sm:w-auto bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-800 font-bold px-7 py-4 rounded-2xl transition-all shadow-xs text-center text-sm cursor-pointer"
              >
                Хэрхэн ажилладаг вэ?
              </a>
            </div>

            {/* Mini Trust badges */}
            <div className="mt-8 sm:mt-10 flex flex-wrap items-center justify-center lg:justify-start gap-4 sm:gap-6 text-xs font-semibold text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1.5"><ShieldCheck size={16} className="text-red-600 dark:text-red-400" /> Найдвартай дата хадгалалт</span>
              <span className="flex items-center gap-1.5"><Sparkles size={16} className="text-red-600 dark:text-red-400" /> Хэрэглэхэд хялбар UI</span>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}