import { QrCode, Users, CalendarCheck } from 'lucide-react';
import Reveal from './Reveal';

export default function Features() {
  return (
    <section id="features" className="py-28 bg-white dark:bg-slate-950 border-y border-red-100/60 dark:border-slate-800 w-full relative overflow-hidden transition-colors duration-300">
      
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
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-150 h-75 bg-red-100/40 dark:bg-red-900/10 blur-[120px] rounded-full pointer-events-none -z-10" />

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        
        {/* Section Heading */}
        <Reveal className="text-center max-w-3xl mx-auto mb-20">
          <span className="text-xs font-bold uppercase tracking-widest text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/60 px-3.5 py-1.5 rounded-full border border-red-100/60 dark:border-red-900 shadow-sm">
            Боломжууд
          </span>
          <h2 className="text-3xl sm:text-5xl font-black text-slate-900 dark:text-white tracking-tight mt-4">
            Үндсэн <span className="text-shimmer">боломжууд</span>
          </h2>
          <p className="text-slate-600 dark:text-slate-300 mt-4 text-base sm:text-lg leading-relaxed">
            ЖДБ эрхлэгчдэд яг хэрэгтэй, илүү дутуу зүйлгүй хөнгөн бөгөөд хурдан шийдэл.
          </p>
        </Reveal>

        {/* Grid Container */}
        <div className="grid md:grid-cols-3 gap-8">
          
          <Reveal delay={0} className="h-full">
            <div className="h-full bg-white/95 dark:bg-slate-900/90 backdrop-blur-sm p-8 rounded-3xl border border-slate-200/80 dark:border-slate-800 hover:border-red-300 dark:hover:border-red-700 transition-all duration-300 shadow-sm hover:shadow-xl hover:shadow-red-500/10 hover:-translate-y-1.5 group">
              <div className="w-14 h-14 bg-red-600 dark:bg-red-600 text-white rounded-2xl flex items-center justify-center mb-6 shadow-md shadow-red-500/20 group-hover:scale-110 group-hover:-rotate-6 transition-transform duration-300">
                <QrCode size={26} />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3">Хурдан бүртгэл</h3>
              <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed">
                QR код уншуулах эсвэл өдөр тутмын Excel файлаасаа харилцагчийн мэдээллээ хялбархан бүрдүүлнэ.
              </p>
            </div>
          </Reveal>

          <Reveal delay={150} className="h-full">
            <div className="h-full bg-white/95 dark:bg-slate-900/90 backdrop-blur-sm p-8 rounded-3xl border border-slate-200/80 dark:border-slate-800 hover:border-red-300 dark:hover:border-red-700 transition-all duration-300 shadow-sm hover:shadow-xl hover:shadow-red-500/10 hover:-translate-y-1.5 group">
              <div className="w-14 h-14 bg-red-500 text-white rounded-2xl flex items-center justify-center mb-6 shadow-md shadow-red-500/20 group-hover:scale-110 group-hover:-rotate-6 transition-transform duration-300">
                <Users size={26} />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3">Зорилтот холбоо</h3>
              <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed">
                Үйлчлүүлэгчдийг ангилж, шаардлагатай цагт нь эргэн холбогдон давтан үйлчлүүлэгчдийн урсгалыг нэмэгдүүлнэ.
              </p>
            </div>
          </Reveal>

          <Reveal delay={300} className="h-full">
            <div className="h-full bg-white/95 dark:bg-slate-900/90 backdrop-blur-sm p-8 rounded-3xl border border-slate-200/80 dark:border-slate-800 hover:border-red-300 dark:hover:border-red-700 transition-all duration-300 shadow-sm hover:shadow-xl hover:shadow-red-500/10 hover:-translate-y-1.5 group">
              <div className="w-14 h-14 bg-red-700 text-white rounded-2xl flex items-center justify-center mb-6 shadow-md shadow-red-700/20 group-hover:scale-110 group-hover:-rotate-6 transition-transform duration-300">
                <CalendarCheck size={26} />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3">Эрэлт хяналт</h3>
              <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed">
                Аль сард оочер үүсдэгийг урьдчилан харж, улирлын ачааллаа оновчтой хуваарилаарай.
              </p>
            </div>
          </Reveal>

        </div>

      </div>
    </section>
  );
}