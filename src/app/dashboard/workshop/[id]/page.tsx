'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Save, CalendarCheck, Lock } from 'lucide-react';
import Loading from '@/src/app/components/loading';
import CommonModal from '@/src/app/components/CommonModal';
import { useFormValidation, FormErrorBanner } from '@/src/app/components/FormValidation';
import WorkFormFields, { emptyWorkForm, toServiceFormLines, type WorkFormData, type WorkOptionData } from '../WorkFormFields';

export default function WorkDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const workId = resolvedParams.id;
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [options, setOptions] = useState<WorkOptionData>({ individuals: [], companies: [], services: [], employees: [] });

  // CommonModal-ийн төлөв
  const [modal, setModal] = useState<{
    isOpen: boolean;
    type: 'success' | 'error';
    title?: string;
    message: string;
    onConfirm?: () => void;
  }>({
    isOpen: false,
    type: 'success',
    message: '',
  });

  const [formData, setFormData] = useState<WorkFormData>(emptyWorkForm);
  const [submitError, setSubmitError] = useState('');
  // Энэ ажил захиалгаас үүссэн бол ("Ажил эхлүүлэх")
  const [reservation, setReservation] = useState<{ date: string; start: string } | null>(null);
  // Ажилтан зөвхөн өөрийн хариуцсан ажлыг засна, хариуцагчийг зөвхөн админ солино (API дээр мөн шалгана)
  const [canEdit, setCanEdit] = useState(false);
  const [canReassign, setCanReassign] = useState(false);
  const { formRef, errors } = useFormValidation();

  const fetchWorkAndOptions = async () => {
    try {
      setLoading(true);
      
      const [workRes, optRes] = await Promise.all([
        fetch(`/api/workshop/${workId}`),
        fetch('/api/workshop?action=options')
      ]);

      const workResult = await workRes.json();
      const optResult = await optRes.json();

      if (optResult.success) {
        setOptions(optResult.data);
      }
      
      if (workResult.success && workResult.data) {
        const item = workResult.data;
        setCanEdit(item.can_edit === true);
        setCanReassign(item.can_reassign === true);
        setReservation(item.reservation_id && item.reservation_date ? { date: item.reservation_date, start: item.reservation_start } : null);
        const resolvedType = item.customer_type === 'company' ? 'company' : 'individual';
        const currentCustomerId = resolvedType === 'company' 
          ? (item.company_customer_id || '') 
          : (item.customer_id || '');

        setFormData({
          title: item.title || '',
          customer_type: resolvedType,
          customer_id: currentCustomerId,
          services: toServiceFormLines(item.services),
          assigned_employee: item.assigned_employee ? item.assigned_employee.toString() : '',
          price: item.price !== null && item.price !== undefined ? item.price.toString() : '',
          status: item.status || 'pending',
          priority: item.priority ? item.priority.toLowerCase() : 'medium',
          due_date: item.due_date ? item.due_date.split('T')[0] : '',
          description: item.description || ''
        });
      }
    } catch (err) {
      console.error('Failed to fetch work detail:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Ажлын ID өөрчлөгдөхөд өгөгдөл дахин татна (fetch эхлэхэд loading төлөвийг шинэчилдэг)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchWorkAndOptions();
  }, [workId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');
    try {
      setSaving(true);
      const res = await fetch(`/api/workshop/${workId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const result = await res.json();
      
      if (result.success) {
        setModal({
          isOpen: true,
          type: 'success',
          title: 'Амжилттай',
          message: 'Ажлын мэдээлэл амжилттай шинэчлэгдлээ.',
          onConfirm: () => {
            router.back(); // Өмнөх хуудас (4 дүгээр хуудас) руу буцах
          }
        });
      } else {
        setSubmitError(result.error || 'Хадгалахад алдаа гарлаа.');
      }
    } catch (err) {
      console.error('Error updating work:', err);
      setSubmitError('Сервертэй холбогдоход алдаа гарлаа. Дахин оролдоно уу.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <Loading />;
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-20 relative">
      {/* Хадгалж байх үед харагдах Loader */}
      {saving && <Loading />}

      {/* Header */}
      <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-100 dark:border-slate-800 shadow-2xs transition-colors">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-all cursor-pointer"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-base sm:text-xl font-black text-slate-900 dark:text-white">
              {canEdit ? 'Ажлын дэлгэрэнгүй & Засварлах' : 'Ажлын дэлгэрэнгүй'}
            </h1>
            <p className="text-[11px] sm:text-xs text-slate-400 dark:text-slate-400">
              {canEdit ? 'Мэдээллийг өөрчлөөд хадгалах товчийг дарна уу' : 'Зөвхөн харах горим'}
            </p>
            {reservation && (
              <Link
                href={`/dashboard/reservations?from=${reservation.date}&to=${reservation.date}`}
                className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-lg bg-violet-50 dark:bg-violet-950/50 text-violet-700 dark:text-violet-300 hover:underline"
                title="Ажил дуусвал захиалга автоматаар Үйлчлүүлсэн болно"
              >
                <CalendarCheck size={12} aria-hidden /> Захиалгаас үүссэн: {reservation.date.replaceAll('-', '.')} {reservation.start} →
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Form */}
      <form ref={formRef} onSubmit={handleSubmit} className="bg-white dark:bg-slate-900 p-5 sm:p-8 rounded-2xl sm:rounded-3xl border border-slate-100 dark:border-slate-800 shadow-2xs space-y-4 transition-colors">
        {!canEdit && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-300 text-xs font-bold">
            <Lock size={14} className="shrink-0 mt-0.5" aria-hidden />
            Энэ ажлыг өөр ажилтан хариуцаж байгаа тул засах боломжгүй. Та зөвхөн өөрийн хариуцсан ажлыг засах эрхтэй.
          </div>
        )}

        {/* Засах эрхгүй бол бүх талбарыг идэвхгүй болгоно */}
        <fieldset disabled={!canEdit} className="min-w-0 space-y-4">
          <WorkFormFields formData={formData} setFormData={setFormData} options={options} errors={errors} lockAssignee={!canReassign} />
        </fieldset>

        <FormErrorBanner message={submitError} onClose={() => setSubmitError('')} />

        {canEdit && (
        <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition-all cursor-pointer"
          >
            Цуцлах
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-all shadow-sm shadow-red-500/20 cursor-pointer inline-flex items-center gap-2 disabled:opacity-50"
          >
            {saving ? (
              <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Save size={16} />
            )} Өөрчлөлтийг хадгалах
          </button>
        </div>
        )}
      </form>

      {/* CommonModal ашиглан хариуг харуулах */}
      <CommonModal
        isOpen={modal.isOpen}
        type={modal.type}
        title={modal.title}
        message={modal.message}
        onClose={() => {
          setModal(prev => ({ ...prev, isOpen: false }));
          if (modal.onConfirm) modal.onConfirm();
        }}
        onConfirm={() => {
          setModal(prev => ({ ...prev, isOpen: false }));
          if (modal.onConfirm) modal.onConfirm();
        }}
      />
    </div>
  );
}