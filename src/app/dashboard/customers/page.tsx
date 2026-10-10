'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Building2, User, Plus, Search, Mail, Phone, MapPin,
  X, CheckCircle2, LayoutList, LayoutGrid, ChevronLeft, ChevronRight
} from 'lucide-react';
import Loading from '@/src/app/components/loading';
import InfoTip from '@/src/app/components/InfoTip';
import { BIRTH_DATE_MIN, GENDERS, calcAge, isGender, todayIsoDate, type Gender } from '@/src/lib/customer-fields';

interface Customer {
  customer_id: string;
  customer_type: 'company' | 'individual';
  name?: string;
  first_name?: string;
  last_name?: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  tax_number: string | null;
  status: string | null;
  male?: string | null;
  birth_date?: string | null;
}

const EMPTY_FORM = {
  customer_type: 'company' as 'company' | 'individual',
  name: '',
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  address: '',
  tax_number: '',
  male: '' as Gender | '',
  birth_date: '',
};

// Хувь хүний товч мэдээлэл: "Эмэгтэй · 34 нас"
function individualSummary(customer: Customer) {
  const age = calcAge(customer.birth_date);
  return [isGender(customer.male) ? customer.male : null, age !== null ? `${age} нас` : null]
    .filter(Boolean)
    .join(' · ');
}

function CustomersContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  // Шүүлтүүр болон хуудасны төлөвийг URL-аас эхлүүлнэ (дэлгэрэнгүй хуудаснаас буцахад хадгалагдана)
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get('q') || '');
  const [activeTab, setActiveTab] = useState<'all' | 'company' | 'individual'>(() => {
    const tab = searchParams.get('tab');
    return tab === 'company' || tab === 'individual' ? tab : 'all';
  });
  const [currentPage, setCurrentPage] = useState(() => {
    const pageParam = searchParams.get('page');
    return pageParam ? parseInt(pageParam, 10) || 1 : 1;
  });
  const itemsPerPage = 9;
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [genderMissing, setGenderMissing] = useState(false);

  const [formData, setFormData] = useState(EMPTY_FORM);
  const formAge = calcAge(formData.birth_date);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/customers');
      const result = await res.json();
      if (result.success) {
        setCustomers(result.data);
      }
    } catch (err) {
      console.error('Failed to fetch customers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  // Шүүлтүүр болон хуудасны төлөвийг URL-тай синк хийх.
  // Хуудсыг зөвхөн шүүлтүүр бодитоор өөрчлөгдсөн үед 1 болгоно (mount үед биш).
  const filterKey = JSON.stringify([searchQuery, activeTab]);
  const prevFilterKey = useRef(filterKey);

  useEffect(() => {
    const filtersChanged = prevFilterKey.current !== filterKey;
    prevFilterKey.current = filterKey;

    const page = filtersChanged ? 1 : currentPage;
    if (filtersChanged) setCurrentPage(1);

    const params = new URLSearchParams();
    if (searchQuery) params.set('q', searchQuery);
    if (activeTab !== 'all') params.set('tab', activeTab);
    if (page > 1) params.set('page', page.toString());

    const query = params.toString();
    if (query !== searchParams.toString()) {
      router.replace(`/dashboard/customers${query ? `?${query}` : ''}`, { scroll: false });
    }
  }, [filterKey, currentPage]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.customer_type === 'individual' && !formData.male) {
      setGenderMissing(true);
      return;
    }
    try {
      setSaving(true);
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const result = await res.json();
      if (result.success) {
        setIsModalOpen(false);
        setFormData(EMPTY_FORM);
        setGenderMissing(false);
        fetchCustomers();
      } else {
        alert(result.error || 'Хадгалахад алдаа гарлаа');
      }
    } catch (err) {
      console.error('Error saving customer:', err);
      alert('Сервертэй холбогдоход алдаа гарлаа');
    } finally {
      setSaving(false);
    }
  };

  const filteredCustomers = customers.filter(c => {
    const displayName = c.customer_type === 'company' ? c.name : `${c.last_name || ''} ${c.first_name || ''}`;
    const matchesSearch = (displayName && displayName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (c.email && c.email.toLowerCase().includes(searchQuery.toLowerCase()));
    
    if (activeTab === 'company') return matchesSearch && c.customer_type === 'company';
    if (activeTab === 'individual') return matchesSearch && c.customer_type === 'individual';
    return matchesSearch;
  });

  const totalPages = Math.ceil(filteredCustomers.length / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentCustomers = filteredCustomers.slice(indexOfFirstItem, indexOfLastItem);

  return (
    <div className="space-y-6 pb-20 text-slate-800 dark:text-slate-100">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-2xs">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">Харилцагчид</h1>
          <p className="text-xs text-slate-400 dark:text-slate-400 mt-0.5">Компани болон хувь хүний харилцагчдын жагсаалт</p>
        </div>
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-2xl text-xs font-bold transition-all shadow-sm shadow-blue-500/20 cursor-pointer"
        >
          <Plus size={16} /> Шинэ харилцагч нэмэх
        </button>
      </div>

      {/* Tabs, Search and View Mode controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-2xs">
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'all' 
                ? 'bg-blue-600 text-white shadow-sm' 
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            Бүгд
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('company')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'company' 
                ? 'bg-blue-600 text-white shadow-sm' 
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            Байгууллага
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('individual')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'individual' 
                ? 'bg-blue-600 text-white shadow-sm' 
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            Хувь хүн
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-3 bg-white dark:bg-slate-900 px-4 py-2.5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-2xs sm:w-80">
            <Search size={18} className="text-slate-400 dark:text-slate-500 shrink-0" />
            <input 
              type="text"
              placeholder="Хайх..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs font-bold text-slate-800 dark:text-slate-100 bg-transparent outline-none"
            />
          </div>

          <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-2xs">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-xl transition-all cursor-pointer ${
                viewMode === 'list' 
                  ? 'bg-blue-600 text-white shadow-sm' 
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
              title="Жагсаалтаар харах"
            >
              <LayoutList size={16} />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-xl transition-all cursor-pointer ${
                viewMode === 'grid' 
                  ? 'bg-blue-600 text-white shadow-sm' 
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
              title="Кардаар харах"
            >
              <LayoutGrid size={16} />
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <Loading />
      ) : filteredCustomers.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 p-12 rounded-3xl border border-slate-100 dark:border-slate-800 text-center space-y-3">
          <Building2 size={40} className="mx-auto text-slate-300 dark:text-slate-600" />
          <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Харилцагч олдсонгүй</p>
          <p className="text-xs text-slate-400 dark:text-slate-500">Шинэ харилцагч нэмж бүртгэнэ үү.</p>
        </div>
      ) : viewMode === 'list' ? (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 text-[11px] font-black uppercase text-slate-400 dark:text-slate-400 tracking-wider">
                  <th className="py-4 px-6">Харилцагч</th>
                  <th className="py-4 px-6">
                    <span className="inline-flex items-center gap-1">Төрөл / ТТД <InfoTip size={12} text="Төрөл: хувь хүн эсвэл байгууллага. ТТД: татвар төлөгчийн дугаар (байгууллагын регистр)." /></span>
                  </th>
                  <th className="py-4 px-6">Холбоо барих</th>
                  <th className="py-4 px-6">Хаяг</th>
                  <th className="py-4 px-6">Төлөв</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300">
                {currentCustomers.map((customer) => {
                  const displayName = customer.customer_type === 'company' 
                    ? customer.name 
                    : `${customer.last_name || ''} ${customer.first_name || ''}`.trim();

                  return (
                    <tr 
                      key={customer.customer_id} 
                      onClick={() => router.push(`/dashboard/customers/${customer.customer_id}?type=${customer.customer_type}`)}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/60 transition-colors cursor-pointer"
                    >
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black shrink-0 ${
                            customer.customer_type === 'company' 
                              ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400' 
                              : 'bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400'
                          }`}>
                            {customer.customer_type === 'company' ? <Building2 size={18} /> : <User size={18} />}
                          </div>
                          <span className="font-bold text-slate-900 dark:text-white">{displayName}</span>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="font-bold text-slate-800 dark:text-slate-200">
                          {customer.customer_type === 'company' ? 'Байгууллага' : 'Хувь хүн'}
                        </div>
                        <div className="text-[10px] text-slate-400 dark:text-slate-500 font-extrabold uppercase">
                          {customer.customer_type === 'company'
                            ? `ТТД: ${customer.tax_number || 'Байхгүй'}`
                            : individualSummary(customer) || '-'}
                        </div>
                      </td>
                      <td className="py-4 px-6 space-y-1">
                        <div className="flex items-center gap-1.5">
                          <Mail size={13} className="text-slate-400 dark:text-slate-500 shrink-0" />
                          <span>{customer.email || 'Имэйл байхгүй'}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Phone size={13} className="text-slate-400 dark:text-slate-500 shrink-0" />
                          <span>{customer.phone || 'Утас байхгүй'}</span>
                        </div>
                      </td>
                      <td className="py-4 px-6 max-w-xs truncate">
                        <div className="flex items-center gap-1.5">
                          <MapPin size={13} className="text-slate-400 dark:text-slate-500 shrink-0" />
                          <span className="truncate">{customer.address || 'Хаяг байхгүй'}</span>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                          <CheckCircle2 size={12} /> Идэвхтэй
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {currentCustomers.map((customer) => {
            const displayName = customer.customer_type === 'company' 
              ? customer.name 
              : `${customer.last_name || ''} ${customer.first_name || ''}`.trim();

            return (
              <div 
                key={customer.customer_id} 
                onClick={() => router.push(`/dashboard/customers/${customer.customer_id}?type=${customer.customer_type}`)}
                className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-2xs space-y-4 hover:border-blue-200 dark:hover:border-blue-800 transition-all cursor-pointer"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-base shrink-0 ${
                      customer.customer_type === 'company' 
                        ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400' 
                        : 'bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400'
                    }`}>
                      {customer.customer_type === 'company' ? <Building2 size={20} /> : <User size={20} />}
                    </div>
                    <div>
                      <h3 className="font-black text-sm text-slate-900 dark:text-white">{displayName}</h3>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase">
                        {customer.customer_type === 'company'
                          ? `ТТД: ${customer.tax_number || 'Байхгүй'}`
                          : ['Хувь хүн', individualSummary(customer)].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                    <CheckCircle2 size={12} /> Идэвхтэй
                  </span>
                </div>

                <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300">
                  <div className="flex items-center gap-2">
                    <Mail size={14} className="text-slate-400 dark:text-slate-500 shrink-0" />
                    <span className="truncate">{customer.email || 'Имэйл байхгүй'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone size={14} className="text-slate-400 dark:text-slate-500 shrink-0" />
                    <span>{customer.phone || 'Утас байхгүй'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin size={14} className="text-slate-400 dark:text-slate-500 shrink-0" />
                    <span className="truncate">{customer.address || 'Хаяг байхгүй'}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Component */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-between bg-white dark:bg-slate-900 px-5 py-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-2xs">
          <div className="text-xs font-medium text-slate-400">
            Нийт <span className="font-bold text-slate-700 dark:text-slate-200">{filteredCustomers.length}</span> өгөгдлөөс <span className="font-bold text-slate-700 dark:text-slate-200">{indexOfFirstItem + 1}-{Math.min(indexOfLastItem, filteredCustomers.length)}</span> хүртэл харуулж байна
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setCurrentPage(Math.max(currentPage - 1, 1))}
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
              type="button"
              onClick={() => setCurrentPage(Math.min(currentPage + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Шинэ харилцагч нэмэх модал цонх */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 dark:bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 max-w-lg w-full shadow-xl border border-slate-100 dark:border-slate-800 space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <h2 className="text-lg font-black text-slate-900 dark:text-white">Шинэ харилцагч нэмэх</h2>
              <button 
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-2 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">Харилцагчийн төрөл</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, customer_type: 'company' })}
                    className={`py-2.5 rounded-xl font-bold border transition-all cursor-pointer ${
                      formData.customer_type === 'company' 
                        ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400' 
                        : 'border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    Байгууллага
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, customer_type: 'individual' })}
                    className={`py-2.5 rounded-xl font-bold border transition-all cursor-pointer ${
                      formData.customer_type === 'individual' 
                        ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400' 
                        : 'border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    Хувь хүн
                  </button>
                </div>
              </div>

              {formData.customer_type === 'company' ? (
                <>
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Компанийн нэр</label>
                    <input 
                      type="text" 
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Жишээ: Компани ХХК"
                      className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-800 dark:text-slate-100 outline-none focus:border-blue-500 dark:focus:border-blue-400"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Татвар төлөгчийн дугаар (ТТД)</label>
                    <input 
                      type="text" 
                      required
                      value={formData.tax_number}
                      onChange={(e) => setFormData({ ...formData, tax_number: e.target.value })}
                      placeholder="Жишээ: 1234567"
                      className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-800 dark:text-slate-100 outline-none focus:border-blue-500 dark:focus:border-blue-400"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Овог</label>
                      <input 
                        type="text" 
                        value={formData.last_name}
                        onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                        placeholder="Овог"
                        className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-800 dark:text-slate-100 outline-none focus:border-blue-500 dark:focus:border-blue-400"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Нэр</label>
                      <input 
                        type="text" 
                        required
                        value={formData.first_name}
                        onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                        placeholder="Нэр"
                        className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-800 dark:text-slate-100 outline-none focus:border-blue-500 dark:focus:border-blue-400"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Хүйс <span className="text-red-500">*</span>
                      </label>
                      <div role="radiogroup" aria-label="Хүйс" className="grid grid-cols-2 gap-2">
                        {GENDERS.map((gender) => (
                          <button
                            key={gender}
                            type="button"
                            role="radio"
                            aria-checked={formData.male === gender}
                            onClick={() => {
                              setFormData({ ...formData, male: gender });
                              setGenderMissing(false);
                            }}
                            className={`py-3 rounded-xl font-bold border transition-all cursor-pointer ${
                              formData.male === gender
                                ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400'
                                : genderMissing
                                  ? 'border-red-300 dark:border-red-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                                  : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                            }`}
                          >
                            {gender}
                          </button>
                        ))}
                      </div>
                      {genderMissing && (
                        <p className="mt-1 text-[11px] font-bold text-red-500">Хүйсээ сонгоно уу.</p>
                      )}
                    </div>
                    <div>
                      <label htmlFor="new-customer-birth-date" className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Төрсөн огноо
                        {formAge !== null && (
                          <span className="ml-1.5 font-semibold text-slate-400 dark:text-slate-500">({formAge} нас)</span>
                        )}
                      </label>
                      <input
                        id="new-customer-birth-date"
                        type="date"
                        min={BIRTH_DATE_MIN}
                        max={todayIsoDate()}
                        value={formData.birth_date}
                        onChange={(e) => setFormData({ ...formData, birth_date: e.target.value })}
                        className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-800 dark:text-slate-100 outline-none focus:border-blue-500 dark:focus:border-blue-400"
                      />
                    </div>
                  </div>
                </>
              )}

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Имэйл хаяг</label>
                <input 
                  type="email" 
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="example@mail.com"
                  className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-800 dark:text-slate-100 outline-none focus:border-blue-500 dark:focus:border-blue-400"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Утасны дугаар</label>
                <input 
                  type="text" 
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="99112233"
                  className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-800 dark:text-slate-100 outline-none focus:border-blue-500 dark:focus:border-blue-400"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Хаяг байршил</label>
                <textarea 
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Гэрийн эсвэл албан байгууллагын хаяг"
                  rows={2}
                  className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-800 dark:text-slate-100 outline-none focus:border-blue-500 dark:focus:border-blue-400 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
                >
                  Болих
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2.5 rounded-xl font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-all cursor-pointer disabled:opacity-50"
                >
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

// useSearchParams ашиглаж байгаа тул Suspense дотор экспортлох (Build error гаргахгүй)
export default function CustomersPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen w-full items-center justify-center p-10">
        <Loading />
      </div>
    }>
      <CustomersContent />
    </Suspense>
  );
}