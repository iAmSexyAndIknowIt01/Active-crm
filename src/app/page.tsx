import Header from "../components/landingPage/Header";
import Hero from "../components/landingPage/Hero";
import ProblemSolution from "../components/landingPage/ProblemSolution";
import Features from "../components/landingPage/Features";
import Testimonial from "../components/landingPage/Testimonial";
import FooterCTA from "../components/landingPage/FooterCTA";
import { getCachedSiteContent } from "../lib/site-content";

// Платформын контент (сэтгэгдэл) өөрчлөгдөхөд хадгалах үед шууд, эс бөгөөс 5 минут тутам шинэчлэгдэнэ
export const revalidate = 300;

export default async function Home() {
  const { testimonial } = await getCachedSiteContent();
  const showTestimonial = testimonial.enabled && !!testimonial.quote;
  return (
    <div className="flex flex-col flex-1 min-h-screen items-center justify-between bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans selection:bg-red-600 selection:text-white transition-colors duration-300">
      <main className="flex flex-col w-full items-center justify-center">
        {/* JS ажиллахгүй үед scroll-оор гарч ирэх хэсгүүд нуугдаж үлдэхээс сэргийлнэ */}
        <noscript>
          <style>{'.reveal{opacity:1;transform:none}'}</style>
        </noscript>
        <Header showTestimonial={showTestimonial} />
        <Hero />
        <ProblemSolution />
        <Features />
        {showTestimonial && <Testimonial quote={testimonial.quote} author={testimonial.author} role={testimonial.role} />}
        <FooterCTA />
      </main>
    </div>
  );
}