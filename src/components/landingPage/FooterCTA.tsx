import Link from 'next/link';
import Reveal from './Reveal';
import { ArrowRight, Sparkles } from 'lucide-react';

export default function FooterCTA() {
  return (
    <section className="py-28 bg-white dark:bg-slate-950 border-t border-red-100/60 dark:border-slate-800 w-full relative overflow-hidden transition-colors duration-300">
      
      {/* Blueprint Grid Pattern */}
      <div 
        className="absolute inset-0 opacity-[0.35] dark:opacity-[0.08] pointer-events-none -z-10"
        style={{
          backgroundImage: `
            linear-gradient(to right, #fecaca 1px, transparent 1px),
            linear-gradient(to bottom, #fecaca 1px, transparent 1px),
            linear-gradient(to right, #fee2e2 1px, transparent 1px),
            linear-gradient(to bottom, #fee2e2 1px, transparent 1px)
          `,
          backgroundSize: '128px 128px, 128px 128px, 32px 32px, 32px 32px',
          backgroundPosition: '0 0, 0 0, 0 0, 0 0'
        }}
      />

      {/* Decorative soft glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-150 h-75 bg-red-100/50 dark:bg-red-900/10 blur-[120px] rounded-full pointer-events-none -z-10" />

      <div className="max-w-5xl mx-auto px-6 relative z-10">
        
        <Reveal variant="zoom">
        <div className="bg-linear-to-br from-slate-900 via-slate-800 to-red-950 dark:from-slate-900 dark:via-slate-950 dark:to-slate-900 text-white rounded-3xl p-10 sm:p-16 text-center relative overflow-hidden shadow-2xl shadow-red-900/20 border border-slate-800 dark:border-slate-800">
          
          {/* Background decorative circle */}
          <div className="absolute top-0 right-0 w-72 h-72 bg-red-600/20 rounded-bl-full blur-2xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-72 h-72 bg-red-500/10 rounded-tr-full blur-2xl pointer-events-none" />

          <div className="relative z-10 max-w-2xl mx-auto">
            <span className="text-xs font-bold uppercase tracking-widest text-red-300 bg-red-500/10 px-3.5 py-1.5 rounded-full border border-red-400/20 inline-flex items-center gap-1.5 mb-6 shadow-sm">
              <Sparkles size={14} className="text-red-300" /> Таны бизнесийн шинэ эхлэл
            </span>

            <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-white leading-tight">
              Бизнесээ дараагийн түвшинд <span className="text-transparent bg-clip-text bg-linear-to-r from-red-400 to-red-300">гаргахад бэлэн үү?</span>
            </h2>

            <p className="text-slate-300 mt-4 mb-10 text-base sm:text-lg leading-relaxed">
              Өнөөдөр үнэгүй бүртгүүлээд үйлчлүүлэгчдийнхээ суурийг найдвартай хадгалж, эргэх холбоогоо сайжруулаарай.
            </p>

            <Link 
              href="/register" 
              className="inline-flex items-center gap-2.5 bg-linear-to-r from-red-500 to-red-500 hover:from-red-600 hover:to-red-600 text-white font-extrabold px-8 py-4 rounded-2xl shadow-xl shadow-red-500/30 transition-all hover:scale-[1.02] hover:-translate-y-0.5 group"
            >
              Бүртгүүлж эхлэх (Үнэгүй) <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>

        </div>
        </Reveal>

      </div>
    </section>
  );
}