'use client';

import { useState, useEffect, useMemo, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  CalendarCheck, Plus, Search, X, Clock, User, Building2, Briefcase, UserCog,
  Phone, Pencil, Trash2, RotateCcw, CalendarDays, ArrowRight, ChevronRight, PlayCircle, Wrench, CheckCircle2, AlertCircle,
} from 'lucide-react';
import Loading from '@/src/app/components/loading';
import SearchSelect from '@/src/app/components/SearchSelect';
import Tooltip from '@/src/app/components/Tooltip';
import InfoTip from '@/src/app/components/InfoTip';
import { useFormValidation, FieldError, FormErrorBanner, invalidClass } from '@/src/app/components/FormValidation';

// Формын нэг үйлчилгээний мөр. service_id хоосон бол каталогоос устсан (хадгалсан нэрээр үлдэнэ).
interface ServiceLine {
  service_id: string;
  service_name: string;
  price: number;
  duration: number | null;
}

// Олон үйлчилгээтэй бол эхнийхийг нь харуулж, үлдсэн тоог нэмнэ
const servicesLabel = (services: { service_name: string }[] | undefined) => {
  const names = services?.map((s) => s.service_name) ?? [];
  if (names.length === 0) return 'Үйлчилгээ сонгоогүй';
  return names.length === 1 ? names[0] : `${names[0]} +${names.length - 1}`;
};

const formatDuration = (minutes: number) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h} цаг${m ? ` ${m} мин` : ''}` : `${m} мин`;
};

type ReservationStatus = 'pending' | 'confirmed' | 'in_service' | 'completed' | 'cancelled' | 'no_show';
type CustomerType = 'individual' | 'company';

interface Reservation {
  reservation_id: string;
  customer_type: CustomerType;
  customer_id: string | null;
  company_customer_id: string | null;
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  customer_register: string | null;
  service_name: string | null;
  services: { service_id: number | null; service_name: string; price: number; duration: number | null }[];
  assigned_employee: string | null;
  employee_name: string | null;
  reservation_date: string;
  start_time: string;
  end_time: string | null;
  status: ReservationStatus;
  note: string | null;
  // Энэ захиалгаас үүссэн ажил ("Ажил эхлүүлэх"-ийн дараа)
  work_id: string | null;
  work_status: string | null;
}

interface OptionData {
  individuals: { id: string; first_name: string; last_name: string; phone: string }[];
  companies: { id: string; name: string; tax_number: string; phone: string }[];
  services: { service_id: number; name: string; price: number; duration: number | null }[];
  employees: { user_id: string; first_name: string; last_name: string; position: string | null }[];
}

const STATUS_META: Record<ReservationStatus, { label: string; description: string; className: string; dot: string; bar: string }> = {
  pending: {
    label: 'Хүлээгдэж буй',
    description: 'Цаг бүртгэгдсэн ч харилцагч ирэх эсэх нь тодорхойгүй. Харилцагчтай холбогдож ирэх эсэхийг нь тодруулаад «Баталгаажсан» болгоно.',
    className: 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-800',
    dot: 'bg-amber-500',
    bar: 'border-l-amber-500',
  },
  confirmed: {
    label: 'Баталгаажсан',
    description: 'Харилцагчтай холбогдож, ирэх нь тодорхой болсон. Харилцагч ирэхэд «Ажил эхлүүлэх» дарна.',
    className: 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-800',
    dot: 'bg-blue-500',
    bar: 'border-l-blue-500',
  },
  in_service: {
    label: 'Ажилд шилжсэн',
    description: 'Харилцагч ирж, захиалгаас ажил үүссэн. Төлөвийг ажил удирдана: ажил дуусвал автоматаар «Үйлчлүүлсэн» болно.',
    className: 'bg-violet-50 dark:bg-violet-950/60 text-violet-600 dark:text-violet-400 border-violet-100 dark:border-violet-800',
    dot: 'bg-violet-500',
    bar: 'border-l-violet-500',
  },
  completed: {
    label: 'Үйлчлүүлсэн',
    description: 'Үйлчилгээ хийгдэж дууссан.',
    className: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800',
    dot: 'bg-emerald-500',
    bar: 'border-l-emerald-500',
  },
  cancelled: {
    label: 'Цуцлагдсан',
    description: 'Харилцагч эсвэл байгууллага захиалгыг цуцалсан. Энэ цаг өөр захиалгад чөлөөтэй.',
    className: 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border-rose-100 dark:border-rose-800',
    dot: 'bg-rose-500',
    bar: 'border-l-rose-500',
  },
  no_show: {
    label: 'Ирээгүй',
    description: 'Харилцагч товлосон цагтаа ирээгүй, урьдчилан мэдэгдээгүй.',
    className: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700',
    dot: 'bg-slate-400',
    bar: 'border-l-slate-300 dark:border-l-slate-600',
  },
};
const STATUSES = Object.keys(STATUS_META) as ReservationStatus[];
// Гараар сонгож болох төлөвүүд — "Ажилд шилжсэн"-ийг зөвхөн "Ажил эхлүүлэх" товч тавина
const MANUAL_STATUSES = STATUSES.filter((s) => s !== 'in_service');
// Эдгээр төлөвтэй захиалгаас ажил эхлүүлж болно
const STARTABLE_STATUSES: ReservationStatus[] = ['pending', 'confirmed'];
const WORK_STATUS_LABELS: Record<string, string> = {
  pending: 'Хүлээгдэж буй',
  in_progress: 'Хийгдэж байна',
  completed: 'Дууссан',
  cancelled: 'Цуцлагдсан',
};

const WEEKDAYS = ['Ням', 'Даваа', 'Мягмар', 'Лхагва', 'Пүрэв', 'Баасан', 'Бямба'];

function toISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Хэрэглэгчийн орон нутгийн цагаар YYYY-MM-DD
function localDate(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return toISO(d);
}

function formatDate(date: string) {
  const [y, m, d] = date.split('-');
  return `${y}.${m}.${d}`;
}

function formatDateHeading(date: string) {
  const [y, m, d] = date.split('-').map(Number);
  const weekday = WEEKDAYS[new Date(y, m - 1, d).getDay()];
  const prefix = date === localDate() ? 'Өнөөдөр · ' : date === localDate(1) ? 'Маргааш · ' : date === localDate(-1) ? 'Өчигдөр · ' : '';
  return `${prefix}${formatDate(date)} (${weekday})`;
}

// Огнооны хурдан сонголтууд. Хоосон утга = хязгааргүй.
type PresetKey = 'upcoming' | 'today' | 'tomorrow' | 'week' | 'month' | 'past' | 'all';

function presetRange(key: PresetKey): { from: string; to: string } {
  const now = new Date();
  switch (key) {
    case 'upcoming':
      return { from: localDate(), to: '' };
    case 'today':
      return { from: localDate(), to: localDate() };
    case 'tomorrow':
      return { from: localDate(1), to: localDate(1) };
    case 'week': {
      // Даваа гарагаас Ням гараг хүртэл
      const mondayOffset = (now.getDay() + 6) % 7;
      return { from: localDate(-mondayOffset), to: localDate(6 - mondayOffset) };
    }
    case 'month':
      return {
        from: toISO(new Date(now.getFullYear(), now.getMonth(), 1)),
        to: toISO(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
      };
    case 'past':
      return { from: '', to: localDate(-1) };
    case 'all':
      return { from: '', to: '' };
  }
}

const PRESETS: { key: PresetKey; label: string }[] = [
  { key: 'upcoming', label: 'Ирэх' },
  { key: 'today', label: 'Өнөөдөр' },
  { key: 'tomorrow', label: 'Маргааш' },
  { key: 'week', label: 'Энэ 7 хоног' },
  { key: 'month', label: 'Энэ сар' },
  { key: 'past', label: 'Өнгөрсөн' },
  { key: 'all', label: 'Бүгд' },
];

const DEFAULT_RANGE = presetRange('upcoming');

const digitsOnly = (value: string) => value.replace(/\D/g, '');

const emptyForm = () => ({
  customer_type: 'individual' as CustomerType,
  customer_id: '',
  services: [] as ServiceLine[],
  assigned_employee: '',
  reservation_date: localDate(),
  start_time: '',
  end_time: '',
  status: 'pending' as ReservationStatus,
  note: '',
});

const inputClass =
  'w-full px-3.5 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-100 outline-none focus:border-red-500';
const filterClass =
  'w-full text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-50/70 dark:bg-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800 px-3 py-2.5 rounded-xl border border-slate-200/70 dark:border-slate-700 outline-none focus:border-red-500 transition-all';
const labelClass = 'text-[10px] font-extrabold text-slate-400 uppercase tracking-wider';

function ReservationsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [options, setOptions] = useState<OptionData>({ individuals: [], companies: [], services: [], employees: [] });
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  // Шүүлтүүр (URL-аас эхлүүлнэ, ингэснээр хуудсыг сэргээх, холбоос хуваалцахад хадгалагдана)
  const hasRangeParam = searchParams.has('from') || searchParams.has('to');
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get('q') ?? '');
  const [dateFrom, setDateFrom] = useState(() => (hasRangeParam ? searchParams.get('from') ?? '' : DEFAULT_RANGE.from));
  const [dateTo, setDateTo] = useState(() => (hasRangeParam ? searchParams.get('to') ?? '' : DEFAULT_RANGE.to));
  const [statusFilter, setStatusFilter] = useState(() => searchParams.get('status') ?? 'all');
  const [employeeFilter, setEmployeeFilter] = useState(() => searchParams.get('employee') ?? 'all');
  const [typeFilter, setTypeFilter] = useState(() => searchParams.get('type') ?? 'all');

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<Reservation | null>(null);
  const [formData, setFormData] = useState(emptyForm);
  const [formError, setFormError] = useState('');
  const { formRef, errors, resetErrors } = useFormValidation();
  // Алдаатай талбарт улаан хүрээ нэмэх
  const withError = (base: string, name: string) => (errors[name] ? `${base} ${invalidClass}` : base);
  const NOTE_MAX = 1000;
  // Хуудасны дээд хэсэгт гарах мэдэгдэл (alert-ийн оронд)
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string; href?: string; linkText?: string } | null>(null);
  // "Ажил эхлүүлэх"-ийг санамсаргүй дарахаас сэргийлж хоёр алхмаар баталгаажуулна
  const [confirmStartId, setConfirmStartId] = useState<string | null>(null);
  const [startingId, setStartingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);

  const fetchReservations = async () => {
    const res = await fetch('/api/reservations');
    const result = await res.json();
    if (result.success) setReservations(result.data);
  };

  useEffect(() => {
    (async () => {
      try {
        const [, optRes, userRes] = await Promise.all([
          fetchReservations(),
          fetch('/api/reservations?action=options').then((r) => r.json()),
          fetch('/api/user').then((r) => r.json()),
        ]);
        if (optRes.success) setOptions(optRes.data);
        if (userRes.success) setIsAdmin(userRes.data?.role === 'admin');
      } catch (err) {
        console.error('Failed to fetch reservations:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Шүүлтүүрийг URL-тай синк хийх
  useEffect(() => {
    const params = new URLSearchParams();
    if (searchQuery) params.set('q', searchQuery);
    if (dateFrom !== DEFAULT_RANGE.from || dateTo !== DEFAULT_RANGE.to) {
      params.set('from', dateFrom);
      params.set('to', dateTo);
    }
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (employeeFilter !== 'all') params.set('employee', employeeFilter);
    if (typeFilter !== 'all') params.set('type', typeFilter);

    const query = params.toString();
    if (query !== searchParams.toString()) {
      router.replace(`/dashboard/reservations${query ? `?${query}` : ''}`, { scroll: false });
    }
  }, [searchQuery, dateFrom, dateTo, statusFilter, employeeFilter, typeFilter, router, searchParams]);

  // "/" товчлуураар хайлт руу шилжих, Esc-ээр цонх хаах
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
      if (e.key === '/' && !typing && !isModalOpen) {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === 'Escape' && isModalOpen) {
        setIsModalOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isModalOpen]);

  // Эхлэх огноо дуусахаас хойш байвал солиод тооцно
  const [rangeStart, rangeEnd] = dateFrom && dateTo && dateFrom > dateTo ? [dateTo, dateFrom] : [dateFrom, dateTo];
  const activePreset = PRESETS.find(({ key }) => {
    const r = presetRange(key);
    return r.from === dateFrom && r.to === dateTo;
  })?.key;

  // Төлөвөөс бусад бүх шүүлтүүрийг хэрэглэнэ (төлөвийн табын тоонд ашиглана)
  const baseFiltered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const qDigits = digitsOnly(q);
    return reservations.filter((r) => {
      if (rangeStart && r.reservation_date < rangeStart) return false;
      if (rangeEnd && r.reservation_date > rangeEnd) return false;
      if (typeFilter !== 'all' && r.customer_type !== typeFilter) return false;
      if (employeeFilter === 'none' ? r.assigned_employee : employeeFilter !== 'all' && r.assigned_employee !== employeeFilter) {
        return false;
      }
      if (!q) return true;
      return (
        r.customer_name.toLowerCase().includes(q) ||
        (qDigits.length > 0 && digitsOnly(r.customer_phone ?? '').includes(qDigits)) ||
        (r.customer_email ?? '').toLowerCase().includes(q) ||
        (r.customer_register ?? '').toLowerCase().includes(q) ||
        (r.service_name ?? '').toLowerCase().includes(q) ||
        (r.employee_name ?? '').toLowerCase().includes(q)
      );
    });
  }, [reservations, searchQuery, rangeStart, rangeEnd, typeFilter, employeeFilter]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: baseFiltered.length };
    for (const s of STATUSES) counts[s] = baseFiltered.filter((r) => r.status === s).length;
    return counts;
  }, [baseFiltered]);

  const filtered = useMemo(
    () => (statusFilter === 'all' ? baseFiltered : baseFiltered.filter((r) => r.status === statusFilter)),
    [baseFiltered, statusFilter]
  );

  // Зөвхөн өнгөрсөн хугацааг харж байвал шинээс нь хуучин руу, бусад үед ойрын өдрөөс нь
  const descending = !!rangeEnd && rangeEnd < localDate() && !rangeStart;
  const grouped = useMemo(() => {
    const groups = new Map<string, Reservation[]>();
    for (const r of filtered) {
      const list = groups.get(r.reservation_date) ?? [];
      list.push(r);
      groups.set(r.reservation_date, list);
    }
    const entries = [...groups.entries()];
    return descending ? entries.reverse() : entries;
  }, [filtered, descending]);

  const todayStats = useMemo(() => {
    const todayList = reservations.filter((r) => r.reservation_date === localDate());
    const now = new Date();
    const nowTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    // Дараагийн захиалга: өнөөдөр одоогоос хойш эхлэх, цуцлагдаагүй, үйлчлүүлээгүй
    const next = todayList
      .filter((r) => (r.status === 'pending' || r.status === 'confirmed') && r.start_time >= nowTime)
      .sort((a, b) => a.start_time.localeCompare(b.start_time))[0];
    const count = (status: ReservationStatus) => todayList.filter((r) => r.status === status).length;
    return {
      // Цуцлагдсан, ирээгүй захиалгыг "нийт"-д тооцохгүй
      total: todayList.filter((r) => r.status !== 'cancelled' && r.status !== 'no_show').length,
      pending: count('pending'),
      confirmed: count('confirmed'),
      completed: count('completed'),
      cancelled: count('cancelled'),
      noShow: count('no_show'),
      next,
    };
  }, [reservations]);

  const customerOptions = useMemo(
    () => ({
      individual: options.individuals.map((c) => ({
        value: String(c.id),
        label: `${c.last_name ?? ''} ${c.first_name ?? ''}`.trim(),
        sub: c.phone || 'Утасгүй',
      })),
      company: options.companies.map((c) => ({
        value: String(c.id),
        label: c.name,
        sub: `Регистр: ${c.tax_number}${c.phone ? ` · ${c.phone}` : ''}`,
      })),
    }),
    [options.individuals, options.companies]
  );

  const serviceOptions = useMemo(
    () =>
      options.services
        .filter((s) => !formData.services.some((line) => line.service_id === String(s.service_id)))
        .map((s) => ({
        value: String(s.service_id),
        label: s.name,
        sub: [s.duration ? `${s.duration} мин` : '', s.price ? `${Number(s.price).toLocaleString()} ₮` : '']
          .filter(Boolean)
          .join(' · '),
      })),
    [options.services, formData.services]
  );

  const employeeOptions = useMemo(
    () =>
      options.employees.map((emp) => ({
        value: String(emp.user_id),
        label: `${emp.last_name ?? ''} ${emp.first_name ?? ''}`.trim(),
        sub: emp.position ?? undefined,
      })),
    [options.employees]
  );

  const applyPreset = (key: PresetKey) => {
    const r = presetRange(key);
    setDateFrom(r.from);
    setDateTo(r.to);
  };

  const showToday = (status: string) => {
    applyPreset('today');
    setStatusFilter(status);
  };

  const activeChips: { label: string; clear: () => void }[] = [];
  if (searchQuery) activeChips.push({ label: `“${searchQuery}”`, clear: () => setSearchQuery('') });
  if (dateFrom !== DEFAULT_RANGE.from || dateTo !== DEFAULT_RANGE.to) {
    const label = activePreset
      ? PRESETS.find((p) => p.key === activePreset)!.label
      : `${rangeStart ? formatDate(rangeStart) : '…'} – ${rangeEnd ? formatDate(rangeEnd) : '…'}`;
    activeChips.push({ label, clear: () => applyPreset('upcoming') });
  }
  if (statusFilter !== 'all') {
    activeChips.push({ label: STATUS_META[statusFilter as ReservationStatus]?.label ?? statusFilter, clear: () => setStatusFilter('all') });
  }
  if (typeFilter !== 'all') {
    activeChips.push({ label: typeFilter === 'company' ? 'Байгууллага' : 'Хувь хүн', clear: () => setTypeFilter('all') });
  }
  if (employeeFilter !== 'all') {
    const emp = options.employees.find((e) => e.user_id === employeeFilter);
    activeChips.push({
      label: employeeFilter === 'none' ? 'Хуваарилаагүй' : emp ? `${emp.last_name} ${emp.first_name}` : 'Ажилтан',
      clear: () => setEmployeeFilter('all'),
    });
  }

  const resetFilters = () => {
    setSearchQuery('');
    applyPreset('upcoming');
    setStatusFilter('all');
    setEmployeeFilter('all');
    setTypeFilter('all');
  };

  const openCreate = (date?: string) => {
    setEditing(null);
    setFormData({ ...emptyForm(), reservation_date: date && date >= localDate() ? date : localDate() });
    setFormError('');
    resetErrors();
    setIsModalOpen(true);
  };

  const openEdit = (r: Reservation) => {
    if (r.work_id) {
      router.push(`/dashboard/workshop/${r.work_id}`);
      return;
    }
    setEditing(r);
    setFormData({
      customer_type: r.customer_type,
      customer_id: (r.customer_type === 'company' ? r.company_customer_id : r.customer_id) ?? '',
      services: (r.services ?? []).map((line) => ({
        service_id: line.service_id ? String(line.service_id) : '',
        service_name: line.service_name,
        price: Number(line.price) || 0,
        duration: line.duration,
      })),
      assigned_employee: r.assigned_employee ?? '',
      reservation_date: r.reservation_date,
      start_time: r.start_time,
      end_time: r.end_time ?? '',
      status: r.status,
      note: r.note ?? '',
    });
    setFormError('');
    resetErrors();
    setIsModalOpen(true);
  };

  // Засах үед харилцагч устсан бол сонголтонд байхгүй тул хадгалсан нэрийг нь харуулна
  const customerMissing =
    !!editing &&
    formData.customer_type === editing.customer_type &&
    !formData.customer_id;

  // Үйлчилгээнүүдийн нийт үргэлжлэх хугацаагаар дуусах цагийг санал болгоно
  const suggestEndTime = (start: string, lines: ServiceLine[]) => {
    const duration = lines.reduce((sum, l) => sum + (l.duration ?? 0), 0);
    if (!start || duration <= 0) return '';
    const [h, m] = start.split(':').map(Number);
    const total = h * 60 + m + duration;
    if (total >= 24 * 60) return '';
    return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
  };

  const setServices = (lines: ServiceLine[]) =>
    setFormData({ ...formData, services: lines, end_time: suggestEndTime(formData.start_time, lines) || formData.end_time });

  const addService = (id: string) => {
    const service = options.services.find((s) => String(s.service_id) === id);
    if (!service) return;
    setServices([
      ...formData.services,
      { service_id: id, service_name: service.name, price: Number(service.price) || 0, duration: Number(service.duration) > 0 ? Number(service.duration) : null },
    ]);
  };

  const removeService = (index: number) => setServices(formData.services.filter((_, i) => i !== index));

  const servicesDuration = formData.services.reduce((sum, l) => sum + (l.duration ?? 0), 0);
  const servicesPrice = formData.services.reduce((sum, l) => sum + l.price, 0);

  // Дуусах цаг эхлэх цагаас дор хаяж 1 минутын дараа байх ёстой
  const minEndTime = (() => {
    if (!formData.start_time) return undefined;
    const [h, m] = formData.start_time.split(':').map(Number);
    const total = h * 60 + m + 1;
    return total >= 24 * 60 ? '23:59' : `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
  })();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    try {
      setSaving(true);
      const res = await fetch(editing ? `/api/reservations/${editing.reservation_id}` : '/api/reservations', {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const result = await res.json();
      if (result.success) {
        setIsModalOpen(false);
        await fetchReservations();
      } else {
        setFormError(result.error || 'Хадгалахад алдаа гарлаа');
      }
    } catch (err) {
      console.error('Error saving reservation:', err);
      setFormError('Сервертэй холбогдоход алдаа гарлаа');
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (r: Reservation, status: ReservationStatus) => {
    const previous = r.status;
    setReservations((list) => list.map((x) => (x.reservation_id === r.reservation_id ? { ...x, status } : x)));
    try {
      const res = await fetch(`/api/reservations/${r.reservation_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error);
    } catch (err) {
      setReservations((list) =>
        list.map((x) => (x.reservation_id === r.reservation_id ? { ...x, status: previous } : x))
      );
      setNotice({ type: 'error', text: err instanceof Error && err.message ? err.message : 'Төлөв шинэчлэхэд алдаа гарлаа' });
    }
  };

  // Харилцагч ирэхэд: захиалгын мэдээллээр ажил үүсгэж, хариуцсан ажилтанд имэйлээр мэдэгдэнэ
  const startWork = async (r: Reservation) => {
    setConfirmStartId(null);
    setStartingId(r.reservation_id);
    setNotice(null);
    try {
      const res = await fetch(`/api/reservations/${r.reservation_id}/start-work`, { method: 'POST' });
      const result = await res.json();
      if (result.success) {
        const { work_id, employee_name, employee_email, email_sent } = result.data;
        setNotice({
          type: 'success',
          text: email_sent
            ? `${r.customer_name}-ийн ажил үүслээ. ${employee_name} (${employee_email})-д имэйлээр мэдэгдэл илгээлээ.`
            : `${r.customer_name}-ийн ажил үүслээ. Гэхдээ ${employee_name}-д имэйл илгээж чадсангүй — ажилтанд өөрөө мэдэгдэнэ үү.`,
          href: `/dashboard/workshop/${work_id}`,
          linkText: 'Ажлыг нээх',
        });
      } else {
        setNotice({
          type: 'error',
          text: result.error || 'Ажил үүсгэхэд алдаа гарлаа',
          ...(result.data?.work_id ? { href: `/dashboard/workshop/${result.data.work_id}`, linkText: 'Ажлыг нээх' } : {}),
        });
      }
      await fetchReservations();
    } catch (err) {
      console.error('Start work failed:', err);
      setNotice({ type: 'error', text: 'Сервертэй холбогдоход алдаа гарлаа. Дахин оролдоно уу.' });
    } finally {
      setStartingId(null);
    }
  };

  const handleDelete = async () => {
    if (!editing || !confirm('Энэ захиалгыг бүр мөсөн устгах уу?')) return;
    try {
      setSaving(true);
      const res = await fetch(`/api/reservations/${editing.reservation_id}`, { method: 'DELETE' });
      const result = await res.json();
      if (result.success) {
        setIsModalOpen(false);
        await fetchReservations();
      } else {
        setFormError(result.error || 'Устгахад алдаа гарлаа');
      }
    } finally {
      setSaving(false);
    }
  };

  const today = localDate();

  return (
    <div className="space-y-5 sm:space-y-6 pb-20 text-slate-800 dark:text-slate-100">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-100 dark:border-slate-800 shadow-2xs">
        <div>
          <h1 className="text-lg sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">Захиалга</h1>
          <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5">Харилцагчийн үйлчлүүлэх өдөр, цагийг захиалж, хариуцах ажилтанд хуваарилах</p>
        </div>
        <button
          onClick={() => openCreate()}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white px-5 py-3 rounded-xl sm:rounded-2xl text-xs font-bold transition-all shadow-md shadow-red-500/20 active:scale-95 cursor-pointer"
        >
          <Plus size={16} /> Шинэ захиалга
        </button>
      </div>

      {/* Өнөөдрийн тойм — карт дээр дарахад доорх жагсаалт өнөөдрийн захиалгыг тухайн төлөвөөр шүүнэ */}
      <section className="space-y-3" aria-labelledby="today-heading">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-1.5 px-1">
          <div>
            <h2 id="today-heading" className="text-sm font-black text-slate-900 dark:text-white">
              Өнөөдөр · {formatDateHeading(today).replace('Өнөөдөр · ', '')}
            </h2>
            <p className="text-[11px] text-slate-400">Карт дээр дарж өнөөдрийн захиалгыг тухайн төлөвөөр харна</p>
          </div>
          {!loading && (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {todayStats.next ? (
                <>
                  Дараагийн захиалга:{' '}
                  <button
                    type="button"
                    onClick={() => openEdit(todayStats.next!)}
                    className="font-bold text-red-600 dark:text-red-400 hover:underline cursor-pointer"
                  >
                    {todayStats.next.start_time} · {todayStats.next.customer_name}
                  </button>
                </>
              ) : todayStats.total > 0 ? (
                'Өнөөдөр цаашид хүлээгдэж буй захиалга алга'
              ) : (
                'Өнөөдөр захиалга алга'
              )}
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            {
              label: 'Нийт захиалга',
              value: todayStats.total,
              tip: 'Өнөөдрийн бүх захиалгаас цуцлагдсан болон ирээгүйг хассан тоо. Дарвал өнөөдрийн жагсаалтыг харуулна.',
              status: 'all',
              color: 'text-slate-900 dark:text-white',
              dot: 'bg-slate-400',
              hint:
                todayStats.cancelled + todayStats.noShow > 0
                  ? `${[todayStats.cancelled > 0 && `цуцлагдсан ${todayStats.cancelled}`, todayStats.noShow > 0 && `ирээгүй ${todayStats.noShow}`].filter(Boolean).join(", ")} захиалгыг тооцоогүй`
                  : 'Өнөөдөр үйлчлүүлэх бүх захиалга',
            },
            {
              label: 'Баталгаажуулах',
              value: todayStats.pending,
              tip: 'Өнөөдрийн “Хүлээгдэж буй” төлөвтэй захиалгын тоо. Дарвал тэдгээрийг шүүж харуулна.',
              status: 'pending',
              color: 'text-amber-600 dark:text-amber-400',
              dot: STATUS_META.pending.dot,
              hint: todayStats.pending > 0 ? 'Хүлээгдэж буй — харилцагчтай холбогдож баталгаажуулна уу' : 'Баталгаажуулах захиалга алга',
            },
            {
              label: 'Ирэхийг хүлээж буй',
              value: todayStats.confirmed,
              tip: 'Өнөөдрийн “Баталгаажсан” төлөвтэй захиалгын тоо. Дарвал тэдгээрийг шүүж харуулна.',
              status: 'confirmed',
              color: 'text-blue-600 dark:text-blue-400',
              dot: STATUS_META.confirmed.dot,
              hint: 'Баталгаажсан, харилцагч хараахан ирээгүй',
            },
            {
              label: 'Үйлчлүүлсэн',
              value: todayStats.completed,
              tip: `Өнөөдрийн “Үйлчлүүлсэн” төлөвтэй захиалгын тоо. Ногоон шугам = үйлчлүүлсэн ÷ нийт захиалга (${todayStats.completed} ÷ ${todayStats.total}).`,
              status: 'completed',
              color: 'text-emerald-600 dark:text-emerald-400',
              dot: STATUS_META.completed.dot,
              hint: todayStats.total > 0 ? `Өнөөдрийн ${todayStats.total} захиалгаас ${todayStats.completed} нь дууссан` : 'Өнөөдөр үйлчилгээ хийгдээгүй',
              progress: todayStats.total > 0 ? (todayStats.completed / todayStats.total) * 100 : 0,
            },
          ].map((s) => {
            const active = activePreset === 'today' && statusFilter === s.status;
            return (
              <Tooltip key={s.label} text={s.tip} className="flex">
              <button
                onClick={() => showToday(s.status)}
                aria-pressed={active}
                className={`group w-full text-left bg-white dark:bg-slate-900 p-4 rounded-2xl border shadow-2xs transition-all cursor-pointer hover:border-red-300 dark:hover:border-slate-600 flex flex-col ${
                  active ? 'border-red-500 ring-2 ring-red-500/15' : 'border-slate-100 dark:border-slate-800'
                }`}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className={`${labelClass} flex items-center gap-1.5`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} aria-hidden />
                    {s.label}
                  </span>
                  <ChevronRight size={14} className="text-slate-300 dark:text-slate-600 group-hover:text-red-500 transition-colors" aria-hidden />
                </span>
                <span className={`text-2xl font-black mt-1 tabular-nums ${s.color}`}>{loading ? '–' : s.value}</span>
                {'progress' in s && s.progress !== undefined && (
                  <span className="mt-1.5 h-1 rounded bg-slate-100 dark:bg-slate-800 overflow-hidden" aria-hidden>
                    <span className="block h-full rounded bg-emerald-500" style={{ width: `${s.progress}%` }} />
                  </span>
                )}
                <span className="mt-1.5 text-[11px] leading-snug text-slate-500 dark:text-slate-400">{loading ? '' : s.hint}</span>
              </button>
              </Tooltip>
            );
          })}
        </div>
      </section>

      {/* Шүүлтүүр */}
      <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-100 dark:border-slate-800 shadow-2xs space-y-4">
        {/* Хайлт */}
        <div className="flex items-center gap-2.5 bg-slate-50 dark:bg-slate-800/60 px-3.5 py-3 rounded-xl border border-slate-200/70 dark:border-slate-700 focus-within:border-red-500 focus-within:bg-white dark:focus-within:bg-slate-900 transition-all">
          <Search size={16} className="text-slate-400 shrink-0" />
          <input
            ref={searchInputRef}
            type="search"
            placeholder="Харилцагчийн нэр, утасны дугаар, регистрээр хайх..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-sm font-bold text-slate-800 dark:text-slate-100 bg-transparent outline-none placeholder:font-semibold placeholder:text-slate-400"
          />
          {searchQuery ? (
            <button onClick={() => setSearchQuery('')} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer" aria-label="Хайлт цэвэрлэх">
              <X size={15} />
            </button>
          ) : (
            <kbd className="hidden sm:inline text-[10px] font-bold text-slate-400 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-0.5">/</kbd>
          )}
        </div>

        {/* Огнооны интервал */}
        <div className="space-y-2">
          <p className={labelClass}>Огноо</p>
          <div className="flex flex-col xl:flex-row xl:items-center gap-2.5">
            <div className="flex gap-1.5 overflow-x-auto pb-1 xl:pb-0 -mx-1 px-1">
              {PRESETS.map((p) => (
                <button
                  key={p.key}
                  onClick={() => applyPreset(p.key)}
                  className={`shrink-0 px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                    activePreset === p.key
                      ? 'bg-red-600 border-red-600 text-white shadow-sm shadow-red-500/20'
                      : 'bg-slate-50/70 dark:bg-slate-800/60 border-slate-200/70 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-red-300 dark:hover:border-slate-500'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 xl:ml-auto">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className={`${filterClass} xl:w-40 ${!activePreset ? 'border-red-500!' : ''}`}
                aria-label="Эхлэх огноо"
              />
              <ArrowRight size={14} className="text-slate-400 shrink-0" />
              <input
                type="date"
                value={dateTo}
                min={dateFrom || undefined}
                onChange={(e) => setDateTo(e.target.value)}
                className={`${filterClass} xl:w-40 ${!activePreset ? 'border-red-500!' : ''}`}
                aria-label="Дуусах огноо"
              />
            </div>
          </div>
        </div>

        {/* Бусад шүүлтүүр */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <div className="flex flex-col gap-1">
            <label className={labelClass}>Хариуцах ажилтан</label>
            <select value={employeeFilter} onChange={(e) => setEmployeeFilter(e.target.value)} className={`${filterClass} cursor-pointer`}>
              <option value="all">Бүх ажилтан</option>
              <option value="none">Хуваарилаагүй</option>
              {options.employees.map((emp) => (
                <option key={emp.user_id} value={emp.user_id}>
                  {emp.last_name} {emp.first_name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelClass}>Харилцагчийн төрөл</label>
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className={`${filterClass} cursor-pointer`}>
              <option value="all">Бүгд</option>
              <option value="individual">Хувь хүн</option>
              <option value="company">Байгууллага</option>
            </select>
          </div>
        </div>

        {/* Төлөвийн таб */}
        <div className="flex gap-1.5 overflow-x-auto pt-3 border-t border-slate-100 dark:border-slate-800 -mx-1 px-1">
          {(['all', ...STATUSES] as const).map((s) => {
            const active = statusFilter === s;
            return (
              <Tooltip key={s} className="shrink-0" text={s === 'all' ? 'Бүх төлөвийн захиалгыг харуулна' : STATUS_META[s].description}>
              <button
                onClick={() => setStatusFilter(s)}
                className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  active
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {s !== 'all' && <span className={`w-1.5 h-1.5 rounded-full ${STATUS_META[s].dot}`} />}
                {s === 'all' ? 'Бүгд' : STATUS_META[s].label}
                <span className={`text-[10px] px-1.5 rounded-md ${active ? 'bg-white/20 dark:bg-slate-900/10' : 'bg-slate-100 dark:bg-slate-800'}`}>
                  {statusCounts[s]}
                </span>
              </button>
              </Tooltip>
            );
          })}
        </div>

        {activeChips.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            {activeChips.map((chip) => (
              <span
                key={chip.label}
                className="inline-flex items-center gap-1 pl-2.5 pr-1 py-1 rounded-lg bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 text-[11px] font-bold"
              >
                {chip.label}
                <button onClick={chip.clear} className="p-0.5 rounded hover:bg-red-100 dark:hover:bg-red-900 cursor-pointer" aria-label="Шүүлтүүр арилгах">
                  <X size={12} />
                </button>
              </span>
            ))}
            <button
              onClick={resetFilters}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-500 hover:text-rose-600 dark:hover:text-rose-400 transition-colors cursor-pointer ml-auto"
            >
              <RotateCcw size={12} /> Бүгдийг цэвэрлэх
            </button>
          </div>
        )}
      </div>

      {notice && (
            <div
              role={notice.type === 'error' ? 'alert' : 'status'}
              className={`flex items-start gap-2.5 px-4 py-3 rounded-2xl border text-xs font-bold ${
                notice.type === 'error'
                  ? 'border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300'
                  : 'border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
              }`}
            >
              {notice.type === 'error' ? <AlertCircle size={16} className="shrink-0" /> : <CheckCircle2 size={16} className="shrink-0" />}
              <p className="flex-1 leading-relaxed">
                {notice.text}
                {notice.href && (
                  <>
                    {' '}
                    <Link href={notice.href} className="underline underline-offset-2 whitespace-nowrap">
                      {notice.linkText ?? 'Нээх'} →
                    </Link>
                  </>
                )}
              </p>
              <button type="button" onClick={() => setNotice(null)} className="p-0.5 rounded opacity-60 hover:opacity-100 cursor-pointer" aria-label="Хаах">
                <X size={14} />
              </button>
            </div>
          )}

      {/* Жагсаалт */}
      {loading ? (
        <Loading />
      ) : grouped.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 p-12 rounded-3xl border border-slate-100 dark:border-slate-800 text-center space-y-4 shadow-2xs">
          <div className="w-12 h-12 bg-slate-50 dark:bg-slate-800 text-slate-300 dark:text-slate-600 rounded-2xl flex items-center justify-center mx-auto">
            <CalendarCheck size={24} />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-800 dark:text-slate-100">Захиалга олдсонгүй</p>
            <p className="text-xs text-slate-400 mt-0.5">
              {activeChips.length > 0 ? 'Хайлт эсвэл шүүлтүүрээ өөрчилж үзнэ үү.' : 'Шинэ захиалга бүртгэж эхлээрэй.'}
            </p>
          </div>
          <div className="flex items-center justify-center gap-2">
            {activeChips.length > 0 && (
              <button
                onClick={resetFilters}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl transition-all cursor-pointer"
              >
                <RotateCcw size={12} /> Шүүлтүүр арилгах
              </button>
            )}
            <button
              onClick={() => openCreate(rangeStart && rangeStart === rangeEnd ? rangeStart : undefined)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer"
            >
              <Plus size={12} /> Шинэ захиалга
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          <p className="text-xs font-bold text-slate-400 px-1">
            Нийт <span className="text-slate-800 dark:text-slate-200">{filtered.length}</span> захиалга,{' '}
            <span className="text-slate-800 dark:text-slate-200">{grouped.length}</span> өдөр{' '}
            <InfoTip size={12} text="Одоогийн хугацаа, төлөв, хайлтын шүүлтүүрт таарсан захиалгын тоо ба тэдгээр хэдэн өөр өдөрт хуваарилагдсан." />
          </p>
          {grouped.map(([date, items]) => (
            <section key={date} className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <h2 className={`flex items-center gap-2 text-xs font-black ${date === today ? 'text-red-600 dark:text-red-400' : 'text-slate-500 dark:text-slate-400'}`}>
                  <CalendarDays size={14} /> {formatDateHeading(date)}
                  <Tooltip text="Энэ өдрийн захиалгын тоо (шүүлтүүрийн дагуу)">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">{items.length}</span>
                  </Tooltip>
                </h2>
                {date >= today && (
                  <button
                    onClick={() => openCreate(date)}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-400 hover:text-red-600 transition-colors cursor-pointer"
                  >
                    <Plus size={12} /> Нэмэх
                  </button>
                )}
              </div>
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-2xs divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
                {items.map((r) => (
                  <div
                    key={r.reservation_id}
                    onClick={() => openEdit(r)}
                    className={`group flex flex-col md:flex-row md:items-center gap-3 md:gap-5 p-4 border-l-4 cursor-pointer hover:bg-red-50/40 dark:hover:bg-slate-800/60 transition-colors ${
                      r.status === 'cancelled' || r.status === 'no_show' ? 'opacity-60' : ''
                    } ${STATUS_META[r.status].bar}`}
                  >
                    <div className="flex items-center gap-2 md:w-32 shrink-0">
                      <Clock size={15} className="text-red-500" />
                      <span className="text-sm font-black text-slate-900 dark:text-white tabular-nums">
                        {r.start_time}{r.end_time ? `–${r.end_time}` : ''}
                      </span>
                    </div>

                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {r.customer_type === 'company' ? (
                          <Building2 size={14} className="text-slate-400 shrink-0" />
                        ) : (
                          <User size={14} className="text-slate-400 shrink-0" />
                        )}
                        <span className="text-sm font-bold text-slate-900 dark:text-white truncate group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors">
                          {r.customer_name}
                        </span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                          {r.customer_type === 'company' ? 'Байгууллага' : 'Хувь хүн'}
                        </span>
                      </div>
                      <div className="flex items-center gap-x-3 gap-y-1 flex-wrap text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                        {r.customer_phone && (
                          <a
                            href={`tel:${r.customer_phone}`}
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 hover:text-red-600 hover:underline"
                          >
                            <Phone size={11} /> {r.customer_phone}
                          </a>
                        )}
                        <span className="inline-flex items-center gap-1">
                          <Briefcase size={11} /> {servicesLabel(r.services)}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <UserCog size={11} />
                          {r.employee_name || <span className="italic">Хуваарилаагүй</span>}
                        </span>
                      </div>
                      {r.note && <p className="text-[11px] text-slate-400 line-clamp-1">{r.note}</p>}
                    </div>

                    <div className="flex items-center gap-2 shrink-0 flex-wrap" onClick={(e) => e.stopPropagation()}>
                      {r.work_id ? (
                        // Ажилд шилжсэн: төлөвийг ажил удирдана
                        <Tooltip text={STATUS_META.in_service.description}>
                        <Link
                          href={`/dashboard/workshop/${r.work_id}`}
                          className={`inline-flex items-center gap-1.5 text-[11px] font-extrabold px-2.5 py-1.5 rounded-full border hover:underline ${STATUS_META.in_service.className}`}
                          aria-label="Энэ захиалгаас үүссэн ажлыг нээх"
                        >
                          <Wrench size={12} aria-hidden />
                          Ажил: {WORK_STATUS_LABELS[r.work_status ?? ''] ?? r.work_status}
                          <ChevronRight size={12} aria-hidden />
                        </Link>
                        </Tooltip>
                      ) : (
                      <>
                      {STARTABLE_STATUSES.includes(r.status) && r.reservation_date <= today && (
                        confirmStartId === r.reservation_id ? (
                          <span className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => startWork(r)}
                              className="inline-flex items-center gap-1 text-[11px] font-extrabold px-2.5 py-1.5 rounded-full bg-violet-600 hover:bg-violet-700 text-white cursor-pointer"
                            >
                              <CheckCircle2 size={12} aria-hidden /> Тийм, эхлүүлэх
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmStartId(null)}
                              className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                              aria-label="Болих"
                            >
                              <X size={12} />
                            </button>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmStartId(r.reservation_id)}
                            disabled={startingId === r.reservation_id}
                            className="inline-flex items-center gap-1 text-[11px] font-extrabold px-2.5 py-1.5 rounded-full border border-violet-200 dark:border-violet-800 text-violet-700 dark:text-violet-300 bg-violet-50 dark:bg-violet-950/40 hover:bg-violet-100 dark:hover:bg-violet-950 disabled:opacity-50 cursor-pointer"
                            title="Харилцагч ирсэн: захиалгын мэдээллээр ажил үүсгэж, хариуцах ажилтанд имэйлээр мэдэгдэнэ"
                          >
                            <PlayCircle size={12} aria-hidden />
                            {startingId === r.reservation_id ? 'Үүсгэж байна...' : 'Ажил эхлүүлэх'}
                          </button>
                        )
                      )}
                      <Tooltip text={STATUS_META[r.status].description}>
                      <select
                        value={r.status}
                        onChange={(e) => handleStatusChange(r, e.target.value as ReservationStatus)}
                        className={`text-[11px] font-extrabold px-2.5 py-1.5 rounded-full border outline-none cursor-pointer ${STATUS_META[r.status].className}`}
                        aria-label="Төлөв солих"
                      >
                        {MANUAL_STATUSES.map((value) => (
                          <option key={value} value={value}>{STATUS_META[value].label}</option>
                        ))}
                      </select>
                      </Tooltip>
                      <button
                        onClick={() => openEdit(r)}
                        className="p-2 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        aria-label="Засах"
                      >
                        <Pencil size={15} />
                      </button>
                      </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* Захиалга үүсгэх / засах */}
      {isModalOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setIsModalOpen(false);
          }}
        >
          <div className="bg-white dark:bg-slate-900 max-w-lg w-full rounded-3xl p-6 sm:p-8 space-y-5 shadow-2xl border border-slate-100 dark:border-slate-800 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="font-black text-base text-slate-900 dark:text-white">
                  {editing ? 'Захиалга засах' : 'Шинэ захиалга'}
                </h3>
                {editing && (
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {editing.customer_name} · {formatDate(editing.reservation_date)} {editing.start_time}
                  </p>
                )}
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl cursor-pointer" aria-label="Хаах">
                <X size={18} />
              </button>
            </div>

            <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5">Харилцагч *</label>
                <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl mb-2">
                  {(['individual', 'company'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setFormData({ ...formData, customer_type: t, customer_id: '' })}
                      className={`inline-flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        formData.customer_type === t
                          ? 'bg-white dark:bg-slate-900 text-red-600 dark:text-red-400 shadow-2xs'
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                    >
                      {t === 'individual' ? <User size={13} /> : <Building2 size={13} />}
                      {t === 'individual' ? 'Хувь хүн' : 'Байгууллага'}
                    </button>
                  ))}
                </div>
                <SearchSelect
                  key={formData.customer_type}
                  required={!customerMissing}
                  requiredMessage="Харилцагчаа сонгоно уу."
                  name="customer_id"
                  invalid={!!errors.customer_id}
                  options={customerOptions[formData.customer_type]}
                  value={formData.customer_id}
                  onChange={(id) => setFormData({ ...formData, customer_id: id })}
                  placeholder={formData.customer_type === 'individual' ? 'Нэр эсвэл утасны дугаараар хайх...' : 'Нэр, регистр эсвэл утсаар хайх...'}
                  emptyText="Харилцагч олдсонгүй"
                  fallbackLabel={customerMissing ? `${editing?.customer_name} (хадгалсан)` : undefined}
                  className="py-0.5 dark:bg-slate-800!"
                  aria-label="Харилцагч"
                />
                <FieldError message={errors.customer_id} />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300">Үйлчилгээнүүд *</label>
                  {formData.services.length > 0 && (
                    <span className="text-[11px] font-bold text-slate-400">{formData.services.length} үйлчилгээ</span>
                  )}
                </div>
                {formData.services.length > 0 && (
                  <div className="mb-2 rounded-xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-800">
                    {formData.services.map((line, i) => (
                      <div key={`${line.service_id || line.service_name}-${i}`} className="flex items-center gap-2 px-3 py-2">
                        <Briefcase size={13} className="text-slate-400 shrink-0" />
                        <span className="flex-1 min-w-0 text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                          {line.service_name}
                          {!line.service_id && (
                            <span className="ml-1.5 text-[9px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 font-semibold">устсан</span>
                          )}
                        </span>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums whitespace-nowrap">
                          {line.duration ? formatDuration(line.duration) : '—'}
                        </span>
                        <span className="w-24 text-right text-xs font-bold text-slate-900 dark:text-white tabular-nums whitespace-nowrap">
                          {line.price.toLocaleString()} ₮
                        </span>
                        <button
                          type="button"
                          onClick={() => removeService(i)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                          aria-label={`${line.service_name} хасах`}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                    <div className="flex items-center justify-between gap-2 px-3 py-2.5 bg-slate-50/70 dark:bg-slate-800/40 rounded-b-xl text-xs">
                      <span className="font-bold text-slate-500 dark:text-slate-400">
                        Нийт{servicesDuration > 0 && <> · <span className="text-slate-800 dark:text-slate-200">{formatDuration(servicesDuration)}</span></>}{' '}
                        <InfoTip size={12} text="Сонгосон үйлчилгээнүүдийн үнэ болон үргэлжлэх хугацааны нийлбэр. Хугацаа нь каталогт тохируулсан үйлчилгээ бүрийн минутаас бодогдоно." />
                      </span>
                      <span className="text-sm font-black text-red-600 dark:text-red-400 tabular-nums">{servicesPrice.toLocaleString()} ₮</span>
                    </div>
                  </div>
                )}
                <SearchSelect
                  options={serviceOptions}
                  value=""
                  onChange={addService}
                  clearable={false}
                  required={formData.services.length === 0}
                  requiredMessage="Дор хаяж нэг үйлчилгээ сонгоно уу."
                  name="services"
                  invalid={formData.services.length === 0 && !!errors.services}
                  placeholder={formData.services.length > 0 ? 'Өөр үйлчилгээ нэмэх...' : 'Үйлчилгээ хайж нэмэх...'}
                  emptyText={options.services.length > 0 && serviceOptions.length === 0 ? 'Бүх үйлчилгээг нэмсэн байна' : 'Үйлчилгээ олдсонгүй'}
                  className="py-0.5 dark:bg-slate-800!"
                  aria-label="Үйлчилгээ нэмэх"
                />
                {/* Үйлчилгээ нэмэгдмэгц нуугдмал талбар алга болдог тул алдааг энд шүүнэ */}
                {formData.services.length === 0 && <FieldError message={errors.services} />}
                {servicesDuration > 0 && (
                  <p className="mt-1 text-[11px] text-slate-400">Дуусах цагийг үйлчилгээнүүдийн нийт хугацаагаар автоматаар бодно.</p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Өдөр *</label>
                  <input
                    type="date"
                    required
                    name="reservation_date"
                    data-required-message="Захиалгын өдрөө сонгоно уу."
                    // Шинэ захиалгыг өнгөрсөн өдөрт бүртгэхгүй (засахдаа хуучин огноог хэвээр үлдээж болно)
                    min={editing ? undefined : localDate()}
                    data-min-message="Өнгөрсөн өдөрт захиалга бүртгэх боломжгүй."
                    value={formData.reservation_date}
                    onChange={(e) => setFormData({ ...formData, reservation_date: e.target.value })}
                    className={withError(inputClass, 'reservation_date')}
                  />
                  <FieldError message={errors.reservation_date} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Эхлэх цаг *</label>
                  <input
                    type="time"
                    required
                    name="start_time"
                    data-required-message="Эхлэх цагаа оруулна уу."
                    value={formData.start_time}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        start_time: e.target.value,
                        end_time: suggestEndTime(e.target.value, formData.services) || formData.end_time,
                      })
                    }
                    className={withError(inputClass, 'start_time')}
                  />
                  <FieldError message={errors.start_time} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Дуусах цаг</label>
                  <input
                    type="time"
                    name="end_time"
                    value={formData.end_time}
                    min={minEndTime}
                    data-min-message="Дуусах цаг эхлэх цагаас хойш байх ёстой."
                    onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                    className={withError(inputClass, 'end_time')}
                  />
                  <FieldError message={errors.end_time} />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Хариуцах ажилтан *</label>
                  <SearchSelect
                    required
                    requiredMessage="Хариуцах ажилтнаа сонгоно уу."
                    name="assigned_employee"
                    invalid={!!errors.assigned_employee}
                    options={employeeOptions}
                    value={formData.assigned_employee}
                    onChange={(id) => setFormData({ ...formData, assigned_employee: id })}
                    placeholder="Ажилтан хайх..."
                    emptyText="Ажилтан олдсонгүй"
                    className="py-0.5 dark:bg-slate-800!"
                    aria-label="Хариуцах ажилтан"
                  />
                  <FieldError message={errors.assigned_employee} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Төлөв</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as ReservationStatus })}
                    className={`${inputClass} cursor-pointer`}
                  >
                    {MANUAL_STATUSES.map((value) => (
                      <option key={value} value={value}>{STATUS_META[value].label}</option>
                    ))}
                  </select>
                  <p className="mt-1 text-[11px] leading-snug text-slate-500 dark:text-slate-400">{STATUS_META[formData.status].description}</p>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300">Тэмдэглэл</label>
                  {formData.note.length > NOTE_MAX * 0.8 && (
                    <span className={`text-[11px] font-bold tabular-nums ${formData.note.length >= NOTE_MAX ? 'text-rose-500' : 'text-slate-400'}`}>
                      {formData.note.length} / {NOTE_MAX}
                    </span>
                  )}
                </div>
                <textarea
                  name="note"
                  maxLength={NOTE_MAX}
                  value={formData.note}
                  onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                  placeholder="Нэмэлт мэдээлэл..."
                  className={inputClass}
                  rows={3}
                />
              </div>

              <FormErrorBanner message={formError} onClose={() => setFormError('')} />

              <div className="flex items-center justify-between gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <div>
                  {editing && isAdmin && (
                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={saving}
                      className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 disabled:opacity-50 transition-all cursor-pointer"
                    >
                      <Trash2 size={14} /> Устгах
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer">
                    Цуцлах
                  </button>
                  <button type="submit" disabled={saving} className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 transition-all cursor-pointer">
                    {saving ? 'Хадгалж байна...' : 'Хадгалах'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// useSearchParams-ийг Suspense дотор ашиглана (build алдаа гаргахгүй)
export default function ReservationsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen w-full items-center justify-center p-10">
          <Loading />
        </div>
      }
    >
      <ReservationsContent />
    </Suspense>
  );
}
