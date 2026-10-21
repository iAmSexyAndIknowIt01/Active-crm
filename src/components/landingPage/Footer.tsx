import Link from 'next/link';
import BrandLogo from '@/src/components/BrandLogo';
import { getCachedSiteContent } from '@/src/lib/site-content';

// Холбоо барих мэдээлэл, сэтгэгдлийн холбоосыг платформын контентоос (кэштэй) авна
export default async function Footer() {
  const { contact, testimonial } = await getCachedSiteContent();
  const showTestimonial = testimonial.enabled && !!testimonial.quote;
  const contactItems = [contact.phone, contact.email, contact.address].filter(Boolean);
  return (
    <footer className="border-t border-red-100/60 dark:border-slate-800 py-12 bg-white dark:bg-slate-950 text-slate-500 dark:text-slate-400 text-sm w-full relative overflow-hidden transition-colors">
      
      {/* Blueprint Grid Pattern (Цэнхэр зураасан торлог - Dark mode үед бүдэг харагдана) */}
      <div 
        className="absolute inset-0 opacity-[0.25] dark:opacity-10 pointer-events-none -z-10"
        style={{
          backgroundImage: `
            linear-gradient(to right, #fecaca 1px, transparent 1px),
            linear-gradient(to bottom, #fecaca 1px, transparent 1px)
          `,
          backgroundSize: '32px 32px'
        }}
      />

      <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-6 relative z-10">
        
        {/* Logo & Brief Description */}
        <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
          <BrandLogo markClassName="w-8 h-8" />
          <span className="hidden sm:inline text-slate-300 dark:text-slate-700">|</span>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Бизнесийн харилцагчийн ухаалаг менежментийн систем
          </span>
        </div>

        {/* Links */}
        <div className="flex items-center gap-6 text-xs font-medium">
          <Link href="#problem" className="hover:text-red-600 dark:hover:text-red-400 transition-colors">Давуу тал</Link>
          <Link href="#features" className="hover:text-red-600 dark:hover:text-red-400 transition-colors">Боломжууд</Link>
          {showTestimonial && (
            <Link href="#testimonials" className="hover:text-red-600 dark:hover:text-red-400 transition-colors">Сэтгэгдэл</Link>
          )}
        </div>

        <div className="text-xs text-slate-400 dark:text-slate-500 text-center sm:text-right space-y-1">
          {contactItems.length > 0 && <p className="text-slate-500 dark:text-slate-400">{contactItems.join(' · ')}</p>}
          <p>
          &copy; {new Date().getFullYear()} Active CRM. Бүх эрх хуулиар хамгаалагдсан.
          </p>
        </div>

      </div>
    </footer>
  );
}