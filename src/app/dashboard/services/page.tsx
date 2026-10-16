/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Briefcase, Plus, Search, DollarSign, Clock,
  X, CheckCircle2, XCircle, LayoutList, LayoutGrid, Tag, ChevronLeft, ChevronRight
} from 'lucide-react';
import Loading from '@/src/app/components/loading';
import InfoTip from '@/src/app/components/InfoTip';

interface Service {
  service_id: string;
  name: string;
  category: string | null;
  price: number;
  duration: number | null;
  description: string | null;
  status: string | null;
}

function StatusBadge({ status }: { status: string | null }) {
  return status === 'inactive' ? (
    <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
      <XCircle size={12} /> Идэвхгүй
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/40">
      <CheckCircle2 size={12} /> Идэвхтэй
    </span>
  );
}

function ServicesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  // Шүүлтүүр болон хуудасны төлөвийг URL-аас эхлүүлнэ (дэлгэрэнгүй хуудаснаас буцахад хадгалагдана)
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get('q') || '');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>(() => (searchParams.get('view') === 'grid' ? 'grid' : 'list'));
  const [currentPage, setCurrentPage] = useState(() => {
    const pageParam = searchParams.get('page');
    return pageParam ? parseInt(pageParam, 10) || 1 : 1;
  });
  const itemsPerPage = 9;
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    price: '',
    duration: '',
    description: ''
  });

  const fetchServices = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/services');
      const result = await res.json();
      if (result.success) {
        setServices(result.data);
      }
    } catch (err) {
      console.error('Failed to fetch services:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServices();
  }, []);

  // Шүүлтүүр болон хуудасны төлөвийг URL-тай синк хийх.
  // Хуудсыг зөвхөн хайлт бодитоор өөрчлөгдсөн үед 1 болгоно (mount үед биш).
  const prevSearchQuery = useRef(searchQuery);

  useEffect(() => {
    const searchChanged = prevSearchQuery.current !== searchQuery;
    prevSearchQuery.current = searchQuery;

    const page = searchChanged ? 1 : currentPage;
    if (searchChanged) setCurrentPage(1);

    const params = new URLSearchParams();
    if (searchQuery) params.set('q', searchQuery);
    if (viewMode !== 'list') params.set('view', viewMode);
    if (page > 1) params.set('page', page.toString());

    const query = params.toString();
    if (query !== searchParams.toString()) {
      router.replace(`/dashboard/services${query ? `?${query}` : ''}`, { scroll: false });
    }
  }, [searchQuery, viewMode, currentPage]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      const res = await fetch('/api/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const result = await res.json();
      if (result.success) {
        setIsModalOpen(false);
        setFormData({ name: '', category: '', price: '', duration: '', description: '' });
        fetchServices();
      } else {
        alert(result.error || 'Хадгалахад алдаа гарлаа');
      }
    } catch (err) {
      console.error('Error saving service:', err);
      alert('Сервертэй холбогдоход алдаа гарлаа');
    } finally {
      setSaving(false);
    }
  };

  const filteredServices = services.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.category && s.category.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const totalPages = Math.max(1, Math.ceil(filteredServices.length / itemsPerPage));
  const page = Math.min(currentPage, totalPages);
  const indexOfLastItem = page * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentServices = filteredServices.slice(indexOfFirstItem, indexOfLastItem);

  return (
    <div className="space-y-6 pb-20 font-sans antialiased text-slate-800 dark:text-slate-100">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-2xs">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">Үйлчилгээ</h1>
          <p className="text-xs text-slate-400 dark:text-slate-400 mt-0.5">Таны бизнес эрхлэгчийн үзүүлж буй үйлчилгээний жагсаалт</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white px-5 py-3 rounded-2xl text-xs font-bold transition-all shadow-sm shadow-red-500/20 cursor-pointer"
        >
          <Plus size={16} /> Шинэ үйлчилгээ нэмэх
        </button>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 bg-white dark:bg-slate-900 px-4 py-2.5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-2xs sm:w-80">
          <Search size={18} className="text-slate-400 dark:text-slate-500 shrink-0" />
          <input 
            type="text"
            placeholder="Үйлчилгээ хайх..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs font-bold text-slate-800 dark:text-slate-100 bg-transparent outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500"
          />
        </div>

        {/* View mode toggle */}
        <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-2xs">
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 rounded-xl transition-all cursor-pointer ${
              viewMode === 'list' ? 'bg-red-600 text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
            title="Жагсаалтаар харах"
          >
            <LayoutList size={16} />
          </button>
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded-xl transition-all cursor-pointer ${
              viewMode === 'grid' ? 'bg-red-600 text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
            title="Кардаар харах"
          >
            <LayoutGrid size={16} />
          </button>
        </div>
      </div>

      {loading ? (
        <Loading />
      ) : filteredServices.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 p-12 rounded-3xl border border-slate-100 dark:border-slate-800 text-center space-y-3">
          <Briefcase size={40} className="mx-auto text-slate-300 dark:text-slate-600" />
          <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Үйлчилгээ олдсонгүй</p>
          <p className="text-xs text-slate-400 dark:text-slate-500">Шинэ үйлчилгээ нэмж бүртгэнэ үү.</p>
        </div>
      ) : viewMode === 'list' ? (
        // TABLE VIEW
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 text-[11px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">
                  <th className="py-4 px-6">Үйлчилгээний нэр</th>
                  <th className="py-4 px-6">Ангилал</th>
                  <th className="py-4 px-6">
                    <span className="inline-flex items-center gap-1">Үнэ <InfoTip size={12} text="Каталогийн үндсэн үнэ. Ажил, цаг захиалгад нэмэхэд энэ үнэ автоматаар бөглөгдөнө. Тухайн ажилд өөрчилж болох бөгөөд каталогийн үнэ өөрчлөгдөхгүй." /></span>
                  </th>
                  <th className="py-4 px-6">
                    <span className="inline-flex items-center gap-1">Хугацаа <InfoTip size={12} text="Үйлчилгээ үргэлжлэх хугацаа (минут). Цаг захиалахад сонгосон үйлчилгээнүүдийн хугацааг нэмж дуусах цагийг автоматаар бодно." /></span>
                  </th>
                  <th className="py-4 px-6">Төлөв</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300">
                {currentServices.map((service) => (
                  <tr
                    key={service.service_id}
                    onClick={() => router.push(`/dashboard/services/${service.service_id}`)}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/60 transition-colors cursor-pointer"
                  >
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 flex items-center justify-center font-black shrink-0">
                          <Briefcase size={18} />
                        </div>
                        <div>
                          <span className="font-bold text-slate-900 dark:text-white block">{service.name}</span>
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 truncate max-w-xs block">{service.description || 'Тайлбар байхгүй'}</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                        <Tag size={12} /> {service.category || 'Ангилалгүй'}
                      </span>
                    </td>
                    <td className="py-4 px-6 font-bold text-slate-900 dark:text-white">
                      {Number(service.price).toLocaleString()} ₮
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                        <Clock size={13} className="text-slate-400 dark:text-slate-500" />
                        <span>{service.duration ? `${service.duration} мин` : '-'}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <StatusBadge status={service.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        // GRID VIEW
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {currentServices.map((service) => (
            <div
              key={service.service_id}
              onClick={() => router.push(`/dashboard/services/${service.service_id}`)}
              className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-2xs space-y-4 hover:border-red-200 dark:hover:border-red-800 transition-all cursor-pointer"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 flex items-center justify-center font-black shrink-0">
                    <Briefcase size={20} />
                  </div>
                  <div>
                    <h3 className="font-black text-sm text-slate-900 dark:text-white">{service.name}</h3>
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 mt-1">
                      <Tag size={10} /> {service.category || 'Ангилалгүй'}
                    </span>
                  </div>
                </div>
                <StatusBadge status={service.status} />
              </div>

              <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">{service.description || 'Тайлбар байхгүй'}</p>

              <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800 text-xs font-bold">
                <div className="text-red-600 dark:text-red-400 flex items-center gap-1">
                  <DollarSign size={14} /> {Number(service.price).toLocaleString()} ₮
                </div>
                <div className="text-slate-400 dark:text-slate-500 flex items-center gap-1 font-semibold">
                  <Clock size={14} /> {service.duration ? `${service.duration} мин` : '-'}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-between bg-white dark:bg-slate-900 px-5 py-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-2xs">
          <div className="text-xs font-medium text-slate-400">
            Нийт <span className="font-bold text-slate-700 dark:text-slate-200">{filteredServices.length}</span> өгөгдлөөс <span className="font-bold text-slate-700 dark:text-slate-200">{indexOfFirstItem + 1}-{Math.min(indexOfLastItem, filteredServices.length)}</span> хүртэл харуулж байна
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setCurrentPage(Math.max(page - 1, 1))}
              disabled={page === 1}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
            >
              <ChevronLeft size={16} />
            </button>

            <div className="flex items-center gap-1 px-2">
              <span className="text-xs font-bold text-slate-800 dark:text-white">{page}</span>
              <span className="text-xs text-slate-400">/</span>
              <span className="text-xs font-bold text-slate-400">{totalPages}</span>
            </div>

            <button
              type="button"
              onClick={() => setCurrentPage(Math.min(page + 1, totalPages))}
              disabled={page === totalPages}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Add Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 dark:bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 max-w-lg w-full rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl border border-slate-100 dark:border-slate-800 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-black text-base text-slate-900 dark:text-white">Шинэ үйлчилгээ бүртгэх</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Үйлчилгээний нэр *</label>
                <input 
                  type="text"
                  required
                  placeholder="Жишээ: Үс засалт, Зөвлөгөө өгөх..."
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-100 outline-none focus:border-red-500 dark:focus:border-red-400 focus:bg-white dark:focus:bg-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Ангилал</label>
                <input 
                  type="text"
                  placeholder="Жишээ: Үндсэн, Нэмэлт..."
                  value={formData.category}
                  onChange={(e) => setFormData({...formData, category: e.target.value})}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-100 outline-none focus:border-red-500 dark:focus:border-red-400 focus:bg-white dark:focus:bg-slate-900"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Үнэ (₮)</label>
                  <input 
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="0"
                    value={formData.price}
                    onChange={(e) => setFormData({...formData, price: e.target.value})}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-100 outline-none focus:border-red-500 dark:focus:border-red-400 focus:bg-white dark:focus:bg-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Хугацаа (минутаар)</label>
                  <input 
                    type="number"
                    min={1}
                    step={1}
                    placeholder="30"
                    value={formData.duration}
                    onChange={(e) => setFormData({...formData, duration: e.target.value})}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-100 outline-none focus:border-red-500 dark:focus:border-red-400 focus:bg-white dark:focus:bg-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Тайлбар</label>
                <textarea 
                  rows={3}
                  placeholder="Үйлчилгээний дэлгэрэнгүй мэдээлэл..."
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-100 outline-none focus:border-red-500 dark:focus:border-red-400 focus:bg-white dark:focus:bg-slate-900 resize-none"
                />
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition-all cursor-pointer"
                >
                  Цуцлах
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-all shadow-sm shadow-red-500/20 cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-50"
                >
                  {saving ? (
                    <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Plus size={16} />
                  )} Хадгалах
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
export default function ServicesPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen w-full items-center justify-center p-10">
        <Loading />
      </div>
    }>
      <ServicesContent />
    </Suspense>
  );
}