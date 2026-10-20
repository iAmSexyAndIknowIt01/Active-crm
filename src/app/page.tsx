import Header from "../components/landingPage/Header";
import Hero from "../components/landingPage/Hero";
import ProblemSolution from "../components/landingPage/ProblemSolution";
import Features from "../components/landingPage/Features";
import Testimonial from "../components/landingPage/Testimonial";
import FooterCTA from "../components/landingPage/FooterCTA";

export default function Home() {
  return (
    <div className="flex flex-col flex-1 min-h-screen items-center justify-between bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans selection:bg-red-600 selection:text-white transition-colors duration-300">
      <main className="flex flex-col w-full items-center justify-center">
        {/* JS ажиллахгүй үед scroll-оор гарч ирэх хэсгүүд нуугдаж үлдэхээс сэргийлнэ */}
        <noscript>
          <style>{'.reveal{opacity:1;transform:none}'}</style>
        </noscript>
        <Header />
        <Hero />
        <ProblemSolution />
        <Features />
        <Testimonial />
        <FooterCTA />
      </main>
    </div>
  );
}