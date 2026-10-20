'use client';

import { useState, useRef, useEffect } from 'react';
import { LayoutDashboard, Database, Settings, LogOut, User, BarChart3, ChevronDown, Menu, X, FileText, Users, UserCheck, Briefcase, Wrench, CalendarCheck, Sun, Moon, BellRing } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { BrandMark } from '@/src/components/BrandLogo';

interface UserData {
  email: string;
  first_name: string;
  last_name: string;
  role?: 'admin' | 'employee';
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [settingsDropdownOpen, setSettingsDropdownOpen] = useState(false);
  const [mobileSettingsOpen, setMobileSettingsOpen] = useState(false);

  // Theme state (Гэрэлтэй/Харанхуй горим)
  const [isDarkMode, setIsDarkMode] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const settingsDropdownRef = useRef<HTMLDivElement>(null);

  const [userData, setUserData] = useState<UserData | null>(null);

  // LocalStorage-оос theme төлөвийг уншиж эхлүүлэх
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    const initialDark = savedTheme === 'dark' || (!savedTheme && prefersDark);
    setIsDarkMode(initialDark);
    
    if (initialDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  // Theme сольж хувиргах функц болон localStorage рүү хадгалах
  const toggleTheme = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    
    if (newMode) {
      localStorage.setItem('theme', 'dark');
      document.documentElement.classList.add('dark');
    } else {
      localStorage.setItem('theme', 'light');
      document.documentElement.classList.remove('dark');
    }
  };

  // Цэсийг session-ий role (mt_user.role)-оор шүүнэ: админ бүх цэсийг, ажилтан зөвхөн "Ажил" цэсийг харна.
  // Role ачаалагдах хүртэл цэс харуулахгүй (админд ажилтны цэс, эсрэгээр анивчихаас сэргийлнэ).
  // Эрхийн жинхэнэ шалгалт API дээр хийгдэнэ.
  const isAdmin = userData?.role === 'admin';

  const navItems = !userData ? [] : [
    { href: '/dashboard', icon: LayoutDashboard, label: 'Удирдлага' },
    { href: '/dashboard/data', icon: Database, label: 'Өгөгдөл' },
    { href: '/dashboard/customers', icon: UserCheck, label: 'Харилцагч' },
    { href: '/dashboard/reservations', icon: CalendarCheck, label: 'Захиалга' },
    { href: '/dashboard/workshop', icon: Wrench, label: 'Ажил', employeeVisible: true },
    { href: '/dashboard/analytics', icon: BarChart3, label: 'Аналитик' },
  ].filter((item) => isAdmin || item.employeeVisible);

  // Тохиргооны доошоо унадаг дэд цэсүүд (зөвхөн админд)
  const settingsSubItems = !isAdmin ? [] : [
    { href: '/dashboard/employees', icon: Users, label: 'Ажилчид' },
    { href: '/dashboard/services', icon: Briefcase, label: 'Үйлчилгээ' },
    { href: '/dashboard/my-anket', icon: FileText, label: 'Анкет' },
    { href: '/dashboard/reminders', icon: BellRing, label: 'Сануулга' },
    { href: '/dashboard/settings', icon: Settings, label: 'Ерөнхий тохиргоо' },
  ];

  // Хэрэглэгчийн мэдээллийг API-аас татах
  useEffect(() => {
    async function fetchUserData() {
      try {
        const res = await fetch('/api/user');
        const json = await res.json();
        if (json.success && json.data) {
          setUserData(json.data);
        }
      } catch (err) {
        console.error('Failed to load user data:', err);
      }
    }
    fetchUserData();
  }, []);

  // Цэснээс гадна дархад хаагдах логик
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
      if (settingsDropdownRef.current && !settingsDropdownRef.current.contains(event.target as Node)) {
        setSettingsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (err) {
      console.error('Logout failed:', err);
    }
    router.replace('/login');
    router.refresh();
  };

  // Овог нэрийн эхний үсгийг гаргах
  const getInitials = () => {
    if (!userData) return 'КО';
    const lastInitial = userData.last_name ? userData.last_name.charAt(0) : '';
    const firstInitial = userData.first_name ? userData.first_name.charAt(0) : '';
    const initials = (lastInitial + firstInitial).toUpperCase();
    return initials || 'КО';
  };

  // Хэрэглэгчийн бүтэн нэрийг гаргах
  const getFullName = () => {
    if (!userData) return 'Хэрэглэгч';
    const last = userData.last_name || '';
    const first = userData.first_name || '';
    return `${last} ${first}`.trim() || 'Хэрэглэгч';
  };

  // Тухайн дэд цэс идэвхтэй эсэхийг шалгах
  const isSettingsActive = settingsSubItems.some((sub) => pathname.startsWith(sub.href));

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 flex flex-col transition-colors">
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-8 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-4 sm:gap-6">
          <button 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            aria-label="Menu"
          >
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>

          <div className="flex items-center gap-2.5">
            <BrandMark className="w-9 h-9" />
            <span className="font-extrabold text-lg text-slate-900 dark:text-white hidden sm:inline">
              Active <span className="text-red-600 dark:text-red-500">CRM</span>
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-1 lg:gap-2">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2 px-3 lg:px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                  pathname === item.href 
                    ? 'bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400' 
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <item.icon size={18} />
                {item.label}
              </Link>
            ))}

            {/* Тохиргоо болон Submenu */}
            {settingsSubItems.length > 0 && (
            <div className="relative" ref={settingsDropdownRef}>
              <button
                onClick={() => setSettingsDropdownOpen(!settingsDropdownOpen)}
                className={`flex items-center gap-2 px-3 lg:px-4 py-2 rounded-xl text-sm font-bold transition-all cursor-pointer ${
                  isSettingsActive 
                    ? 'bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400' 
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Settings size={18} />
                Тохиргоо
                <ChevronDown size={14} className={`transition-transform ${settingsDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {settingsDropdownOpen && (
                <div className="absolute left-0 mt-2 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl py-2 z-50">
                  {settingsSubItems.map((sub) => (
                    <Link
                      key={sub.href}
                      href={sub.href}
                      onClick={() => setSettingsDropdownOpen(false)}
                      className={`flex items-center gap-2.5 px-4 py-2.5 text-xs font-bold transition-colors ${
                        pathname === sub.href
                          ? 'bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400'
                          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      <sub.icon size={16} className="text-slate-500 dark:text-slate-400" />
                      {sub.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
            )}
          </nav>
        </div>

        {/* Actions Right Side: ThemeToggle & User Profile */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            className="p-2.5 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-2xl border border-slate-200/80 dark:border-slate-700 transition-all cursor-pointer"
            aria-label="Toggle Theme"
          >
            {isDarkMode ? <Sun size={18} className="text-amber-500" /> : <Moon size={18} className="text-slate-600" />}
          </button>

          {/* User Profile & Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button 
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2 sm:gap-3 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 px-2.5 sm:px-3 py-2 rounded-2xl border border-slate-200/80 dark:border-slate-700 transition-all cursor-pointer"
            >
              <div className="w-8 h-8 bg-red-600 text-white rounded-xl flex items-center justify-center font-bold text-xs shadow-sm shrink-0">
                {getInitials()}
              </div>
              <ChevronDown size={16} className={`text-slate-500 dark:text-slate-400 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 mt-2 w-60 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl py-2 z-50">
                <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 space-y-0.5">
                  <p className="text-xs text-slate-400 font-medium">Нэвтэрсэн хэрэглэгч</p>
                  <p className="text-sm font-extrabold text-slate-900 dark:text-white truncate">
                    {getFullName()}
                  </p>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate">
                    {userData?.email || 'info@company.mn'}
                  </p>
                </div>

                <Link 
                  href="/dashboard/profile" 
                  onClick={() => setDropdownOpen(false)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  <User size={16} className="text-slate-500 dark:text-slate-400" /> Профайл
                </Link>

                <div className="h-px bg-slate-100 dark:bg-slate-800 my-1" />

                <button 
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/35 transition-colors cursor-pointer"
                >
                  <LogOut size={16} /> Гарах
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden absolute top-full left-0 w-full bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-3 space-y-1 shadow-xl z-50 max-h-[80vh] overflow-y-auto">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                  pathname === item.href 
                    ? 'bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400' 
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <item.icon size={18} />
                {item.label}
              </Link>
            ))}

            {/* Mobile Settings Accordion */}
            {settingsSubItems.length > 0 && (
            <div>
              <button
                onClick={() => setMobileSettingsOpen(!mobileSettingsOpen)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                  isSettingsActive ? 'bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Settings size={18} /> Тохиргоо
                </div>
                <ChevronDown size={16} className={`transition-transform ${mobileSettingsOpen ? 'rotate-180' : ''}`} />
              </button>

              {mobileSettingsOpen && (
                <div className="pl-6 py-1 space-y-1 border-l-2 border-slate-100 dark:border-slate-800 ml-4 my-1">
                  {settingsSubItems.map((sub) => (
                    <Link
                      key={sub.href}
                      href={sub.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                        pathname === sub.href ? 'bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      <sub.icon size={16} />
                      {sub.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
            )}
          </div>
        )}
      </header>
      
      <main className="flex-1 p-4 sm:p-8 max-w-7xl w-full mx-auto">{children}</main>
    </div>
  );
}