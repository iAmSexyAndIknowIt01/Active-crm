'use client';

import { useRef, useState } from 'react';
import { Upload, FileSpreadsheet, Download, Loader2, CheckCircle2, AlertTriangle, X } from 'lucide-react';
import {
  IMPORT_FIELDS,
  IMPORT_MAX_ROWS,
  cellToString,
  guessColumnMapping,
  parseCsv,
  validateImportRow,
  type ImportType,
} from '@/src/lib/customer-import';

interface ImportResult {
  total: number;
  created: number;
  merged: number;
  failed: number;
  errors: { line: number; error: string }[];
}

const TYPE_LABELS: Record<ImportType, string> = {
  individual: 'Хувь хүн харилцагч',
  company: 'Байгууллага харилцагч',
};

const PREVIEW_ROWS = 5;

// Excel (.xlsx) эсвэл CSV файлаас харилцагч оруулах: файл сонгох → багана тааруулах → хадгалах
export default function ImportCustomers({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [type, setType] = useState<ImportType>('individual');
  const [fileName, setFileName] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<string, number>>({});
  const [parseError, setParseError] = useState('');
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const fields = IMPORT_FIELDS[type];

  const resetFile = () => {
    setFileName('');
    setHeaders([]);
    setRows([]);
    setMapping({});
    setResult(null);
    setParseError('');
    if (fileInput.current) fileInput.current.value = '';
  };

  const changeType = (next: ImportType) => {
    setType(next);
    setResult(null);
    if (headers.length > 0) setMapping(guessColumnMapping(next, headers));
  };

  const handleFile = async (file: File) => {
    resetFile();
    setParsing(true);
    try {
      let table: string[][];
      if (/\.xlsx$/i.test(file.name)) {
        const { readSheet } = await import('read-excel-file/browser');
        const data = await readSheet(file);
        table = data.map((row) => row.map(cellToString));
      } else if (/\.(csv|txt)$/i.test(file.name)) {
        table = parseCsv(await file.text());
      } else {
        throw new Error('Зөвхөн .xlsx эсвэл .csv файл оруулна уу (.xls бол Excel-ээр .xlsx болгож хадгална уу).');
      }

      table = table.filter((r) => r.some((c) => c.trim() !== ''));
      if (table.length < 2) throw new Error('Файлд толгой мөр болон дор хаяж нэг өгөгдлийн мөр байх ёстой.');
      if (table.length - 1 > IMPORT_MAX_ROWS) {
        throw new Error(`Нэг удаад хамгийн ихдээ ${IMPORT_MAX_ROWS} мөр оруулна. Файлаа хувааж оруулна уу.`);
      }

      const headerRow = table[0].map((h, i) => h.trim() || `Багана ${i + 1}`);
      setFileName(file.name);
      setHeaders(headerRow);
      setRows(table.slice(1));
      setMapping(guessColumnMapping(type, headerRow));
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Файлыг уншиж чадсангүй.');
    } finally {
      setParsing(false);
    }
  };

  // Тааруулсан баганаар мөр бүрийг талбарын объект болгоно
  const mappedRows = rows.map((row, i) => {
    const obj: Record<string, string | number> = { line: i + 2 };
    for (const field of fields) {
      const col = mapping[field.key];
      if (col !== undefined && col >= 0) obj[field.key] = row[col] ?? '';
    }
    return obj;
  });
  const invalidCount = mappedRows.filter((r) => 'error' in validateImportRow(type, r)).length;
  const missingRequired = fields.filter((f) => f.required && !(mapping[f.key] >= 0));

  const handleImport = async () => {
    setImporting(true);
    setResult(null);
    setParseError('');
    try {
      const res = await fetch('/api/customers/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, rows: mappedRows }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Өгөгдөл оруулахад алдаа гарлаа.');
      setResult(json.data);
      onImported();
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Сүлжээний алдаа гарлаа.');
    } finally {
      setImporting(false);
    }
  };

  // Хоосон загвар файл (CSV, Excel-д нээгдэнэ)
  const downloadTemplate = () => {
    const header = fields.map((f) => f.label).join(',');
    const sample =
      type === 'individual'
        ? 'Бат,Болд,99112233,bold@example.mn,Улаанбаатар,Эрэгтэй,1990-05-21'
        : 'Жишээ ХХК,1234567,77001122,info@example.mn,Улаанбаатар';
    const blob = new Blob(['﻿' + header + '\n' + sample + '\n'], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = type === 'individual' ? 'harilcagch-huvi-hun.csv' : 'harilcagch-baiguullaga.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const selectClass =
    'w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:border-red-600 cursor-pointer';

  return (
    <div className="bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-3xl border border-red-200 dark:border-red-900 shadow-xs space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <FileSpreadsheet size={18} className="text-red-600 dark:text-red-400" /> Файлаас харилцагч оруулах
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Excel (.xlsx) эсвэл CSV файлын эхний мөрөнд баганын нэр байна. Утас, имэйл (байгууллага бол регистр)-ээр
            давхардсан харилцагчийг шинээр үүсгэхгүй, зөвхөн хоосон мэдээллийг нь нөхнө.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          aria-label="Хаах"
        >
          <X size={18} />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(Object.keys(TYPE_LABELS) as ImportType[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => changeType(t)}
            className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
              type === t
                ? 'bg-red-600 text-white border-red-600'
                : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
            }`}
          >
            {TYPE_LABELS[t]}
          </button>
        ))}
        <button
          type="button"
          onClick={downloadTemplate}
          className="ml-auto flex items-center gap-1.5 text-xs font-bold text-red-600 dark:text-red-400 hover:underline cursor-pointer"
        >
          <Download size={14} /> Загвар файл татах
        </button>
      </div>

      <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-red-400 rounded-2xl py-8 cursor-pointer transition-colors">
        {parsing ? <Loader2 size={24} className="animate-spin text-red-600" /> : <Upload size={24} className="text-red-600" />}
        <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
          {fileName || 'Файл сонгох (.xlsx, .csv)'}
        </span>
        {fileName && <span className="text-xs text-slate-400">{rows.length} мөр уншигдлаа · өөр файл сонгох бол дарна уу</span>}
        <input
          ref={fileInput}
          type="file"
          accept=".xlsx,.csv,.txt"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
      </label>

      {parseError && (
        <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 px-4 py-3 rounded-2xl text-xs font-bold flex items-center gap-2">
          <AlertTriangle size={16} className="shrink-0" /> {parseError}
        </div>
      )}

      {headers.length > 0 && !result && (
        <>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              Багана тааруулах
            </h3>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {fields.map((field) => (
                <div key={field.key}>
                  <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                    {field.label} {field.required && <span className="text-rose-500">*</span>}
                  </label>
                  <select
                    value={mapping[field.key] ?? -1}
                    onChange={(e) => setMapping({ ...mapping, [field.key]: Number(e.target.value) })}
                    className={selectClass}
                  >
                    <option value={-1}>— Оруулахгүй —</option>
                    {headers.map((h, i) => (
                      <option key={i} value={i}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-2xl">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60">
                <tr>
                  <th className="px-3 py-2 text-left font-bold text-slate-500">Мөр</th>
                  {fields.map((f) => (
                    <th key={f.key} className="px-3 py-2 text-left font-bold text-slate-500 whitespace-nowrap">
                      {f.label}
                    </th>
                  ))}
                  <th className="px-3 py-2 text-left font-bold text-slate-500">Шалгалт</th>
                </tr>
              </thead>
              <tbody>
                {mappedRows.slice(0, PREVIEW_ROWS).map((row) => {
                  const check = validateImportRow(type, row);
                  return (
                    <tr key={row.line} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="px-3 py-2 text-slate-400">{row.line}</td>
                      {fields.map((f) => (
                        <td key={f.key} className="px-3 py-2 font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap">
                          {row[f.key] ?? ''}
                        </td>
                      ))}
                      <td className="px-3 py-2 font-bold whitespace-nowrap">
                        {'error' in check ? (
                          <span className="text-rose-600 dark:text-rose-400">{check.error}</span>
                        ) : (
                          <span className="text-emerald-600 dark:text-emerald-400">Зөв</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Нийт {rows.length} мөр
              {invalidCount > 0 && <span className="text-rose-600 dark:text-rose-400"> · {invalidCount} мөр алдаатай тул алгасна</span>}
              {missingRequired.length > 0 && (
                <span className="text-rose-600 dark:text-rose-400">
                  {' '}
                  · Заавал багана тааруулна уу: {missingRequired.map((f) => f.label).join(', ')}
                </span>
              )}
            </p>
            <button
              type="button"
              onClick={handleImport}
              disabled={importing || missingRequired.length > 0 || invalidCount === rows.length}
              className="flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white px-5 py-2.5 rounded-2xl font-bold text-sm transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {importing ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
              {rows.length - invalidCount} харилцагч оруулах
            </button>
          </div>
        </>
      )}

      {result && (
        <div className="space-y-3">
          <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-300 px-4 py-3 rounded-2xl text-sm font-bold flex items-center gap-2">
            <CheckCircle2 size={18} className="shrink-0" />
            {result.created} шинэ харилцагч нэмэгдэж, {result.merged} давхардсан харилцагчийн мэдээлэл нөхөгдлөө.
            {result.failed > 0 && ` ${result.failed} мөр алгасагдлаа.`}
          </div>
          {result.errors.length > 0 && (
            <ul className="max-h-48 overflow-y-auto text-xs space-y-1 bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4">
              {result.errors.map((e, i) => (
                <li key={i} className="text-slate-600 dark:text-slate-300">
                  <span className="font-bold text-rose-600 dark:text-rose-400">{e.line}-р мөр:</span> {e.error}
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            onClick={resetFile}
            className="text-xs font-bold text-red-600 dark:text-red-400 hover:underline cursor-pointer"
          >
            Өөр файл оруулах
          </button>
        </div>
      )}
    </div>
  );
}
