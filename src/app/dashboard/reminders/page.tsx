'use client';

import { useEffect, useState } from 'react';
import { BellRing, CalendarClock, UserRoundCheck, Save, Send, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import LoadingComponent from '@/src/app/components/loading';
import {
  DEFAULT_FOLLOWUP_TEMPLATE,
  DEFAULT_RESERVATION_TEMPLATE,
  TEMPLATE_MAX_LENGTH,
  TEMPLATE_PLACEHOLDERS,
  renderReminderTemplate,
} from '@/src/lib/reminder-template';

interface Settings {
  reservation_enabled: boolean;
  reservation_template: string | null;
  followup_enabled: boolean;
  followup_days: number;
  followup_template: string | null;
}

interface LogRow {
  id: string;
  kind: 'reservation' | 'followup';
  customer_name: string | null;
  channel: 'email' | 'sms' | null;
  recipient: string | null;
  status: 'pending' | 'sent' | 'failed' | 'skipped';
  error: string | null;
  created_at: string;
}

const STATUS_STYLE: Record<LogRow['status'], { label: string; className: string }> = {
  sent: { label: 'Илгээсэн', className: 'text-emerald-700 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-950/50' },
  failed: { label: 'Алдаа', className: 'text-rose-700 bg-rose-50 dark:text-rose-300 dark:bg-rose-950/50' },
  skipped: { label: 'Алгассан', className: 'text-amber-700 bg-amber-50 dark:text-amber-300 dark:bg-amber-950/50' },
  pending: { label: 'Илгээж байна', className: 'text-slate-600 bg-slate-100 dark:text-slate-300 dark:bg-slate-800' },
};

const SAMPLE_VALUES = {
  name: 'Дорж Сүхбат',
  company: 'Танай байгууллага',
  phone: '7700 0000',
  date: '2026-10-21',
  time: '10:30',
  service: 'Тос солих',
  days: 90,
};

interface ReminderData {
  settings: Settings;
  logs: LogRow[];
  channels: { sms: boolean; email: boolean };
}

async function fetchReminderData(): Promise<ReminderData> {
  const res = await fetch('/api/reminders');
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json.error || 'Тохиргоо авахад алдаа гарлаа.');
  return json.data;
}

export default function RemindersPage() {
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<Settings>({
    reservation_enabled: false,
    reservation_template: null,
    followup_enabled: false,
    followup_days: 90,
    followup_template: null,
  });
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [channels, setChannels] = useState({ sms: false, email: false });
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const applyData = (data: ReminderData) => {
    setSettings(data.settings);
    setLogs(data.logs);
    setChannels(data.channels);
  };

  useEffect(() => {
    fetchReminderData()
      .then(applyData)
      .catch((err) => setMessage({ type: 'error', text: err.message }))
      .finally(() => setLoading(false));
  }, []);

  const saveSettings = async () => {
    const res = await fetch('/api/reminders', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.error || 'Хадгалахад алдаа гарлаа.');
    return json.message as string;
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      setMessage({ type: 'success', text: await saveSettings() });
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Сүлжээний алдаа гарлаа.' });
    } finally {
      setSaving(false);
    }
  };

  const handleRun = async () => {
    setRunning(true);
    setMessage(null);
    try {
      // Дэлгэц дээрх (хадгалаагүй байж болох) тохиргоогоор илгээхийн тулд эхлээд хадгална
      await saveSettings();
      const res = await fetch('/api/reminders/run', { method: 'POST' });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Сануулга илгээхэд алдаа гарлаа.');
      const { sent, failed, skipped } = json.data;
      setMessage({
        type: 'success',
        text:
          sent + failed + skipped === 0
            ? 'Одоогоор илгээх сануулга алга.'
            : `${sent} сануулга илгээгдлээ${failed ? `, ${failed} алдаатай` : ''}${skipped ? `, ${skipped} холбоо барих мэдээлэлгүй тул алгаслаа` : ''}.`,
      });
      applyData(await fetchReminderData());
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Сүлжээний алдаа гарлаа.' });
    } finally {
      setRunning(false);
    }
  };

  if (loading) return <LoadingComponent text="Сануулгын тохиргоог ачаалж байна..." />;

  const noChannel = !channels.sms && !channels.email;

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20 text-slate-800 dark:text-slate-100">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl border border-slate-100 dark:border-slate-800">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 text-xs font-bold uppercase border border-red-100 dark:border-red-900">
            <BellRing size={12} /> Сануулга
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">Автомат сануулга</h1>
          <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm">
            Өдөр бүр өглөө 9 цагт систем харилцагчдад SMS эсвэл имэйлээр автоматаар сануулга илгээнэ.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleRun}
            disabled={running || saving}
            className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-red-400 px-4 py-3 rounded-2xl font-bold text-sm cursor-pointer disabled:opacity-50"
          >
            {running ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Одоо илгээх
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-2xl font-bold text-sm shadow-md shadow-red-500/20 cursor-pointer disabled:opacity-50"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Хадгалах
          </button>
        </div>
      </div>

      {noChannel && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-300 px-5 py-4 rounded-2xl text-xs sm:text-sm font-semibold flex gap-3">
          <AlertTriangle size={18} className="shrink-0" />
          Сервер дээр SMS (SMS_API_URL) болон имэйл (GMAIL_USER, GMAIL_APP_PASSWORD) илгээх тохиргоо хийгдээгүй байна.
          Тохиргоо хийгдэх хүртэл сануулга илгээгдэхгүй.
        </div>
      )}
      {!noChannel && (
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 px-1">
          Илгээх суваг: {channels.sms ? 'утасны дугаартай харилцагчид SMS' : ''}
          {channels.sms && channels.email ? ', бусдад ' : ''}
          {channels.email ? 'имэйл' : ''}.
        </p>
      )}

      {message && (
        <div
          className={`px-5 py-4 rounded-2xl flex items-center gap-3 text-xs sm:text-sm font-bold border ${
            message.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
              : 'bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300'
          }`}
        >
          {message.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />} {message.text}
        </div>
      )}

      <ReminderCard
        icon={<CalendarClock size={20} />}
        title="Цаг захиалгын сануулга"
        description="Маргааш цаг захиалсан (хүлээгдэж буй, баталгаажсан) харилцагчид өмнөх өдөр нь сануулна."
        enabled={settings.reservation_enabled}
        onToggle={(v) => setSettings({ ...settings, reservation_enabled: v })}
        template={settings.reservation_template ?? DEFAULT_RESERVATION_TEMPLATE}
        onTemplate={(v) => setSettings({ ...settings, reservation_template: v })}
        placeholders={['name', 'company', 'phone', 'date', 'time', 'service']}
      />

      <ReminderCard
        icon={<UserRoundCheck size={20} />}
        title="Дахин урих сануулга"
        description="Сүүлд үйлчлүүлснээс хойш тодорхой хоног өнгөрсөн, одоогоор захиалгагүй харилцагчийг оочер үүсэхээс өмнө дахин урина."
        enabled={settings.followup_enabled}
        onToggle={(v) => setSettings({ ...settings, followup_enabled: v })}
        template={settings.followup_template ?? DEFAULT_FOLLOWUP_TEMPLATE}
        onTemplate={(v) => setSettings({ ...settings, followup_template: v })}
        placeholders={['name', 'company', 'phone', 'days']}
      >
        <label className="flex items-center gap-3 text-sm font-semibold text-slate-600 dark:text-slate-300">
          Сүүлд үйлчлүүлснээс хойш
          <input
            type="number"
            min={7}
            max={730}
            value={settings.followup_days}
            onChange={(e) => setSettings({ ...settings, followup_days: Number(e.target.value) })}
            className="w-24 px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold focus:outline-none focus:border-red-600"
          />
          хоног болоход
        </label>
      </ReminderCard>

      <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl border border-slate-100 dark:border-slate-800 space-y-4">
        <h2 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">Сүүлд илгээсэн сануулгууд</h2>
        {logs.length === 0 ? (
          <p className="text-sm text-slate-400">Одоогоор сануулга илгээгдээгүй байна.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-slate-400 font-bold">
                  <th className="py-2 pr-4">Огноо</th>
                  <th className="py-2 pr-4">Төрөл</th>
                  <th className="py-2 pr-4">Харилцагч</th>
                  <th className="py-2 pr-4">Суваг</th>
                  <th className="py-2 pr-4">Төлөв</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="py-2 pr-4 whitespace-nowrap text-slate-500">{new Date(log.created_at).toLocaleString()}</td>
                    <td className="py-2 pr-4 whitespace-nowrap font-semibold">
                      {log.kind === 'reservation' ? 'Цаг захиалга' : 'Дахин урих'}
                    </td>
                    <td className="py-2 pr-4 font-semibold">{log.customer_name || '—'}</td>
                    <td className="py-2 pr-4 whitespace-nowrap text-slate-500">
                      {log.channel ? `${log.channel === 'sms' ? 'SMS' : 'Имэйл'} · ${log.recipient}` : '—'}
                    </td>
                    <td className="py-2 pr-4">
                      <span
                        title={log.error ?? undefined}
                        className={`px-2 py-0.5 rounded-full font-bold whitespace-nowrap ${STATUS_STYLE[log.status].className}`}
                      >
                        {STATUS_STYLE[log.status].label}
                      </span>
                      {log.error && <span className="block text-[11px] text-slate-400 mt-1">{log.error}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function ReminderCard({
  icon,
  title,
  description,
  enabled,
  onToggle,
  template,
  onTemplate,
  placeholders,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  enabled: boolean;
  onToggle: (value: boolean) => void;
  template: string;
  onTemplate: (value: string) => void;
  placeholders: string[];
  children?: React.ReactNode;
}) {
  return (
    <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl border border-slate-100 dark:border-slate-800 space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex gap-3">
          <div className="w-11 h-11 rounded-2xl bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
            {icon}
          </div>
          <div>
            <h2 className="font-extrabold text-slate-900 dark:text-white">{title}</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{description}</p>
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label={title}
          onClick={() => onToggle(!enabled)}
          className={`relative w-12 h-7 rounded-full transition-colors shrink-0 cursor-pointer ${enabled ? 'bg-red-600' : 'bg-slate-300 dark:bg-slate-700'}`}
        >
          <span className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full shadow transition-transform ${enabled ? 'translate-x-5' : ''}`} />
        </button>
      </div>

      <div className={`space-y-4 ${enabled ? '' : 'opacity-50'}`}>
        {children}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">Мессеж</label>
          <textarea
            rows={3}
            maxLength={TEMPLATE_MAX_LENGTH}
            value={template}
            onChange={(e) => onTemplate(e.target.value)}
            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm leading-relaxed focus:outline-none focus:border-red-600"
          />
          <div className="flex flex-wrap gap-1.5 mt-2">
            {TEMPLATE_PLACEHOLDERS.filter((p) => placeholders.includes(p.key)).map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => onTemplate(`${template}{${p.key}}`)}
                title={p.label}
                className="text-[11px] font-bold px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-red-50 hover:text-red-600 cursor-pointer"
              >
                {`{${p.key}}`} {p.label}
              </button>
            ))}
          </div>
        </div>
        <div className="bg-red-50/60 dark:bg-red-950/30 border border-red-100 dark:border-red-900/60 rounded-2xl px-4 py-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-red-600 dark:text-red-400 mb-1">Жишээ</p>
          <p className="text-sm text-slate-700 dark:text-slate-200">{renderReminderTemplate(template, SAMPLE_VALUES)}</p>
        </div>
      </div>
    </div>
  );
}
