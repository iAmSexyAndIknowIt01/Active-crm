import Reveal from './Reveal';

export default function Testimonial() {
  return (
    <section id="testimonials" className="py-28 bg-linear-to-br from-red-600 via-red-700 to-red-700 dark:from-red-950 dark:via-slate-900 dark:to-red-950 text-white relative overflow-hidden w-full transition-colors duration-300">
      
      {/* Blueprint Grid Pattern */}
      <div 
        className="absolute inset-0 opacity-[0.15] pointer-events-none -z-10"
        style={{
          backgroundImage: `
            linear-gradient(to right, #ffffff 1px, transparent 1px),
            linear-gradient(to bottom, #ffffff 1px, transparent 1px)
          `,
          backgroundSize: '48px 48px'
        }}
      />

      {/* Decorative soft glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-150 h-75 bg-red-400/20 blur-[120px] rounded-full pointer-events-none -z-10" />

      <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
        
        <Reveal variant="zoom">
        <div className="text-red-200 font-bold text-xs uppercase tracking-widest mb-6 bg-white/10 inline-block px-4 py-1.5 rounded-full backdrop-blur-md border border-white/10 shadow-sm">
          Бодит үр дүн
        </div>

        <blockquote className="text-xl sm:text-3xl font-medium leading-relaxed italic mb-10 text-red-50">
          &quot;Өмнө нь манайх дэвтэр дээр үйлчлүүлэгчдийнхээ нэрийг бичдэг байсан ч хэрэг болох үед олдохгүй хоцрох тоо томшгүй олон байсан. Active CRM системд шилжсэнээр 7-р сарын оочер үүсдэг асуудлаа 5-р сараас эхлэн захиалга аваад амархан зохицууллаа.&quot;
        </blockquote>

        <div className="inline-block bg-white/10 backdrop-blur-md px-6 py-3 rounded-2xl border border-white/15 shadow-inner">
          <div className="font-extrabold text-lg text-white">Авто засварын газрын эзэн</div>
          <div className="text-xs text-red-200 mt-0.5">Active CRM системийг амжилттай туршиж буй хэрэглэгч</div>
        </div>
        </Reveal>

      </div>
    </section>
  );
}