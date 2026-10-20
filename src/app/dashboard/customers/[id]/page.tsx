'use client';

import { useEffect, useState, use } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Building2, User, Mail, Phone, MapPin, ArrowLeft, Calendar, ShieldCheck, FileText, RefreshCw, Edit3, Save, X, Cake, Trash2 } from 'lucide-react';
import Loading from '@/src/app/components/loading';
import CommonModal from '@/src/app/components/CommonModal';
import { BIRTH_DATE_MIN, GENDERS, calcAge, isGender, todayIsoDate } from '@/src/lib/customer-fields';

interface CustomerDetail {
  customer_id: string;
  customer_type: 'company' | 'individual';
  name?: string;
  first_name?: string;
  last_name?: string;
  email: string | null;
  phone: string | null;
  male?: string | null;
  birth_date?: string | null;
  address: string | null;
  tax_number?: string | null;
  status: string | null;
  source?: string | null;
  create_date: string;
  update_date: string;
  submissions?: {
    id: string;
    submitted_at: string;
    template_title: string | null;
    answers: { label: string | null; value: string | null }[];
  }[];
}

const SOURCE_LABELS: Record<string, string> = {
  manual: 'Гараар бүртгэсэн',
  form: 'QR анкет',
  import: 'Файлаас оруулсан',
};

export default function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const customerId = resolvedParams.id;
  const searchParams = useSearchParams();
  const customerType = searchParams.get('type') || 'company';
  const router = useRouter();

  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Засварлах горимын төлөвүүд
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<Partial<CustomerDetail>>({});
  const [saving, setSaving] = useState(false);

  // Modal төлөвүүд
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    type: 'success' | 'error';
    title: string;
    message: string;
    onConfirm?: () => void;
  }>({
    isOpen: false,
    type: 'success',
    title: '',
    message: '',
  });

  useEffect(() => {
    const fetchCustomerDetail = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/customers/${customerId}?type=${customerType}`);
        const result = await res.json();
        if (result.success) {
          setCustomer(result.data);
          setFormData(result.data); // Формын өгөгдлийг оноох
        } else {
          setModalState({
            isOpen: true,
            type: 'error',
            title: 'Алдаа гарлаа',
            message: result.error || 'Мэдээлэл олдсонгүй',
          });
        }
      } catch (err) {
        console.error('Failed to fetch customer detail:', err);
        setModalState({
          isOpen: true,
          type: 'error',
          title: 'Холболтын алдаа',
          message: 'Мэдээлэл авахад алдаа гарлаа.',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchCustomerDetail();
  }, [customerId, customerType]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Харилцагчийг бүрмөсөн устгана (QR анкет, сануулгын лог дахь хувийн мэдээлэл хамт устна)
  const [deleting, setDeleting] = useState(false);
  const handleDelete = async () => {
    const name = customer?.customer_type === 'company' ? customer?.name : `${customer?.last_name ?? ''} ${customer?.first_name ?? ''}`.trim();
    if (
      !window.confirm(
        `"${name}" харилцагчийг бүрмөсөн устгах уу?\n\nБөглөсөн QR анкетууд нь хамт устна. Ажил, цаг захиалгын түүх үлдэх боловч харилцагчийн мэдээлэлгүй болно. Энэ үйлдлийг буцаах боломжгүй.`
      )
    )
      return;
    try {
      setDeleting(true);
      const res = await fetch(`/api/customers/${customerId}?type=${customerType}`, { method: 'DELETE' });
      const result = await res.json();
      if (!res.ok || !result.success) throw new Error(result.error || 'Устгахад алдаа гарлаа.');
      router.push('/dashboard/customers');
    } catch (err) {
      setModalState({
        isOpen: true,
        type: 'error',
        title: 'Устгаж чадсангүй',
        message: err instanceof Error ? err.message : 'Холболтын алдаа гарлаа.',
      });
    } finally {
      setDeleting(false);
    }
  };

  const handleSave = async () => {
    if (customerType !== 'company' && !isGender(formData.male)) {
      setModalState({
        isOpen: true,
        type: 'error',
        title: 'Хүйс сонгоогүй байна',
        message: 'Хүйсээ сонгоно уу (Эрэгтэй эсвэл Эмэгтэй).',
      });
      return;
    }
    try {
      setSaving(true);
      const save = (allowDuplicate: boolean) =>
        fetch(`/api/customers/${customerId}?type=${customerType}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...formData, allow_duplicate: allowDuplicate }),
        });
      let res = await save(false);
      let result = await res.json();
      // Өөр харилцагчтай ижил утас/имэйл/регистр байвал хэрэглэгчээр баталгаажуулна
      if (res.status === 409 && result.duplicate) {
        if (!window.confirm(`${result.error}\n\nТэгсэн ч хадгалах уу?`)) return;
        res = await save(true);
        result = await res.json();
      }

      if (result.success) {
        setCustomer(result.data);
        setIsEditing(false);
        router.refresh();
        setModalState({
          isOpen: true,
          type: 'success',
          title: 'Амжилттай',
          message: 'Харилцагчийн мэдээлэл амжилттай шинэчлэгдлээ.',
        });
      } else {
        setModalState({
          isOpen: true,
          type: 'error',
          title: 'Хадгалж чадсангүй',
          message: result.error || 'Хадгалахад алдаа гарлаа.',
        });
      }
    } catch (err) {
      console.error('Failed to update customer:', err);
      setModalState({
        isOpen: true,
        type: 'error',
        title: 'Системийн алдаа',
        message: 'Холболтын алдаа гарлаа.',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loading />;

  if (!customer) {
    return (
      <div className="bg-white dark:bg-slate-900 p-12 rounded-3xl border border-slate-100 dark:border-slate-800 text-center space-y-3">
        <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Харилцагчийн мэдээлэл олдсонгүй.</p>
        <button onClick={() => router.back()} className="text-xs font-bold text-red-600 dark:text-red-400 hover:underline cursor-pointer">
          Буцах
        </button>
      </div>
    );
  }

  const displayName = customer.customer_type === 'company'
    ? customer.name
    : `${customer.last_name || ''} ${customer.first_name || ''}`.trim();
  const age = calcAge(customer.birth_date);
  const formAge = calcAge(formData.birth_date);
  const individualSummary = [isGender(customer.male) ? customer.male : null, age !== null ? `${age} нас` : null]
    .filter(Boolean)
    .join(', ');

  return (
    <div className="space-y-6 pb-20 max-w-4xl mx-auto text-slate-800 dark:text-slate-100">
      {/* Ерөнхий модал ашиглалт */}
      <CommonModal
        isOpen={modalState.isOpen}
        type={modalState.type}
        title={modalState.title}
        message={modalState.message}
        onClose={() => setModalState((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={modalState.onConfirm}
      />

      <div className="flex items-center justify-between">
        <button 
          type="button"
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-slate-900 px-4 py-2.5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-2xs transition-all cursor-pointer"
        >
          <ArrowLeft size={16} /> Буцах
        </button>

        {!isEditing ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="inline-flex items-center gap-2 text-xs font-bold text-rose-600 dark:text-rose-400 bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900 hover:bg-rose-50 dark:hover:bg-rose-950/40 px-4 py-2.5 rounded-2xl transition-all cursor-pointer disabled:opacity-50"
            >
              <Trash2 size={16} /> {deleting ? 'Устгаж байна...' : 'Устгах'}
            </button>
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="inline-flex items-center gap-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 px-4 py-2.5 rounded-2xl shadow-sm transition-all cursor-pointer"
            >
              <Edit3 size={16} /> Засварлах
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => { setIsEditing(false); setFormData(customer); }}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 px-4 py-2.5 rounded-2xl transition-all cursor-pointer"
            >
              <X size={16} /> Болих
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 px-4 py-2.5 rounded-2xl shadow-sm transition-all cursor-pointer disabled:opacity-50"
            >
              <Save size={16} /> {saving ? 'Хадгалж байна...' : 'Хадгалах'}
            </button>
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-2xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-4">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center font-black text-2xl shrink-0 ${
              customer.customer_type === 'company' 
                ? 'bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400' 
                : 'bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400'
            }`}>
              {customer.customer_type === 'company' ? <Building2 size={32} /> : <User size={32} />}
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 dark:text-white">{displayName}</h1>
              <p className="text-xs text-slate-400 dark:text-slate-400 font-bold uppercase mt-1">
                {customer.customer_type === 'company' 
                  ? `Байгууллага (ТТД: ${customer.tax_number || '-'})` 
                  : `Хувь хүний харилцагч ${individualSummary ? `(${individualSummary})` : ''}`}
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 text-xs font-extrabold px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 w-fit">
            <ShieldCheck size={14} /> {customer.status || 'active'}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
          {/* Зүүн багана */}
          <div className="space-y-4">
            <h3 className="font-black text-slate-400 dark:text-slate-400 uppercase tracking-wider text-[11px]">Холбоо барих мэдээлэл</h3>
            
            {/* Имэйл */}
            <div className="flex items-center gap-3 p-3 bg-slate-50/50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
              <Mail size={16} className="text-slate-400 dark:text-slate-500 shrink-0" />
              <div className="w-full">
                <p className="text-[10px] text-slate-400 dark:text-slate-400 font-bold">Имэйл хаяг</p>
                {isEditing ? (
                  <input
                    type="email"
                    name="email"
                    value={formData.email || ''}
                    onChange={handleInputChange}
                    className="w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 rounded-xl font-bold text-slate-800 dark:text-slate-100 outline-none focus:border-red-500 dark:focus:border-red-400"
                  />
                ) : (
                  <p className="font-bold text-slate-800 dark:text-slate-200">{customer.email || 'Байхгүй'}</p>
                )}
              </div>
            </div>

            {/* Утас */}
            <div className="flex items-center gap-3 p-3 bg-slate-50/50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
              <Phone size={16} className="text-slate-400 dark:text-slate-500 shrink-0" />
              <div className="w-full">
                <p className="text-[10px] text-slate-400 dark:text-slate-400 font-bold">Утасны дугаар</p>
                {isEditing ? (
                  <input
                    type="text"
                    name="phone"
                    value={formData.phone || ''}
                    onChange={handleInputChange}
                    className="w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 rounded-xl font-bold text-slate-800 dark:text-slate-100 outline-none focus:border-red-500 dark:focus:border-red-400"
                  />
                ) : (
                  <p className="font-bold text-slate-800 dark:text-slate-200">{customer.phone || 'Байхгүй'}</p>
                )}
              </div>
            </div>

            {/* Компанийн хувьд: ТТД болон нэр */}
            {customer.customer_type === 'company' && (
              <>
                <div className="flex items-center gap-3 p-3 bg-slate-50/50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <FileText size={16} className="text-slate-400 dark:text-slate-500 shrink-0" />
                  <div className="w-full">
                    <p className="text-[10px] text-slate-400 dark:text-slate-400 font-bold">Компанийн нэр</p>
                    {isEditing ? (
                      <input
                        type="text"
                        name="name"
                        value={formData.name || ''}
                        onChange={handleInputChange}
                        className="w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 rounded-xl font-bold text-slate-800 dark:text-slate-100 outline-none focus:border-red-500 dark:focus:border-red-400"
                      />
                    ) : (
                      <p className="font-bold text-slate-800 dark:text-slate-200">{customer.name || 'Байхгүй'}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-slate-50/50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <FileText size={16} className="text-slate-400 dark:text-slate-500 shrink-0" />
                  <div className="w-full">
                    <p className="text-[10px] text-slate-400 dark:text-slate-400 font-bold">Татвар төлөгчийн дугаар (ТТД)</p>
                    {isEditing ? (
                      <input
                        type="text"
                        name="tax_number"
                        value={formData.tax_number || ''}
                        onChange={handleInputChange}
                        className="w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 rounded-xl font-bold text-slate-800 dark:text-slate-100 outline-none focus:border-red-500 dark:focus:border-red-400"
                      />
                    ) : (
                      <p className="font-bold text-slate-800 dark:text-slate-200">{customer.tax_number || 'Байхгүй'}</p>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Хувь хүний хувьд: Овог, нэр, хүйс */}
            {customer.customer_type === 'individual' && (
              <>
                <div className="flex items-center gap-3 p-3 bg-slate-50/50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <User size={16} className="text-slate-400 dark:text-slate-500 shrink-0" />
                  <div className="w-full grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-[10px] text-slate-400 dark:text-slate-400 font-bold">Овог</p>
                      {isEditing ? (
                        <input
                          type="text"
                          name="last_name"
                          value={formData.last_name || ''}
                          onChange={handleInputChange}
                          className="w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 rounded-xl font-bold text-slate-800 dark:text-slate-100 outline-none focus:border-red-500 dark:focus:border-red-400"
                        />
                      ) : (
                        <p className="font-bold text-slate-800 dark:text-slate-200">{customer.last_name || '-'}</p>
                      )}
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 dark:text-slate-400 font-bold">Нэр</p>
                      {isEditing ? (
                        <input
                          type="text"
                          name="first_name"
                          value={formData.first_name || ''}
                          onChange={handleInputChange}
                          className="w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 rounded-xl font-bold text-slate-800 dark:text-slate-100 outline-none focus:border-red-500 dark:focus:border-red-400"
                        />
                      ) : (
                        <p className="font-bold text-slate-800 dark:text-slate-200">{customer.first_name || '-'}</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-slate-50/50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <User size={16} className="text-slate-400 dark:text-slate-500 shrink-0" />
                  <div className="w-full">
                    <p className="text-[10px] text-slate-400 dark:text-slate-400 font-bold">
                      Хүйс {isEditing && <span className="text-red-500">*</span>}
                    </p>
                    {isEditing ? (
                      <div role="radiogroup" aria-label="Хүйс" className="grid grid-cols-2 gap-2 mt-1">
                        {GENDERS.map((gender) => (
                          <button
                            key={gender}
                            type="button"
                            role="radio"
                            aria-checked={formData.male === gender}
                            onClick={() => setFormData((prev) => ({ ...prev, male: gender }))}
                            className={`py-1.5 rounded-xl font-bold border transition-all cursor-pointer ${
                              formData.male === gender
                                ? 'bg-red-50 dark:bg-red-950/60 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400'
                                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
                            }`}
                          >
                            {gender}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="font-bold text-slate-800 dark:text-slate-200">
                        {isGender(customer.male) ? customer.male : 'Сонгоогүй'}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-slate-50/50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <Cake size={16} className="text-slate-400 dark:text-slate-500 shrink-0" />
                  <div className="w-full">
                    <label htmlFor="customer-birth-date" className="block text-[10px] text-slate-400 dark:text-slate-400 font-bold">
                      Төрсөн огноо
                      {isEditing && formAge !== null && <span className="ml-1 font-semibold">({formAge} нас)</span>}
                    </label>
                    {isEditing ? (
                      <input
                        id="customer-birth-date"
                        type="date"
                        name="birth_date"
                        min={BIRTH_DATE_MIN}
                        max={todayIsoDate()}
                        value={formData.birth_date || ''}
                        onChange={handleInputChange}
                        className="w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 rounded-xl font-bold text-slate-800 dark:text-slate-100 outline-none focus:border-red-500 dark:focus:border-red-400"
                      />
                    ) : (
                      <p className="font-bold text-slate-800 dark:text-slate-200">
                        {customer.birth_date ? `${customer.birth_date}${age !== null ? ` (${age} нас)` : ''}` : 'Байхгүй'}
                      </p>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Баруун багана */}
          <div className="space-y-4">
            <h3 className="font-black text-slate-400 dark:text-slate-400 uppercase tracking-wider text-[11px]">Бусад мэдээлэл</h3>
            
            <div className="flex items-center gap-3 p-3 bg-slate-50/50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
              <MapPin size={16} className="text-slate-400 dark:text-slate-500 shrink-0" />
              <div className="w-full">
                <p className="text-[10px] text-slate-400 dark:text-slate-400 font-bold">Хаяг байршил</p>
                {isEditing ? (
                  <input
                    type="text"
                    name="address"
                    value={formData.address || ''}
                    onChange={handleInputChange}
                    className="w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 rounded-xl font-bold text-slate-800 dark:text-slate-100 outline-none focus:border-red-500 dark:focus:border-red-400"
                  />
                ) : (
                  <p className="font-bold text-slate-800 dark:text-slate-200">{customer.address || 'Байхгүй'}</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-slate-50/50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
              <Calendar size={16} className="text-slate-400 dark:text-slate-500 shrink-0" />
              <div>
                <p className="text-[10px] text-slate-400 dark:text-slate-400 font-bold">Бүртгүүлсэн огноо</p>
                <p className="font-bold text-slate-800 dark:text-slate-200">
                  {customer.create_date ? new Date(customer.create_date).toLocaleString() : '-'}
                  {customer.source && (
                    <span className="ml-2 text-[10px] font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/60 px-2 py-0.5 rounded-full">
                      {SOURCE_LABELS[customer.source] ?? customer.source}
                    </span>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-slate-50/50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
              <RefreshCw size={16} className="text-slate-400 dark:text-slate-500 shrink-0" />
              <div>
                <p className="text-[10px] text-slate-400 dark:text-slate-400 font-bold">Шинэчилсэн огноо</p>
                <p className="font-bold text-slate-800 dark:text-slate-200">
                  {customer.update_date ? new Date(customer.update_date).toLocaleString() : '-'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {customer.submissions && customer.submissions.length > 0 && (
        <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-2xs space-y-4">
          <h3 className="font-black text-slate-400 dark:text-slate-400 uppercase tracking-wider text-[11px]">
            QR анкетын түүх ({customer.submissions.length})
          </h3>
          <div className="space-y-3">
            {customer.submissions.map((submission) => (
              <div key={submission.id} className="p-4 bg-slate-50/50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <p className="font-bold text-sm text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <FileText size={14} className="text-red-500" /> {submission.template_title || 'Анкет'}
                  </p>
                  <p className="text-[11px] font-semibold text-slate-400">{new Date(submission.submitted_at).toLocaleString()}</p>
                </div>
                <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
                  {submission.answers.map((answer, i) => (
                    <div key={i} className="flex gap-2">
                      <dt className="text-slate-400 font-semibold shrink-0">{answer.label}:</dt>
                      <dd className="font-bold text-slate-700 dark:text-slate-200 break-words">{answer.value || '—'}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}