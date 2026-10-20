'use client';

import React, { useEffect } from 'react';
import { useMounted } from '@/src/lib/use-mounted';
import { createPortal } from 'react-dom';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';

interface CommonModalProps {
  isOpen: boolean;
  type?: 'success' | 'error';
  title?: string;
  message: string;
  onClose: () => void;
  onConfirm?: () => void;
  confirmText?: string;
}

export default function CommonModal({
  isOpen,
  type = 'success',
  title,
  message,
  onClose,
  onConfirm,
  confirmText = 'Ойлголоо',
}: CommonModalProps) {
  const mounted = useMounted();

  // Модал нээгдэх үед арын background scroll хийгдэхгүй болгох
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen || !mounted) return null;

  const isSuccess = type === 'success';

  // createPortal ашиглан body дээр шууд байрлуулж, fixed inset-0 ашиглан дэлгэцийг 100% бүрхэнэ
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 dark:bg-slate-950/60 backdrop-blur-md px-4 animate-in fade-in duration-200 transition-colors">
      <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-3xl p-6 shadow-2xl dark:shadow-none border border-slate-100 dark:border-slate-800 text-center space-y-4 relative animate-in zoom-in-95 duration-200">
        
        {/* Хаах товч */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 p-1.5 rounded-full hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <X size={18} />
        </button>

        {/* Икон */}
        <div className={`w-12 h-12 rounded-2xl mx-auto flex items-center justify-center shadow-xs ${
          isSuccess 
            ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400' 
            : 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400'
        }`}>
          {isSuccess ? <CheckCircle2 size={24} /> : <AlertCircle size={24} />}
        </div>

        {/* Гарчиг болон Мэдэгдэл */}
        <div className="space-y-1">
          <h3 className="text-base font-black text-slate-900 dark:text-white">
            {title || (isSuccess ? 'Амжилттай' : 'Анхааруулга')}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
            {message}
          </p>
        </div>

        {/* Үйлдлийн товч */}
        <div className="pt-2 flex gap-2">
          <button
            onClick={() => {
              if (onConfirm) onConfirm();
              else onClose();
            }}
            className={`w-full py-3 px-4 rounded-2xl text-xs font-bold text-white shadow-md transition-all cursor-pointer ${
              isSuccess 
                ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20' 
                : 'bg-rose-600 hover:bg-rose-700 shadow-rose-500/20'
            }`}
          >
            {confirmText}
          </button>
        </div>

      </div>
    </div>,
    document.body
  );
}