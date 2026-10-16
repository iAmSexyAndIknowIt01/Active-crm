'use client';

import { useState, useEffect } from 'react';
import { Building2, CheckCircle2, Edit3, X, Save, Loader2, Lock } from 'lucide-react';

interface CompanyForm {
  companyName: string;
  email: string;
  phoneNumber: string;
  address: string;
}

const EMPTY_FORM: CompanyForm = { companyName: '', email: '', phoneNumber: '', address: '' };

const FIELDS: { key: keyof CompanyForm; label: string; type: string; placeholder: string }[] = [
  { key: 'companyName', label: 'Компанийн нэр', type: 'text', placeholder: 'Компанийн нэр' },
  { key: 'email', label: 'Имэйл хаяг', type: 'email', placeholder: 'info@company.mn' },
  { key: 'phoneNumber', label: 'Утасны дугаар', type: 'text', placeholder: '+976 99...' },
  { key: 'address', label: 'Хаяг', type: 'text', placeholder: 'Улаанбаатар хот, ...' },
];

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState(false);
  const [error, setError] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [canEdit, setCanEdit] = useState(false);

  const [form, setForm] = useState<CompanyForm>(EMPTY_FORM);
  const [savedForm, setSavedForm] = useState<CompanyForm>(EMPTY_FORM);

  // Хуудас ачаалагдахад компанийн мэдээллийг татах
  useEffect(() => {
    async function fetchCompany() {
      try {
        const res = await fetch('/api/company');
        const json = await res.json();
        if (json.success && json.data) {
          const loaded = {
            companyName: json.data.company_name ?? '',
            email: json.data.email ?? '',
            phoneNumber: json.data.phone_number ?? '',
            address: json.data.address ?? '',
          };
          setForm(loaded);
          setSavedForm(loaded);
          setCanEdit(Boolean(json.canEdit));
        } else {
          setError(json.error || 'Мэдээлэл авахад алдаа гарлаа.');
        }
      } catch (err) {
        console.error('Failed to load company:', err);
        setError('Сервертэй холбогдож чадсангүй.');
      } finally {
        setLoading(false);
      }
    }
    fetchCompany();
  }, []);

  const handleCancelClick = () => {
    setForm(savedForm);
    setError('');
    setIsEditing(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      const res = await fetch('/api/company', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await res.json();

      if (json.success) {
        setSavedForm(form);
        setIsEditing(false);
        setSuccessMessage(true);
        setTimeout(() => setSuccessMessage(false), 3000);
      } else {
        setError(json.error || 'Хадгалахад алдаа гарлаа.');
      }
    } catch (err) {
      console.error('Failed to save company:', err);
      setError('Сүлжээний алдаа гарлаа.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-100">
        <Loader2 className="w-8 h-8 text-red-600 dark:text-red-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 sm:space-y-8 font-sans antialiased text-slate-800 dark:text-slate-100">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">Ерөнхий тохиргоо</h1>
          <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm mt-1">Байгууллагын үндсэн мэдээлэл. Нууц үгээ &quot;Профайл&quot; хуудаснаас солино.</p>
        </div>

        {!isEditing && canEdit && (
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="flex items-center justify-center gap-2 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs transition-all text-sm cursor-pointer self-start sm:self-auto"
          >
            <Edit3 size={16} className="text-red-600 dark:text-red-400" /> Засах
          </button>
        )}
      </div>

      {successMessage && (
        <div className="bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 px-4 py-3 rounded-2xl flex items-center gap-2 text-xs sm:text-sm font-bold shadow-2xs animate-in fade-in">
          <CheckCircle2 size={18} className="shrink-0 text-emerald-600 dark:text-emerald-400" /> Мэдээлэл амжилттай хадгалагдлаа!
        </div>
      )}

      {error && (
        <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 px-4 py-3 rounded-2xl text-xs sm:text-sm font-bold">
          {error}
        </div>
      )}

      {!canEdit && (
        <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 px-4 py-3 rounded-2xl flex items-center gap-2 text-xs sm:text-sm font-medium">
          <Lock size={16} className="shrink-0" /> Энэ мэдээллийг зөвхөн админ засах эрхтэй.
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        <div className="bg-white dark:bg-slate-900 p-5 sm:p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-100 dark:border-slate-800 gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 rounded-2xl flex items-center justify-center shrink-0">
                <Building2 size={20} />
              </div>
              <div>
                <h2 className="font-extrabold text-base sm:text-lg text-slate-900 dark:text-white">Байгууллагын мэдээлэл</h2>
                <p className="text-slate-400 dark:text-slate-400 text-xs mt-0.5">Нэр, холбоо барих мэдээлэл</p>
              </div>
            </div>
            <span className={`text-xs font-bold px-3 py-1 rounded-full self-start sm:self-auto ${isEditing ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}>
              {isEditing ? 'Засах горим' : 'Харах горим'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
            {FIELDS.map((field) => (
              <label key={field.key} className={`space-y-1.5 ${field.key === 'address' ? 'sm:col-span-2' : ''}`}>
                <span className="text-xs font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">{field.label}</span>
                <input
                  type={field.type}
                  value={form[field.key]}
                  placeholder={field.placeholder}
                  disabled={!isEditing}
                  required={field.key === 'companyName'}
                  onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
                  className="w-full px-4 py-3 rounded-2xl bg-slate-50/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-800 dark:text-slate-100 focus:outline-hidden focus:border-red-500 dark:focus:border-red-400 focus:bg-white dark:focus:bg-slate-800 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                />
              </label>
            ))}
          </div>
        </div>

        {isEditing && (
          <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-3 animate-in fade-in">
            <button
              type="button"
              onClick={handleCancelClick}
              disabled={saving}
              className="w-full sm:w-auto flex items-center justify-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold px-6 py-3.5 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all text-sm cursor-pointer"
            >
              <X size={18} /> Цуцлах
            </button>
            <button
              type="submit"
              disabled={saving}
              className="w-full sm:w-auto flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold px-8 py-3.5 rounded-2xl shadow-lg shadow-red-500/20 transition-all text-sm cursor-pointer disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save size={18} />} Өөрчлөлтийг хадгалах
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
