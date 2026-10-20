'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Wrench, Plus, Search, Clock, CheckCircle2,
  X, LayoutList, LayoutGrid, User, Briefcase, ShieldAlert, RotateCcw, ChevronLeft, ChevronRight,
  SlidersHorizontal, ChevronDown, ArrowRight, Lock
} from 'lucide-react';
import Loading from '@/src/app/components/loading';
import SearchSelect from '@/src/app/components/SearchSelect';
import InfoTip from '@/src/app/components/InfoTip';
import { useFormValidation, FormErrorBanner } from '@/src/app/components/FormValidation';
import WorkFormFields, { emptyWorkForm, type WorkFormData, type WorkOptionData } from './WorkFormFields';

interface WorkItem {
  work_id: string;
  title: string;
  customer_type: 'individual' | 'company';
  customer_id: string | null;
  company_customer_id: string | null;
  customer_name: string;
  service_name: string | null;
  services: { service_id: number | null; service_name: string }[];
  assigned_employee: string;
  employee_name: string;
  price: number;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high';
  due_date: string;
  create_date: string;
  description: string;
  // Нэвтэрсэн хэрэглэгч засах эрхтэй эсэх (админ: бүгд, ажилтан: зөвхөн өөрийн хариуцсан)
  can_edit?: boolean;
}

// Засах эрхгүй ажлын гарчгийн хажууд харуулах тэмдэг
const ReadOnlyMark = () => (
  <span title="Өөр ажилтны ажил — зөвхөн харах" className="inline-flex text-slate-400 dark:text-slate-500 shrink-0">
    <Lock size={12} aria-label="Зөвхөн харах" />
  </span>
);

const serviceLabel = (work: WorkItem) => {
  const names = work.services?.map((s) => s.service_name) ?? [];
  if (names.length === 0) return 'Үйлчилгээ сонгоогүй';
  return names.length === 1 ? names[0] : `${names[0]} +${names.length - 1}`;
};

// ---- Шүүлтүүр ----

interface Filters {
  q: string;
  status: string;
  priority: string;
  customerType: string;
  employee: string; // 'all' | 'none' (хуваарилаагүй) | user_id
  service: string; // service_id
  customer: string; // 'i:<customer_id>' | 'c:<company_customer_id>'
  due: string; // 'all' | 'overdue' | 'today' | 'week' | 'month' | 'none' | 'custom'
  dueFrom: string;
  dueTo: string;
  createdFrom: string;
  createdTo: string;
  priceMin: string;
  priceMax: string;
  sort: string;
}

const DEFAULT_FILTERS: Filters = {
  q: '',
  status: 'all',
  priority: 'all',
  customerType: 'all',
  employee: 'all',
  service: '',
  customer: '',
  due: 'all',
  dueFrom: '',
  dueTo: '',
  createdFrom: '',
  createdTo: '',
  priceMin: '',
  priceMax: '',
  sort: 'newest',
};
const FILTER_KEYS = Object.keys(DEFAULT_FILTERS) as (keyof Filters)[];
// "Нэмэлт шүүлтүүр" хэсэгт байрлах талбарууд
const ADVANCED_KEYS: (keyof Filters)[] = ['service', 'customer', 'due', 'dueFrom', 'dueTo', 'createdFrom', 'createdTo', 'priceMin', 'priceMax'];

const STATUS_LABELS: Record<string, string> = {
  pending: 'Хүлээгдэж буй',
  in_progress: 'Хийгдэж байна',
  completed: 'Дууссан',
  cancelled: 'Цуцлагдсан',
};
const PRIORITY_LABELS: Record<string, string> = { low: 'Энгийн', medium: 'Дунд', high: 'Яаралтай' };
const DUE_LABELS: Record<string, string> = {
  overdue: 'Хугацаа хэтэрсэн',
  today: 'Өнөөдөр дуусах',
  week: 'Энэ 7 хоногт дуусах',
  month: 'Энэ сард дуусах',
  none: 'Хугацаагүй',
  custom: 'Хугацааны интервал',
};
const SORT_LABELS: Record<string, string> = {
  newest: 'Шинээр бүртгэсэн',
  oldest: 'Хуучнаар бүртгэсэн',
  due: 'Дуусах хугацаа ойр',
  price_desc: 'Үнэ их → бага',
  price_asc: 'Үнэ бага → их',
};

// Хэрэглэгчийн орон нутгийн цагаар YYYY-MM-DD
const toISODate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const workDate = (value: string | null | undefined) => (value ? toISODate(new Date(value)) : '');
const formatDate = (iso: string) => iso.replaceAll('-', '.');

function currentRanges() {
  const now = new Date();
  const mondayOffset = (now.getDay() + 6) % 7;
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - mondayOffset);
  const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
  return {
    today: toISODate(now),
    weekStart: toISODate(monday),
    weekEnd: toISODate(sunday),
    monthStart: toISODate(new Date(now.getFullYear(), now.getMonth(), 1)),
    monthEnd: toISODate(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
  };
}

const isOpenWork = (w: WorkItem) => w.status !== 'completed' && w.status !== 'cancelled';

const filterSelectClass =
  'w-full text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-50/70 dark:bg-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800 px-3 py-2 rounded-xl border border-slate-200/70 dark:border-slate-700 outline-none cursor-pointer focus:border-red-500 transition-all';
const filterInputClass =
  'w-full min-w-0 text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-50/70 dark:bg-slate-800/60 px-3 py-2 rounded-xl border border-slate-200/70 dark:border-slate-700 outline-none focus:border-red-500 transition-all';
const filterLabelClass = 'text-[10px] font-extrabold text-slate-400 uppercase tracking-wider';
const searchSelectFilterClass = 'px-3! bg-slate-50/70! dark:bg-slate-800/60! border-slate-200/70!';

// 1. Үндсэн логик бүхий компонентоо тусад нь салгах (WorkshopContent)
function WorkshopContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [works, setWorks] = useState<WorkItem[]>([]);
  const [options, setOptions] = useState<WorkOptionData>({ individuals: [], companies: [], services: [], employees: [] });
  const [loading, setLoading] = useState(true);

  // Шүүлтүүр (URL-аас эхлүүлнэ, ингэснээр дэлгэрэнгүй хуудаснаас буцахад хадгалагдана)
  const [filters, setFilters] = useState<Filters>(() => {
    const initial = { ...DEFAULT_FILTERS };
    for (const key of FILTER_KEYS) {
      const value = searchParams.get(key);
      if (value !== null) initial[key] = value;
    }
    return initial;
  });
  const [showAdvanced, setShowAdvanced] = useState(() =>
    ADVANCED_KEYS.some((key) => searchParams.get(key) !== null)
  );

  // Pagination states
  const [currentPage, setCurrentPage] = useState(() => {
    const pageParam = searchParams.get('page');
    return pageParam ? parseInt(pageParam, 10) || 1 : 1;
  });
  const itemsPerPage = 9;

  // Шүүлтүүр өөрчлөгдөхөд эхний хуудас руу буцна
  const setFilter = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  };

  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const { formRef, errors, resetErrors } = useFormValidation();

  const openModal = () => {
    resetErrors();
    setSubmitError('');
    setIsModalOpen(true);
  };
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState<WorkFormData>(emptyWorkForm);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/workshop');
      const result = await res.json();
      if (result.success) {
        setWorks(result.data);
      }

      const optRes = await fetch('/api/workshop?action=options');
      const optResult = await optRes.json();
      if (optResult.success) {
        setOptions(optResult.data);
      }
    } catch (err) {
      console.error('Failed to fetch workshop data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Mount үед өгөгдөл татна (fetch эхлэхэд loading төлөвийг шинэчилдэг)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
  }, []);

  // Шүүлтүүр болон хуудасны төлөвийг URL-тай синк хийх (зөвхөн анхдагчаас өөр утгуудыг)
  useEffect(() => {
    const params = new URLSearchParams();
    for (const key of FILTER_KEYS) {
      if (filters[key] !== DEFAULT_FILTERS[key]) params.set(key, filters[key]);
    }
    if (currentPage > 1) params.set('page', currentPage.toString());

    const query = params.toString();
    if (query !== searchParams.toString()) {
      router.replace(`/dashboard/workshop${query ? `?${query}` : ''}`, { scroll: false });
    }
  }, [filters, currentPage, router, searchParams]);

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');
    try {
      setSaving(true);
      const res = await fetch('/api/workshop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const result = await res.json();
      if (result.success) {
        setIsModalOpen(false);
        setFormData(emptyWorkForm());
        fetchData();
      } else {
        setSubmitError(result.error || 'Хадгалахад алдаа гарлаа.');
      }
    } catch (err) {
      console.error('Error saving work:', err);
      setSubmitError('Сервертэй холбогдоход алдаа гарлаа. Дахин оролдоно уу.');
    } finally {
      setSaving(false);
    }
  };

  const resetFilters = () => {
    // Эрэмбэ болон нэмэлт хэсгийн нээлттэй байдлыг хэвээр үлдээнэ
    setFilters((prev) => ({ ...DEFAULT_FILTERS, sort: prev.sort }));
    setCurrentPage(1);
  };

  // ---- Сонголтууд ----
  const employeeFilterOptions = useMemo(
    () => [
      { value: 'none', label: 'Хуваарилаагүй', sub: 'Ажилтан томилоогүй ажлууд' },
      ...options.employees.map((emp) => ({
        value: String(emp.user_id),
        label: `${emp.last_name ?? ''} ${emp.first_name ?? ''}`.trim(),
        sub: emp.email,
      })),
    ],
    [options.employees]
  );

  const serviceFilterOptions = useMemo(
    () =>
      options.services.map((s) => ({
        value: String(s.service_id),
        label: s.name,
        sub: `${Number(s.price).toLocaleString()} ₮`,
      })),
    [options.services]
  );

  const customerFilterOptions = useMemo(
    () => [
      ...options.individuals.map((c) => ({
        value: `i:${c.id}`,
        label: `${c.last_name ?? ''} ${c.first_name ?? ''}`.trim(),
        sub: `Хувь хүн${c.phone ? ` · ${c.phone}` : ''}`,
      })),
      ...options.companies.map((c) => ({
        value: `c:${c.id}`,
        label: c.name,
        sub: `Байгууллага · ${c.tax_number}${c.phone ? ` · ${c.phone}` : ''}`,
      })),
    ],
    [options.individuals, options.companies]
  );

  // ---- Шүүх, эрэмбэлэх ----
  const ranges = currentRanges();
  const overdueCount = works.filter((w) => {
    const due = workDate(w.due_date);
    return !!due && due < ranges.today && isOpenWork(w);
  }).length;

  const filteredWorks = useMemo(() => {
    const { today, weekStart, weekEnd, monthStart, monthEnd } = currentRanges();
    const words = filters.q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const priceMin = filters.priceMin === '' ? null : Number(filters.priceMin);
    const priceMax = filters.priceMax === '' ? null : Number(filters.priceMax);

    const result = works.filter((w) => {
      if (words.length > 0) {
        // Гарчиг, тайлбар, харилцагч, ажилтан, үйлчилгээний нэрээр — бүх үг тааралдах ёстой
        const haystack = [w.title, w.description, w.customer_name, w.employee_name, ...(w.services ?? []).map((s) => s.service_name)]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!words.every((word) => haystack.includes(word))) return false;
      }
      if (filters.status !== 'all' && w.status !== filters.status) return false;
      if (filters.priority !== 'all' && w.priority !== filters.priority) return false;
      if (filters.customerType !== 'all' && w.customer_type !== filters.customerType) return false;
      if (filters.employee === 'none' ? !!w.assigned_employee : filters.employee !== 'all' && w.assigned_employee !== filters.employee) {
        return false;
      }
      if (filters.service && !(w.services ?? []).some((s) => String(s.service_id) === filters.service)) return false;
      if (filters.customer) {
        const key = w.customer_type === 'company' ? `c:${w.company_customer_id}` : `i:${w.customer_id}`;
        if (key !== filters.customer) return false;
      }

      const due = workDate(w.due_date);
      switch (filters.due) {
        case 'overdue':
          if (!due || due >= today || !isOpenWork(w)) return false;
          break;
        case 'today':
          if (due !== today) return false;
          break;
        case 'week':
          if (!due || due < weekStart || due > weekEnd) return false;
          break;
        case 'month':
          if (!due || due < monthStart || due > monthEnd) return false;
          break;
        case 'none':
          if (due) return false;
          break;
        case 'custom':
          if ((filters.dueFrom || filters.dueTo) && !due) return false;
          if (filters.dueFrom && due < filters.dueFrom) return false;
          if (filters.dueTo && due > filters.dueTo) return false;
          break;
      }

      const created = workDate(w.create_date);
      if (filters.createdFrom && created < filters.createdFrom) return false;
      if (filters.createdTo && created > filters.createdTo) return false;

      const price = Number(w.price) || 0;
      if (priceMin !== null && price < priceMin) return false;
      if (priceMax !== null && price > priceMax) return false;
      return true;
    });

    const byCreated = (a: WorkItem, b: WorkItem) => (a.create_date < b.create_date ? -1 : a.create_date > b.create_date ? 1 : 0);
    switch (filters.sort) {
      case 'oldest':
        return result.sort(byCreated);
      case 'due':
        // Хугацаагүй ажлууд хамгийн сүүлд
        return result.sort((a, b) => (workDate(a.due_date) || '9999').localeCompare(workDate(b.due_date) || '9999'));
      case 'price_desc':
        return result.sort((a, b) => Number(b.price) - Number(a.price));
      case 'price_asc':
        return result.sort((a, b) => Number(a.price) - Number(b.price));
      default:
        return result.sort((a, b) => byCreated(b, a));
    }
  }, [works, filters]);

  // ---- Идэвхтэй шүүлтүүрийн шошгууд ----
  const optionLabel = (list: { value: string; label: string }[], value: string) =>
    list.find((o) => o.value === value)?.label ?? value;

  const activeChips: { key: string; label: string; clear: () => void }[] = [];
  if (filters.q) activeChips.push({ key: 'q', label: `“${filters.q}”`, clear: () => setFilter('q', '') });
  if (filters.status !== 'all') activeChips.push({ key: 'status', label: STATUS_LABELS[filters.status] ?? filters.status, clear: () => setFilter('status', 'all') });
  if (filters.priority !== 'all') activeChips.push({ key: 'priority', label: PRIORITY_LABELS[filters.priority] ?? filters.priority, clear: () => setFilter('priority', 'all') });
  if (filters.customerType !== 'all') {
    activeChips.push({ key: 'customerType', label: filters.customerType === 'company' ? 'Компани' : 'Хувь хүн', clear: () => setFilter('customerType', 'all') });
  }
  if (filters.employee !== 'all') {
    activeChips.push({ key: 'employee', label: `Ажилтан: ${optionLabel(employeeFilterOptions, filters.employee)}`, clear: () => setFilter('employee', 'all') });
  }
  if (filters.service) {
    activeChips.push({ key: 'service', label: `Үйлчилгээ: ${optionLabel(serviceFilterOptions, filters.service)}`, clear: () => setFilter('service', '') });
  }
  if (filters.customer) {
    activeChips.push({ key: 'customer', label: `Харилцагч: ${optionLabel(customerFilterOptions, filters.customer)}`, clear: () => setFilter('customer', '') });
  }
  if (filters.due !== 'all') {
    const range = filters.due === 'custom' ? `: ${filters.dueFrom ? formatDate(filters.dueFrom) : '…'} – ${filters.dueTo ? formatDate(filters.dueTo) : '…'}` : '';
    activeChips.push({
      key: 'due',
      label: `${DUE_LABELS[filters.due] ?? filters.due}${range}`,
      clear: () => {
        setFilters((prev) => ({ ...prev, due: 'all', dueFrom: '', dueTo: '' }));
        setCurrentPage(1);
      },
    });
  }
  if (filters.createdFrom || filters.createdTo) {
    activeChips.push({
      key: 'created',
      label: `Бүртгэсэн: ${filters.createdFrom ? formatDate(filters.createdFrom) : '…'} – ${filters.createdTo ? formatDate(filters.createdTo) : '…'}`,
      clear: () => {
        setFilters((prev) => ({ ...prev, createdFrom: '', createdTo: '' }));
        setCurrentPage(1);
      },
    });
  }
  if (filters.priceMin || filters.priceMax) {
    const fmt = (v: string) => `${Number(v).toLocaleString()}₮`;
    activeChips.push({
      key: 'price',
      label: `Үнэ: ${filters.priceMin ? fmt(filters.priceMin) : '0₮'} – ${filters.priceMax ? fmt(filters.priceMax) : '…'}`,
      clear: () => {
        setFilters((prev) => ({ ...prev, priceMin: '', priceMax: '' }));
        setCurrentPage(1);
      },
    });
  }

  const hasActiveFilters = activeChips.length > 0;
  const advancedCount = activeChips.filter((c) => ['service', 'customer', 'due', 'created', 'price'].includes(c.key)).length;

  const totalPages = Math.ceil(filteredWorks.length / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentWorks = filteredWorks.slice(indexOfFirstItem, indexOfLastItem);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 shrink-0 border border-emerald-100/50 dark:border-emerald-800"><CheckCircle2 size={11} /> Дууссан</span>;
      case 'in_progress':
        return <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2.5 py-1 rounded-full bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 shrink-0 border border-red-100/50 dark:border-red-800"><Wrench size={11} /> Хийгдэж байна</span>;
      case 'cancelled':
        return <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2.5 py-1 rounded-full bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 shrink-0 border border-rose-100/50 dark:border-rose-800"><X size={11} /> Цуцлагдсан</span>;
      default:
        return <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 shrink-0 border border-amber-100/50 dark:border-amber-800"><Clock size={11} /> Хүлээгдэж буй</span>;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'high':
        return <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-800">Яаралтай</span>;
      case 'medium':
        return <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-800">Дунд</span>;
      default:
        return <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">Энгийн</span>;
    }
  };

  return (
    <div className="space-y-5 sm:space-y-6 pb-20 text-slate-800 dark:text-slate-100">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-100 dark:border-slate-800 shadow-2xs">
        <div>
          <h1 className="text-lg sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">Ажлын удирдлага</h1>
          <p className="text-[11px] sm:text-xs text-slate-400 dark:text-slate-400 mt-0.5">Харилцагч, үйлчилгээ болон ажилтны гүйцэтгэлийг хянах</p>
        </div>
        <button
          onClick={openModal}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white px-5 py-3 rounded-xl sm:rounded-2xl text-xs font-bold transition-all shadow-md shadow-red-500/20 active:scale-95 cursor-pointer"
        >
          <Plus size={16} /> Шинэ ажил бүртгэх
        </button>
      </div>

      {/* Filter & Search Section */}
      <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-100 dark:border-slate-800 shadow-2xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 bg-slate-50 dark:bg-slate-800/60 px-3.5 py-2.5 rounded-xl border border-slate-200/70 dark:border-slate-700 w-full lg:w-md focus-within:border-red-500 focus-within:bg-white dark:focus-within:bg-slate-900 transition-all">
            <Search size={16} className="text-slate-400 shrink-0" />
            <input
              type="text"
              placeholder="Ажил, тайлбар, харилцагч, үйлчилгээ, ажилтнаар хайх..."
              value={filters.q}
              onChange={(e) => setFilter('q', e.target.value)}
              className="w-full text-xs font-bold text-slate-800 dark:text-slate-100 bg-transparent outline-none"
            />
            {filters.q && (
              <button onClick={() => setFilter('q', '')} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer" aria-label="Хайлт цэвэрлэх">
                <X size={14} />
              </button>
            )}
          </div>

          <div className="flex items-center justify-between lg:justify-end gap-2 flex-wrap">
            <span className="text-xs font-bold text-slate-400">
              Үр дүн: <span className="text-slate-800 dark:text-slate-200">{filteredWorks.length}</span>{' '}
              <InfoTip size={12} text="Хайлт болон сонгосон шүүлтүүрүүдэд таарсан ажлын тоо." />
            </span>
            <div className="h-4 w-px bg-slate-200 dark:bg-slate-800 hidden sm:block" />
            <select
              value={filters.sort}
              onChange={(e) => setFilter('sort', e.target.value)}
              className={`${filterSelectClass} w-auto!`}
              aria-label="Эрэмбэлэх"
            >
              {Object.entries(SORT_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <div className="flex items-center gap-1 bg-slate-100/70 dark:bg-slate-800 p-1 rounded-xl">
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                  viewMode === 'list' ? 'bg-white dark:bg-slate-900 text-red-600 dark:text-red-400 shadow-2xs' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
                title="Жагсаалтаар харах"
              >
                <LayoutList size={16} />
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                  viewMode === 'grid' ? 'bg-white dark:bg-slate-900 text-red-600 dark:text-red-400 shadow-2xs' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
                title="Хэсгээр харах"
              >
                <LayoutGrid size={16} />
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
          <div className="flex flex-col gap-1">
            <label className={filterLabelClass}>Төлөв</label>
            <select value={filters.status} onChange={(e) => setFilter('status', e.target.value)} className={filterSelectClass}>
              <option value="all">Бүх төлөв</option>
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className={filterLabelClass}>Зэрэглэл</label>
            <select value={filters.priority} onChange={(e) => setFilter('priority', e.target.value)} className={filterSelectClass}>
              <option value="all">Бүх зэрэглэл</option>
              {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className={filterLabelClass}>Харилцагчийн төрөл</label>
            <select value={filters.customerType} onChange={(e) => setFilter('customerType', e.target.value)} className={filterSelectClass}>
              <option value="all">Бүх харилцагч</option>
              <option value="individual">Хувь хүн</option>
              <option value="company">Компани</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className={filterLabelClass}>Хариуцсан ажилтан</label>
            {/* Ажилтан олон байж болох тул нэр, имэйлээр хайж сонгоно. Хоосон = бүх ажилтан */}
            <SearchSelect
              size="sm"
              options={employeeFilterOptions}
              value={filters.employee === 'all' ? '' : filters.employee}
              onChange={(id) => setFilter('employee', id || 'all')}
              placeholder="Ажилтан хайх..."
              fallbackLabel="Бүх ажилтан"
              emptyText="Ажилтан олдсонгүй"
              className={searchSelectFilterClass}
              aria-label="Хариуцсан ажилтнаар шүүх"
            />
          </div>
        </div>

        {/* Нэмэлт шүүлтүүр */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            aria-expanded={showAdvanced}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-red-600 dark:hover:text-red-400 transition-colors cursor-pointer"
          >
            <SlidersHorizontal size={14} />
            Нэмэлт шүүлтүүр
            {advancedCount > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-red-600 text-white">{advancedCount}</span>
            )}
            <ChevronDown size={14} className={`transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
          </button>
          {overdueCount > 0 && filters.due !== 'overdue' && (
            <button
              type="button"
              onClick={() => {
                setFilters((prev) => ({ ...prev, due: 'overdue', dueFrom: '', dueTo: '' }));
                setCurrentPage(1);
              }}
              className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-950 transition-colors cursor-pointer"
            >
              <Clock size={12} /> Хугацаа хэтэрсэн {overdueCount} ажил
            </button>
          )}
        </div>

        {showAdvanced && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 p-3 rounded-2xl bg-slate-50/60 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800">
            <div className="flex flex-col gap-1">
              <label className={filterLabelClass}>Үйлчилгээ</label>
              <SearchSelect
                size="sm"
                options={serviceFilterOptions}
                value={filters.service}
                onChange={(id) => setFilter('service', id)}
                placeholder="Үйлчилгээ хайх..."
                fallbackLabel="Бүх үйлчилгээ"
                emptyText="Үйлчилгээ олдсонгүй"
                className={searchSelectFilterClass}
                aria-label="Үйлчилгээгээр шүүх"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className={filterLabelClass}>Харилцагч</label>
              <SearchSelect
                size="sm"
                options={customerFilterOptions}
                value={filters.customer}
                onChange={(id) => setFilter('customer', id)}
                placeholder="Нэр, утас, регистрээр хайх..."
                fallbackLabel="Бүх харилцагч"
                emptyText="Харилцагч олдсонгүй"
                className={searchSelectFilterClass}
                aria-label="Харилцагчаар шүүх"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className={filterLabelClass}>Үнэ (₮)</label>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  inputMode="decimal"
                  placeholder="Доод"
                  value={filters.priceMin}
                  onChange={(e) => setFilter('priceMin', e.target.value)}
                  className={filterInputClass}
                  aria-label="Доод үнэ"
                />
                <span className="text-slate-400 text-xs">–</span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  inputMode="decimal"
                  placeholder="Дээд"
                  value={filters.priceMax}
                  onChange={(e) => setFilter('priceMax', e.target.value)}
                  className={filterInputClass}
                  aria-label="Дээд үнэ"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className={filterLabelClass}>Дуусах хугацаа</label>
              <select
                value={filters.due}
                onChange={(e) => {
                  const due = e.target.value;
                  setFilters((prev) => ({ ...prev, due, ...(due === 'custom' ? {} : { dueFrom: '', dueTo: '' }) }));
                  setCurrentPage(1);
                }}
                className={filterSelectClass}
              >
                <option value="all">Бүгд</option>
                <option value="overdue">Хугацаа хэтэрсэн ({overdueCount})</option>
                <option value="today">Өнөөдөр дуусах</option>
                <option value="week">Энэ 7 хоногт дуусах</option>
                <option value="month">Энэ сард дуусах</option>
                <option value="none">Хугацаагүй</option>
                <option value="custom">Интервал сонгох…</option>
              </select>
              {filters.due === 'custom' && (
                <div className="flex items-center gap-1.5 mt-1">
                  <input
                    type="date"
                    value={filters.dueFrom}
                    onChange={(e) => setFilter('dueFrom', e.target.value)}
                    className={filterInputClass}
                    aria-label="Дуусах хугацаа — эхлэх"
                  />
                  <ArrowRight size={12} className="text-slate-400 shrink-0" />
                  <input
                    type="date"
                    value={filters.dueTo}
                    min={filters.dueFrom || undefined}
                    onChange={(e) => setFilter('dueTo', e.target.value)}
                    className={filterInputClass}
                    aria-label="Дуусах хугацаа — хүртэл"
                  />
                </div>
              )}
            </div>

            <div className="flex flex-col gap-1 sm:col-span-2 lg:col-span-2">
              <label className={filterLabelClass}>Бүртгэсэн огноо</label>
              <div className="flex items-center gap-1.5">
                <input
                  type="date"
                  value={filters.createdFrom}
                  max={ranges.today}
                  onChange={(e) => setFilter('createdFrom', e.target.value)}
                  className={filterInputClass}
                  aria-label="Бүртгэсэн огноо — эхлэх"
                />
                <ArrowRight size={12} className="text-slate-400 shrink-0" />
                <input
                  type="date"
                  value={filters.createdTo}
                  min={filters.createdFrom || undefined}
                  onChange={(e) => setFilter('createdTo', e.target.value)}
                  className={filterInputClass}
                  aria-label="Бүртгэсэн огноо — хүртэл"
                />
              </div>
            </div>
          </div>
        )}

        {hasActiveFilters && (
          <div className="flex items-center gap-2 flex-wrap pt-1">
            {activeChips.map((chip) => (
              <span
                key={chip.key}
                className="inline-flex items-center gap-1 pl-2.5 pr-1 py-1 rounded-lg bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 text-[11px] font-bold max-w-full"
              >
                <span className="truncate">{chip.label}</span>
                <button onClick={chip.clear} className="p-0.5 rounded hover:bg-red-100 dark:hover:bg-red-900 cursor-pointer shrink-0" aria-label="Шүүлтүүр арилгах">
                  <X size={12} />
                </button>
              </span>
            ))}
            <button
              onClick={resetFilters}
              className="inline-flex items-center gap-1 text-xs font-bold text-rose-500 hover:text-rose-600 dark:hover:text-rose-400 transition-colors cursor-pointer ml-auto"
            >
              <RotateCcw size={12} /> Шүүлтүүрийг цэвэрлэх
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <Loading />
      ) : filteredWorks.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 p-12 rounded-3xl border border-slate-100 dark:border-slate-800 text-center space-y-3 shadow-2xs">
          <div className="w-12 h-12 bg-slate-50 dark:bg-slate-800 text-slate-300 dark:text-slate-600 rounded-2xl flex items-center justify-center mx-auto">
            <Wrench size={24} />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-800 dark:text-slate-100">Ажил олдсонгүй</p>
            <p className="text-xs text-slate-400 mt-0.5">Хайлт эсвэл шүүлтүүрийн утгыг өөрчилж үзнэ үү.</p>
          </div>
          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl transition-all cursor-pointer mt-2"
            >
              <RotateCcw size={12} /> Бүх шүүлтүүрийг арилгах
            </button>
          )}
        </div>
      ) : viewMode === 'list' ? (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-180">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                  <th className="py-3.5 px-6">Ажил / Гарчиг</th>
                  <th className="py-3.5 px-6">Харилцагч</th>
                  <th className="py-3.5 px-6">Үйлчилгээ</th>
                  <th className="py-3.5 px-6">Ажилтан</th>
                  <th className="py-3.5 px-6">
                    <span className="inline-flex items-center gap-1">Зэрэглэл <InfoTip size={12} text="Ажлын яаралтай байдал: Энгийн, Дунд, Яаралтай." /></span>
                  </th>
                  <th className="py-3.5 px-6">
                    <span className="inline-flex items-center gap-1">Үнэ <InfoTip size={12} text="Ажлын нийт үнэ: үйлчилгээ бүрийн тоо × нэгж үнийн нийлбэр." /></span>
                  </th>
                  <th className="py-3.5 px-6">Төлөв</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300">
                {currentWorks.map((work) => (
                  <tr 
                    key={work.work_id} 
                    onClick={() => router.push(`/dashboard/workshop/${work.work_id}`)}
                    className="hover:bg-red-50/40 dark:hover:bg-slate-800/60 transition-colors cursor-pointer group"
                  >
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 group-hover:bg-red-600 group-hover:text-white flex items-center justify-center font-black transition-all shrink-0">
                          <Wrench size={16} />
                        </div>
                        <div>
                          <span className="font-bold text-slate-900 dark:text-white group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors flex items-center gap-1.5">
                            {work.title} {work.can_edit === false && <ReadOnlyMark />}
                          </span>
                          <span className="text-[11px] text-slate-400 truncate max-w-55 block">{work.description || 'Тайлбар байхгүй'}</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-200 font-bold">
                        <User size={13} className="text-slate-400 shrink-0" /> 
                        <span className="truncate max-w-32">{work.customer_name || 'Харилцагч байхгүй'}</span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-normal shrink-0">
                          {work.customer_type === 'company' ? 'Компани' : 'Хувь хүн'}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 truncate max-w-35">
                        <Briefcase size={11} className="shrink-0" /> {serviceLabel(work)}
                      </span>
                    </td>
                    <td className="py-4 px-6 font-medium text-slate-700 dark:text-slate-300 truncate max-w-30">
                      {work.employee_name?.trim() ? work.employee_name : <span className="text-slate-300 dark:text-slate-600 italic">Томилогдоогүй</span>}
                    </td>
                    <td className="py-4 px-6 whitespace-nowrap">
                      {getPriorityBadge(work.priority)}
                    </td>
                    <td className="py-4 px-6 font-bold text-slate-900 dark:text-white whitespace-nowrap">
                      {work.price ? `${Number(work.price).toLocaleString()} ₮` : '0 ₮'}
                    </td>
                    <td className="py-4 px-6 whitespace-nowrap">
                      {getStatusBadge(work.status)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {currentWorks.map((work) => (
            <div 
              key={work.work_id} 
              onClick={() => router.push(`/dashboard/workshop/${work.work_id}`)}
              className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-2xs space-y-3.5 hover:border-red-300 dark:hover:border-slate-700 hover:shadow-md transition-all cursor-pointer group"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 group-hover:bg-red-600 group-hover:text-white flex items-center justify-center font-black transition-all shrink-0">
                    <Wrench size={18} />
                  </div>
                  <div>
                    <h3 className="font-black text-sm text-slate-900 dark:text-white group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors flex items-center gap-1.5">
                      {work.title} {work.can_edit === false && <ReadOnlyMark />}
                    </h3>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                        <Briefcase size={10} /> {serviceLabel(work)}
                      </span>
                      {getPriorityBadge(work.priority)}
                    </div>
                  </div>
                </div>
                {getStatusBadge(work.status)}
              </div>

              <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">{work.description || 'Тайлбар байхгүй'}</p>

              <div className="space-y-2 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
                <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                  <span className="text-slate-400 flex items-center gap-1"><User size={13} /> Харилцагч:</span>
                  <span className="font-bold truncate max-w-40">{work.customer_name}</span>
                </div>
                <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                  <span className="text-slate-400 flex items-center gap-1"><ShieldAlert size={13} /> Ажилтан:</span>
                  <span className="font-semibold truncate max-w-40">{work.employee_name?.trim() ? work.employee_name : 'Томилогдоогүй'}</span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800 text-xs font-bold">
                <span className="text-slate-400 inline-flex items-center gap-1">Нийт үнэ: <InfoTip size={12} text="Үйлчилгээ бүрийн тоо × нэгж үнийн нийлбэр." /></span>
                <span className="text-red-600 dark:text-red-400 text-sm">{work.price ? `${Number(work.price).toLocaleString()} ₮` : '0 ₮'}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination Component */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-between bg-white dark:bg-slate-900 px-5 py-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-2xs">
          <div className="text-xs font-medium text-slate-400">
            Шүүлтүүрт таарсан <span className="font-bold text-slate-700 dark:text-slate-200">{filteredWorks.length}</span> ажлаас <span className="font-bold text-slate-700 dark:text-slate-200">{indexOfFirstItem + 1}-{Math.min(indexOfLastItem, filteredWorks.length)}</span> хүртэл харуулж байна
          </div>
          
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => handlePageChange(Math.max(currentPage - 1, 1))}
              disabled={currentPage === 1}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
            >
              <ChevronLeft size={16} />
            </button>

            <div className="flex items-center gap-1 px-2">
              <span className="text-xs font-bold text-slate-800 dark:text-white">{currentPage}</span>
              <span className="text-xs text-slate-400">/</span>
              <span className="text-xs font-bold text-slate-400">{totalPages}</span>
            </div>

            <button
              onClick={() => handlePageChange(Math.min(currentPage + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Add Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white dark:bg-slate-900 max-w-2xl w-full rounded-3xl p-6 sm:p-8 space-y-5 shadow-2xl border border-slate-100 dark:border-slate-800 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-black text-base text-slate-900 dark:text-white">Шинэ ажил бүртгэх</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
              <WorkFormFields formData={formData} setFormData={setFormData} options={options} errors={errors} />

              <FormErrorBanner message={submitError} onClose={() => setSubmitError('')} />

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer">
                  Цуцлах
                </button>
                <button type="submit" disabled={saving} className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 transition-all cursor-pointer">
                  {saving ? 'Хадгалж байна...' : 'Хадгалах'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// 2. Үндсэн хуудсыг Suspense дотор экспортлох (Build error гаргахгүй)
export default function WorkshopPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen w-full items-center justify-center p-10">
        <Loading />
      </div>
    }>
      <WorkshopContent />
    </Suspense>
  );
}