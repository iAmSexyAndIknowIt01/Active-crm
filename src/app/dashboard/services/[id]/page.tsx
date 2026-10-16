/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Briefcase, Tag, DollarSign, Clock, Calendar, FileText,
  CheckCircle2, XCircle, Edit3, Save, X, Loader, ShieldCheck
} from 'lucide-react';
import Loading from '@/src/app/components/loading';
import InfoTip from '@/src/app/components/InfoTip';

interface ServiceDetail {
  service_id: number;
  company_id: string;
  name: string;
  category: string | null;
  price: number | string | null;
  duration: number | null;
  description: string | null;
  status: string | null;
  created_at: string | null;
}

interface ServiceForm {
  name: string;
  category: string;
  price: string;
  duration: string;
  description: string;
  status: 'active' | 'inactive';
}

const toForm = (s: ServiceDetail): ServiceForm => ({
  name: s.name || '',
  category: s.category || '',
  price: s.price !== null && s.price !== undefined ? String(Number(s.price)) : '',
  duration: s.duration !== null && s.duration !== undefined ? String(s.duration) : '',
  description: s.description || '',
  status: s.status === 'inactive' ? 'inactive' : 'active',
});

const inputClass = 'w-full mt-1 px-2.5 py-1.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-100 outline-none focus:border-red-500 dark:focus:border-red-400';

export default function ServiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [service, setService] = useState<ServiceDetail | null>(null);
  const [editForm, setEditForm] = useState<ServiceForm | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fetchServiceDetail = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/services/${id}`);
      const result = await res.json();

      if (result.success) {
        setService(result.data);
        setEditForm(toForm(result.data));
      } else {
        setError(result.error || 'Мэдээлэл олдсонгүй');
      }
    } catch (err) {
      console.error('Error fetching service detail:', err);
      setError('Сервертэй холбогдоход алдаа гарлаа.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServiceDetail();
  }, [id]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editForm) return;

    try {
      setSaving(true);
      const res = await fetch(`/api/services/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });

      const result = await res.json();
      if (result.success) {
        setService(result.data);
        setEditForm(toForm(result.data));
        setIsEditing(false);
      } else {
        alert(result.error || 'Хадгалахад алдаа гарлаа.');
      }
    } catch (err) {
      console.error('Error saving service:', err);
      alert('Сервертэй холбогдоход алдаа гарлаа.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (service) setEditForm(toForm(service));
    setIsEditing(false);
  };

  if (loading) {
    return <Loading />;
  }

  if (error || !service || !editForm) {
    return (
      <div className="max-w-4xl mx-auto py-20 text-center space-y-4 px-4">
        <p className="text-base font-bold text-slate-800 dark:text-slate-100">{error || 'Үйлчилгээ олдсонгүй.'}</p>
        <button
          type="button"
          onClick={() => router.back()}
          className="px-5 py-2.5 bg-slate-900 dark:bg-slate-800 text-white rounded-xl text-xs font-bold cursor-pointer"
        >
          Буцах
        </button>
      </div>
    );
  }

  const isActive = service.status !== 'inactive';

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-24 font-sans antialiased text-slate-800 dark:text-slate-100 px-4 sm:px-6">
      {/* Top Bar: Back & Edit Mode Toggle */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-slate-900 px-4 py-2.5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-2xs transition-all cursor-pointer"
        >
          <ArrowLeft size={16} /> Буцах
        </button>

        {!isEditing ? (
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="inline-flex items-center gap-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 px-5 py-2.5 rounded-2xl shadow-sm shadow-red-500/20 transition-all cursor-pointer"
          >
            <Edit3 size={16} /> Засах
          </button>
        ) : (
          <button
            type="button"
            onClick={handleCancel}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 px-4 py-2.5 rounded-2xl transition-all cursor-pointer"
          >
            <X size={16} /> Цуцлах
          </button>
        )}
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-2xs relative overflow-hidden space-y-6">
          <div className="absolute -right-10 -top-10 w-48 h-48 bg-red-50/80 dark:bg-red-950/40 rounded-full blur-3xl pointer-events-none"></div>

          {/* Header */}
          <div className="flex items-center gap-4 relative z-10">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-red-600 dark:bg-red-500 text-white flex items-center justify-center shadow-md shrink-0">
              <Briefcase size={30} />
            </div>
            <div className="space-y-1 min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                {!isEditing ? (
                  <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white break-words">{service.name}</h1>
                ) : (
                  <input
                    type="text"
                    required
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    placeholder="Үйлчилгээний нэр"
                    className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-sm font-bold w-full sm:w-72"
                  />
                )}
                <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full ${
                  isActive
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                }`}>
                  {isActive ? 'Идэвхтэй' : 'Идэвхгүй'}
                </span>
              </div>
              <p className="inline-flex items-center gap-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-semibold">
                <Tag size={13} /> {service.category || 'Ангилалгүй'}
              </p>
            </div>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-6 border-t border-slate-100 dark:border-slate-800 relative z-10 text-xs sm:text-sm">
            <div className="flex items-center gap-3 p-4 rounded-2xl bg-slate-50/60 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
              <DollarSign size={18} className="text-red-600 dark:text-red-400 shrink-0" />
              <div className="w-full">
                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1">
                  Үнэ (₮)
                  <InfoTip size={12} text="Каталогийн үндсэн үнэ. Шинэ ажил, цаг захиалгад нэмэхэд автоматаар бөглөгдөнө. Үнийг өөрчлөхөд өмнө бүртгэсэн ажлын үнэ өөрчлөгдөхгүй." />
                </p>
                {!isEditing ? (
                  <p className="font-bold text-slate-800 dark:text-slate-200">{Number(service.price ?? 0).toLocaleString()} ₮</p>
                ) : (
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={editForm.price}
                    onChange={(e) => setEditForm({ ...editForm, price: e.target.value })}
                    className={inputClass}
                  />
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 rounded-2xl bg-slate-50/60 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
              <Clock size={18} className="text-red-600 dark:text-red-400 shrink-0" />
              <div className="w-full">
                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1">
                  Хугацаа (минутаар)
                  <InfoTip size={12} text="Үйлчилгээ үргэлжлэх хугацаа. Цаг захиалахад дуусах цагийг сонгосон үйлчилгээнүүдийн хугацааны нийлбэрээр автоматаар бодно." />
                </p>
                {!isEditing ? (
                  <p className="font-bold text-slate-800 dark:text-slate-200">{service.duration ? `${service.duration} мин` : 'Байхгүй'}</p>
                ) : (
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={editForm.duration}
                    onChange={(e) => setEditForm({ ...editForm, duration: e.target.value })}
                    className={inputClass}
                  />
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 rounded-2xl bg-slate-50/60 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
              <Tag size={18} className="text-red-600 dark:text-red-400 shrink-0" />
              <div className="w-full">
                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Ангилал</p>
                {!isEditing ? (
                  <p className="font-bold text-slate-800 dark:text-slate-200">{service.category || 'Ангилалгүй'}</p>
                ) : (
                  <input
                    type="text"
                    value={editForm.category}
                    onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                    className={inputClass}
                  />
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 rounded-2xl bg-slate-50/60 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
              {isActive ? (
                <CheckCircle2 size={18} className="text-red-600 dark:text-red-400 shrink-0" />
              ) : (
                <XCircle size={18} className="text-red-600 dark:text-red-400 shrink-0" />
              )}
              <div className="w-full">
                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Төлөв</p>
                {!isEditing ? (
                  <p className="font-bold text-slate-800 dark:text-slate-200">{isActive ? 'Идэвхтэй' : 'Идэвхгүй'}</p>
                ) : (
                  <select
                    value={editForm.status}
                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value as ServiceForm['status'] })}
                    className={`${inputClass} cursor-pointer`}
                  >
                    <option value="active">Идэвхтэй</option>
                    <option value="inactive">Идэвхгүй</option>
                  </select>
                )}
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 rounded-2xl bg-slate-50/60 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 sm:col-span-2">
              <FileText size={18} className="text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
              <div className="w-full">
                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Тайлбар</p>
                {!isEditing ? (
                  <p className="font-bold text-slate-800 dark:text-slate-200 whitespace-pre-wrap">{service.description || 'Тайлбар байхгүй'}</p>
                ) : (
                  <textarea
                    rows={4}
                    value={editForm.description}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    className={`${inputClass} resize-none`}
                  />
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 rounded-2xl bg-slate-50/60 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
              <Calendar size={18} className="text-red-600 dark:text-red-400 shrink-0" />
              <div>
                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Үүсгэсэн огноо</p>
                <p className="font-bold text-slate-800 dark:text-slate-200">
                  {service.created_at ? new Date(service.created_at).toLocaleDateString() : 'Тодорхойгүй'}
                </p>
              </div>
            </div>
          </div>

          {isEditing && (
            <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100 dark:border-slate-800 relative z-10">
              <button
                type="button"
                onClick={handleCancel}
                className="px-5 py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition-all cursor-pointer"
              >
                Цуцлах
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-3 rounded-2xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-all shadow-sm shadow-red-500/20 cursor-pointer inline-flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
              >
                {saving ? <Loader size={16} className="animate-spin" /> : <Save size={16} />} Өөрчлөлтийг хадгалах
              </button>
            </div>
          )}

          <div className="pt-2 flex items-center justify-between text-xs text-slate-400 dark:text-slate-500 border-t border-slate-100 dark:border-slate-800 relative z-10">
            <span className="inline-flex items-center gap-1 font-bold text-emerald-600 dark:text-emerald-400">
              <ShieldCheck size={14} /> mt_services table
            </span>
            <span>ID: {service.service_id}</span>
          </div>
        </div>
      </form>
    </div>
  );
}
