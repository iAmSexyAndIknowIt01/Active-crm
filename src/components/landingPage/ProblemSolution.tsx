import { CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import Reveal from './Reveal';

export default function ProblemSolution() {
  return (
    <section id="problem" className="py-28 bg-[#fffafa] dark:bg-slate-900 border-y border-red-200/60 dark:border-slate-800 w-full relative overflow-hidden transition-colors duration-300">
      
      {/* Blueprint Grid Pattern */}
      <div 
        className="absolute inset-0 opacity-[0.7] dark:opacity-[0.1] pointer-events-none -z-10"
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
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-175 h-87.5 bg-red-200/50 dark:bg-red-900/20 blur-[140px] rounded-full pointer-events-none -z-10" />

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        
        {/* Section Heading */}
        <Reveal className="text-center max-w-3xl mx-auto mb-20">
          <span className="text-xs font-bold uppercase tracking-widest text-red-600 dark:text-red-400 bg-red-100/80 dark:bg-red-950/60 px-3.5 py-1.5 rounded-full border border-red-200 dark:border-red-900 shadow-sm">
            Яагаад зайлшгүй хэрэгтэй вэ?
          </span>
          <h2 className="text-3xl sm:text-5xl font-black text-slate-900 dark:text-white tracking-tight mt-4">
            Өдөр тутмын хүндрэлийг <span className="text-shimmer">хэрхэн шийдэх вэ?</span>
          </h2>
          <p className="text-slate-600 dark:text-slate-300 mt-4 text-base sm:text-lg leading-relaxed">
            Дэвтэр дэвтэр тэмдэглэл болон эмх замбараагүй оочер дарааллыг халж, бизнесийнхээ үр ашгийг бүрэн дээд хэмжээнд хүргээрэй.
          </p>
        </Reveal>

        {/* Grid Container */}
        <div className="grid lg:grid-cols-2 gap-8 items-stretch">
          
          {/* АСУУДАЛ: Хуучин арга барил */}
          <Reveal variant="left" className="h-full">
          <div className="h-full bg-white/95 dark:bg-slate-950/90 backdrop-blur-md border border-slate-200/90 dark:border-slate-800 p-8 sm:p-10 rounded-3xl shadow-sm relative overflow-hidden flex flex-col justify-between transition-all hover:shadow-md">
            <div className="absolute top-0 right-0 w-36 h-36 bg-red-100/30 dark:bg-red-950/30 rounded-bl-full pointer-events-none z-0" />
            
            <div className="relative z-10">
              <div className="flex items-center gap-2.5 mb-6">
                <div className="w-10 h-10 rounded-2xl bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 flex items-center justify-center font-bold">
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-red-600 dark:text-red-400">
                    Өнөөгийн нөхцөл байдал
                  </span>
                  <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">Бизнесийн алдаж буй боломж</h3>
                </div>
              </div>

              <ul className="space-y-5 text-slate-700 dark:text-slate-300 mt-6">
                <li className="flex items-start gap-3.5 bg-slate-50/90 dark:bg-slate-900/80 p-4 rounded-2xl border border-slate-200/70 dark:border-slate-800">
                  <XCircle className="text-red-500 dark:text-red-400 shrink-0 mt-0.5" size={22} />
                  <div>
                    <strong className="block text-slate-900 dark:text-white text-sm font-bold mb-0.5">Дата алдагдах</strong>
                    <span className="text-xs text-slate-600 dark:text-slate-400">Үйлчлүүлэгчийн утасны дугаар цаасан дээр тэмдэглэгдээд хаягдаж, эргэж холбогдох боломжгүй болдог.</span>
                  </div>
                </li>

                <li className="flex items-start gap-3.5 bg-slate-50/90 dark:bg-slate-900/80 p-4 rounded-2xl border border-slate-200/70 dark:border-slate-800">
                  <XCircle className="text-red-500 dark:text-red-400 shrink-0 mt-0.5" size={22} />
                  <div>
                    <strong className="block text-slate-900 dark:text-white text-sm font-bold mb-0.5">Улирлын ачаалал</strong>
                    <span className="text-xs text-slate-600 dark:text-slate-400">Авто засвар, үсчний оргил саруудад хүн багтахгүй буцаж, дараа нь ажилгүй суудаг тэнцвэргүй урсгал.</span>
                  </div>
                </li>

                <li className="flex items-start gap-3.5 bg-slate-50/90 dark:bg-slate-900/80 p-4 rounded-2xl border border-slate-200/70 dark:border-slate-800">
                  <XCircle className="text-red-500 dark:text-red-400 shrink-0 mt-0.5" size={22} />
                  <div>
                    <strong className="block text-slate-900 dark:text-white text-sm font-bold mb-0.5">Эргэх холбоогүй байдал</strong>
                    <span className="text-xs text-slate-600 dark:text-slate-400">Байнгын үйлчлүүлэгчдийнхээ түүхийг мэдэхгүйгээс болж үнэнч хэрэглэгчээ алдах эрсдэлтэй.</span>
                  </div>
                </li>
              </ul>
            </div>

            <div className="mt-8 pt-4 border-t border-slate-100 dark:border-slate-800 text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center justify-between">
              <span>Үр дүн: Цаг хугацаа болон орлого алдах</span>
              <span className="text-red-600 dark:text-red-400 font-bold">● Эрсдэлтэй</span>
            </div>
          </div>
          </Reveal>

          {/* ШИЙДЭЛ: Active CRM */}
          <Reveal variant="right" delay={150} className="h-full">
          <div className="h-full bg-linear-to-br from-red-600 via-red-700 to-red-700 text-white p-8 sm:p-10 rounded-3xl shadow-2xl shadow-red-500/20 relative overflow-hidden flex flex-col justify-between transition-all hover:scale-[1.01]">
            <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-bl-full pointer-events-none" />
            
            <div className="relative z-10">
              <div className="flex items-center gap-2.5 mb-6">
                <div className="w-10 h-10 rounded-2xl bg-white/20 text-white flex items-center justify-center font-bold backdrop-blur-md">
                  <CheckCircle2 size={20} />
                </div>
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-red-200">
                    Active CRM Шийдэл
                  </span>
                  <h3 className="text-xl font-extrabold text-white">Ухаалаг бөгөөд хялбар менежмент</h3>
                </div>
              </div>

              <ul className="space-y-5 text-red-50 mt-6">
                <li className="flex items-start gap-3.5 bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/15">
                  <CheckCircle2 className="text-red-300 shrink-0 mt-0.5" size={22} />
                  <div>
                    <strong className="block text-white text-sm font-bold mb-0.5">QR Анкетын систем</strong>
                    <span className="text-xs text-red-100">Үйлчлүүлэгч үүдэнд ирээд утсаараа шууд өөрийн мэдээллээ системд автоматаар үлдээнэ.</span>
                  </div>
                </li>

                <li className="flex items-start gap-3.5 bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/15">
                  <CheckCircle2 className="text-red-300 shrink-0 mt-0.5" size={22} />
                  <div>
                    <strong className="block text-white text-sm font-bold mb-0.5">Ухаалаг Excel болон Дата байршуулалт</strong>
                    <span className="text-xs text-red-100">Хуучин цаасан болон файлаар байсан датагаа нэг товчлуураар хялбархан оруулж нэгтгэнэ.</span>
                  </div>
                </li>

                <li className="flex items-start gap-3.5 bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/15">
                  <CheckCircle2 className="text-red-300 shrink-0 mt-0.5" size={22} />
                  <div>
                    <strong className="block text-white text-sm font-bold mb-0.5">Улирлын ачаалал зохицуулагч</strong>
                    <span className="text-xs text-red-100">Систем оочер үүсэхээс эрт захиалга авах ухаалаг сануулагч илгээж орлого тогтворжуулна.</span>
                  </div>
                </li>
              </ul>
            </div>

            <div className="mt-8 pt-4 border-t border-white/25 text-xs font-semibold text-red-100 flex items-center justify-between">
              <span>Үр дүн: Тогтвортой өсөлт ба найдвартай дата</span>
              <span className="text-emerald-300 bg-emerald-500/20 px-2.5 py-1 rounded-full font-bold flex items-center gap-1">
                ● Санал болгож буй
              </span>
            </div>
          </div>
          </Reveal>

        </div>

      </div>
    </section>
  );
}