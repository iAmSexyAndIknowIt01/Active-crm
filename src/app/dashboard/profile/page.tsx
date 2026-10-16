'use client';

import { useState, useEffect } from 'react';
import { User, Building2, Mail, Phone, MapPin, Shield, CheckCircle2, Edit3, X, Save, Loader2, KeyRound } from 'lucide-react';
import PasswordInput from '@/src/components/PasswordInput';

export default function ProfilePage() {
  const [loading, setLoading] = useState(true);
  const [successMessage, setSuccessMessage] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // mt_user болон mt_company багануудын дагуух төлөв
  const [formData, setFormData] = useState({
    companyName: '',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const [tempData, setTempData] = useState(formData);
  const [serverMessage, setServerMessage] = useState('');
  // Имэйл солиход одоогийн нууц үг шаардлагатай (бүртгэл булаахаас хамгаална)
  const emailChanged = isEditing && formData.email.trim().toLowerCase() !== tempData.email.trim().toLowerCase();

  // API-аас хэрэглэгчийн мэдээлэл татаж авах (/api/profile руу хандана)
  useEffect(() => {
    async function fetchUserData() {
      try {
        const res = await fetch('/api/profile');
        const result = await res.json();
        if (result.success) {
          const user = result.data;
          const initialData = {
            companyName: user.company_name || '',
            firstName: user.first_name || '',
            lastName: user.last_name || '',
            email: user.email || '',
            phone: user.phone || '',
            address: user.address || '',
            currentPassword: '',
            newPassword: '',
            confirmPassword: ''
          };
          setFormData(initialData);
          setTempData(initialData);
        } else {
          setErrorMessage(result.error || 'Мэдээлэл татахад алдаа гарлаа.');
        }
      } catch (err) {
        console.error('Failed to load profile', err);
        setErrorMessage('Сервертэй холбогдоход алдаа гарлаа.');
      } finally {
        setLoading(false);
      }
    }
    fetchUserData();
  }, []);

  const handleEditClick = () => {
    setTempData(formData);
    setIsEditing(true);
  };

  const handleCancelClick = () => {
    setFormData(tempData);
    setIsEditing(false);
    setIsChangingPassword(false);
    setErrorMessage('');
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (emailChanged && !formData.currentPassword) {
      setErrorMessage('Имэйл хаягаа солихын тулд одоогийн нууц үгээ оруулна уу.');
      return;
    }

    if (isChangingPassword && formData.newPassword) {
      if (!formData.currentPassword) {
        setErrorMessage('Хуучин нууц үгээ оруулна уу.');
        return;
      }
      if (formData.newPassword !== formData.confirmPassword) {
        setErrorMessage('Шинэ нууц үг хоорондоо таарахгүй байна.');
        return;
      }
    }

    try {
      const submitData = isChangingPassword ? formData : {
        ...formData,
        // Имэйл солиход одоогийн нууц үгийг дамжуулна
        currentPassword: emailChanged ? formData.currentPassword : '',
        newPassword: '',
        confirmPassword: ''
      };

      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submitData)
      });
      const result = await res.json();

      if (result.success) {
        const saved = { ...formData, currentPassword: '', newPassword: '', confirmPassword: '' };
        setFormData(saved);
        setTempData(saved);
        setServerMessage(result.message || '');
        setIsEditing(false);
        setIsChangingPassword(false);
        setSuccessMessage(true);
        setTimeout(() => setSuccessMessage(false), 5000);
      } else {
        setErrorMessage(result.error || 'Хадгалахад алдаа гарлаа.');
      }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (err) {
      setErrorMessage('Сервертэй холбогдоход алдаа гарлаа.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-100">
        <Loader2 className="w-8 h-8 animate-spin text-red-600 dark:text-red-400" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 sm:space-y-8 pb-20 font-sans antialiased text-slate-800 dark:text-slate-100">
      
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">Хэрэглэгчийн профайл</h1>
          <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm mt-1">Бүртгэлтэй мэдээллээ харж, шинэчлэх боломжтой.</p>
        </div>

        {!isEditing && (
          <button 
            type="button"
            onClick={handleEditClick}
            className="flex items-center justify-center gap-2 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs transition-all text-sm cursor-pointer self-start sm:self-auto"
          >
            <Edit3 size={16} className="text-red-600 dark:text-red-400" /> Засах
          </button>
        )}
      </div>

      {successMessage && (
        <div className="bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 px-4 py-3 rounded-2xl flex items-center gap-2 text-xs sm:text-sm font-bold shadow-2xs">
          <CheckCircle2 size={18} className="shrink-0 text-emerald-600 dark:text-emerald-400" /> {serverMessage || 'Мэдээлэл амжилттай шинэчлэгдлээ!'}
        </div>
      )}

      {errorMessage && (
        <div className="bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 px-4 py-3 rounded-2xl text-xs sm:text-sm font-bold shadow-2xs">
          {errorMessage}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white dark:bg-slate-900 p-5 sm:p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-100 dark:border-slate-800 gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 sm:w-16 sm:h-16 bg-linear-to-tr from-red-600 to-red-400 text-white rounded-2xl flex items-center justify-center font-black text-lg sm:text-xl shadow-md shrink-0">
                {formData.firstName ? formData.firstName.substring(0, 2).toUpperCase() : 'ХӨ'}
              </div>
              <div className="min-w-0">
                <h2 className="font-extrabold text-base sm:text-lg text-slate-900 dark:text-white truncate">{formData.lastName} {formData.firstName}</h2>
                <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm truncate">Компани: {formData.companyName}</p>
              </div>
            </div>
            <span className={`text-xs font-bold px-3 py-1 rounded-full self-start sm:self-auto ${isEditing ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}>
              {isEditing ? 'Засах горим' : 'Харах горим'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">Компанийн нэр</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-400 dark:text-slate-500"><Building2 size={18} /></span>
                <input 
                  type="text" 
                  name="companyName"
                  value={formData.companyName}
                  disabled={true} // Компанийн нэрийг профайлаас шууд өөрчлөхгүй байхаар тохируулав
                  className="w-full pl-11 pr-4 py-3 border rounded-2xl text-slate-600 dark:text-slate-400 text-sm bg-slate-100/60 dark:bg-slate-800/60 border-slate-100 dark:border-slate-800 cursor-not-allowed"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">Имэйл хаяг</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-400 dark:text-slate-500"><Mail size={18} /></span>
                <input 
                  type="email" 
                  name="email"
                  value={formData.email}
                  disabled={!isEditing}
                  onChange={handleChange}
                  className={`w-full pl-11 pr-4 py-3 border rounded-2xl text-sm transition-all ${
                    isEditing 
                      ? 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-red-600 focus:bg-white dark:focus:bg-slate-900' 
                      : 'bg-slate-100/60 dark:bg-slate-800/60 border-slate-100 dark:border-slate-800 cursor-not-allowed text-slate-600 dark:text-slate-400'
                  }`}
                />
              </div>
              {emailChanged && !isChangingPassword && (
                <div className="mt-3">
                  <label className="block text-xs font-bold text-amber-700 dark:text-amber-400 mb-1.5">
                    Имэйл солихын тулд одоогийн нууц үгээ оруулна уу
                  </label>
                  <PasswordInput
                    name="currentPassword"
                    value={formData.currentPassword}
                    onChange={handleChange}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    className="w-full pl-4 pr-11 py-3 bg-amber-50/50 dark:bg-slate-800 border border-amber-200 dark:border-amber-900 rounded-2xl text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:border-red-600 focus:bg-white dark:focus:bg-slate-900"
                  />
                </div>
              )}
            </div>
            
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">Овог</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-400 dark:text-slate-500"><User size={18} /></span>
                <input 
                  type="text" 
                  name="lastName"
                  value={formData.lastName}
                  disabled={!isEditing}
                  onChange={handleChange}
                  className={`w-full pl-11 pr-4 py-3 border rounded-2xl text-sm transition-all ${
                    isEditing 
                      ? 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-red-600 focus:bg-white dark:focus:bg-slate-900' 
                      : 'bg-slate-100/60 dark:bg-slate-800/60 border-slate-100 dark:border-slate-800 cursor-not-allowed text-slate-600 dark:text-slate-400'
                  }`}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">Нэр</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-400 dark:text-slate-500"><User size={18} /></span>
                <input 
                  type="text" 
                  name="firstName"
                  value={formData.firstName}
                  disabled={!isEditing}
                  onChange={handleChange}
                  className={`w-full pl-11 pr-4 py-3 border rounded-2xl text-sm transition-all ${
                    isEditing 
                      ? 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-red-600 focus:bg-white dark:focus:bg-slate-900' 
                      : 'bg-slate-100/60 dark:bg-slate-800/60 border-slate-100 dark:border-slate-800 cursor-not-allowed text-slate-600 dark:text-slate-400'
                  }`}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">Утасны дугаар</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-400 dark:text-slate-500"><Phone size={18} /></span>
                <input 
                  type="text" 
                  name="phone"
                  value={formData.phone}
                  disabled={!isEditing}
                  onChange={handleChange}
                  className={`w-full pl-11 pr-4 py-3 border rounded-2xl text-sm transition-all ${
                    isEditing 
                      ? 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-red-600 focus:bg-white dark:focus:bg-slate-900' 
                      : 'bg-slate-100/60 dark:bg-slate-800/60 border-slate-100 dark:border-slate-800 cursor-not-allowed text-slate-600 dark:text-slate-400'
                  }`}
                />
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">Хаяг байршил</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-400 dark:text-slate-500"><MapPin size={18} /></span>
                <input 
                  type="text" 
                  name="address"
                  value={formData.address}
                  disabled={!isEditing}
                  onChange={handleChange}
                  className={`w-full pl-11 pr-4 py-3 border rounded-2xl text-sm transition-all ${
                    isEditing 
                      ? 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-red-600 focus:bg-white dark:focus:bg-slate-900' 
                      : 'bg-slate-100/60 dark:bg-slate-800/60 border-slate-100 dark:border-slate-800 cursor-not-allowed text-slate-600 dark:text-slate-400'
                  }`}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Нууц үг солих хэсэг */}
        {isEditing && (
          <div className="bg-white dark:bg-slate-900 p-5 sm:p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <Shield className="text-red-600 dark:text-red-400 shrink-0" size={20} />
                <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">Аюулгүй байдал</h3>
              </div>

              {!isChangingPassword ? (
                <button
                  type="button"
                  onClick={() => setIsChangingPassword(true)}
                  className="flex items-center gap-2 text-xs font-bold bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-900 hover:bg-red-100 dark:hover:bg-red-900 px-3.5 py-2 rounded-xl transition-all cursor-pointer"
                >
                  <KeyRound size={14} /> Нууц үг солих
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setIsChangingPassword(false);
                    setFormData(prev => ({ ...prev, currentPassword: '', newPassword: '', confirmPassword: '' }));
                  }}
                  className="text-xs font-bold text-rose-500 hover:text-rose-700 dark:hover:text-rose-400 transition-all cursor-pointer"
                >
                  Цуцлах
                </button>
              )}
            </div>

            {isChangingPassword && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">Хуучин нууц үг</label>
                  <PasswordInput
                    name="currentPassword"
                    value={formData.currentPassword}
                    onChange={handleChange}
                    placeholder="••••••••"
                    className="w-full pl-4 pr-11 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:border-red-600 focus:bg-white dark:focus:bg-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">Шинэ нууц үг</label>
                  <PasswordInput
                    name="newPassword"
                    value={formData.newPassword}
                    onChange={handleChange}
                    placeholder="••••••••"
                    className="w-full pl-4 pr-11 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:border-red-600 focus:bg-white dark:focus:bg-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">Шинэ нууц үг давтах</label>
                  <PasswordInput
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    placeholder="••••••••"
                    className="w-full pl-4 pr-11 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:border-red-600 focus:bg-white dark:focus:bg-slate-900"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {isEditing && (
          <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-3">
            <button 
              type="button"
              onClick={handleCancelClick}
              className="w-full sm:w-auto flex items-center justify-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold px-6 py-3.5 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all text-sm cursor-pointer"
            >
              <X size={18} /> Цуцлах
            </button>
            <button 
              type="submit"
              className="w-full sm:w-auto flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold px-8 py-3.5 rounded-2xl shadow-lg shadow-red-500/20 transition-all text-sm cursor-pointer"
            >
              <Save size={18} /> Өөрчлөлтийг хадгалах
            </button>
          </div>
        )}
      </form>
    </div>
  );
}