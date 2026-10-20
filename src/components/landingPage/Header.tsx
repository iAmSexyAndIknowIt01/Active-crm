'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Menu, X } from 'lucide-react';
import ThemeToggle from '@/src/components/ThemeToggle'; // ThemeToggle байрлах замыг шалгана уу
import BrandLogo from '@/src/components/BrandLogo';

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLinkClick = () => {
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-50 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-100 dark:border-slate-800 w-full transition-all">
      {/* Хуудсыг хэр scroll хийснийг харуулах шугам */}
      <div aria-hidden className="scroll-progress absolute left-0 bottom-0 h-0.5 w-full bg-linear-to-r from-red-600 to-red-400 pointer-events-none" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
        
        {/* Logo Section */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <BrandLogo markClassName="w-8 h-8 sm:w-9 sm:h-9 group-hover:scale-105 transition-transform" textClassName="text-base sm:text-lg" />
        </Link>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-semibold text-slate-600 dark:text-slate-300">
          <a href="#problem" className="hover:text-red-600 dark:hover:text-red-400 transition-colors">Давуу тал</a>
          <a href="#features" className="hover:text-red-600 dark:hover:text-red-400 transition-colors">Боломжууд</a>
          <a href="#testimonials" className="hover:text-red-600 dark:hover:text-red-400 transition-colors">Сэтгэгдэл</a>
        </nav>

        {/* Desktop Action Buttons & Theme Toggle */}
        <div className="hidden md:flex items-center gap-3">
          <ThemeToggle />
          <Link 
            href="/login" 
            className="text-sm font-bold text-slate-700 dark:text-slate-200 hover:text-red-600 dark:hover:text-red-400 transition-colors px-3 py-1.5"
          >
            Нэвтрэх
          </Link>
          <Link 
            href="/register" 
            className="inline-flex items-center gap-1.5 bg-linear-to-r from-red-600 to-red-500 hover:from-red-700 hover:to-red-600 text-white text-xs sm:text-sm font-extrabold px-4 py-2 rounded-xl shadow-md shadow-red-500/20 hover:shadow-red-500/30 hover:-translate-y-0.5 transition-all duration-200 cursor-pointer"
          >
            Бүртгүүлэх <ArrowRight size={14} />
          </Link>
        </div>

        {/* Mobile Right Section (Theme Toggle & Hamburger) */}
        <div className="flex md:hidden items-center gap-2">
          <ThemeToggle />
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-slate-700 dark:text-slate-200 hover:text-red-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            aria-label="Цэс нээх"
          >
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden absolute top-full left-0 w-full bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-xl px-6 py-5 space-y-4 animate-in fade-in slide-in-from-top-2">
          <nav className="flex flex-col space-y-3 text-sm font-bold text-slate-700 dark:text-slate-200">
            <a 
              href="#problem" 
              onClick={handleLinkClick}
              className="hover:text-red-600 dark:hover:text-red-400 transition-colors py-1"
            >
              Давуу тал
            </a>
            <a 
              href="#features" 
              onClick={handleLinkClick}
              className="hover:text-red-600 dark:hover:text-red-400 transition-colors py-1"
            >
              Боломжууд
            </a>
            <a 
              href="#testimonials" 
              onClick={handleLinkClick}
              className="hover:text-red-600 dark:hover:text-red-400 transition-colors py-1"
            >
              Сэтгэгдэл
            </a>
          </nav>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-2.5">
            <Link 
              href="/login" 
              onClick={handleLinkClick}
              className="w-full text-center font-bold text-slate-700 dark:text-slate-200 hover:text-red-600 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 py-3 rounded-xl transition-colors text-sm"
            >
              Нэвтрэх
            </Link>
            <Link 
              href="/register" 
              onClick={handleLinkClick}
              className="w-full inline-flex items-center justify-center gap-2 bg-linear-to-r from-red-600 to-red-500 hover:from-red-700 hover:to-red-600 text-white font-extrabold px-6 py-3 rounded-xl shadow-md shadow-red-500/20 transition-all text-sm"
            >
              Бүртгүүлэх <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}