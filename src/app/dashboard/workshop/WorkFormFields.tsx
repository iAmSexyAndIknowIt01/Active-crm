'use client';

import { useMemo, type Dispatch, type SetStateAction } from 'react';
import { Trash2, Briefcase } from 'lucide-react';
import SearchSelect from '@/src/app/components/SearchSelect';
import InfoTip from '@/src/app/components/InfoTip';
import Tooltip from '@/src/app/components/Tooltip';
import { FieldError, invalidClass } from '@/src/app/components/FormValidation';

// Ажлын нэг үйлчилгээний мөр. service_id хоосон бол каталогоос устсан үйлчилгээ (хадгалсан нэрээр үлдэнэ).
export interface WorkServiceFormLine {
  service_id: string;
  service_name: string;
  price: string;
  quantity: string;
}

export interface WorkFormData {
  title: string;
  customer_type: 'individual' | 'company';
  customer_id: string;
  services: WorkServiceFormLine[];
  assigned_employee: string;
  price: string;
  status: string;
  priority: string;
  due_date: string;
  description: string;
}

export interface WorkOptionData {
  individuals: { id: string; first_name: string; last_name: string; phone: string }[];
  companies: { id: string; name: string; tax_number: string; phone: string }[];
  services: { service_id: number; name: string; price: number; duration: number }[];
  employees: { user_id: string; first_name: string; last_name: string; email: string }[];
}

// API-аас ирсэн ажлын services массивыг формын мөр болгох
export const toServiceFormLines = (
  services: { service_id: number | null; service_name: string; price: number | string; quantity: number }[] | null | undefined
): WorkServiceFormLine[] =>
  (services ?? []).map((s) => ({
    service_id: s.service_id ? String(s.service_id) : '',
    service_name: s.service_name,
    price: String(Number(s.price)),
    quantity: String(s.quantity),
  }));

export const lineTotal = (line: WorkServiceFormLine) => (Number(line.price) || 0) * (Number(line.quantity) || 0);

export const emptyWorkForm = (): WorkFormData => ({
  title: '',
  customer_type: 'individual',
  customer_id: '',
  services: [],
  assigned_employee: '',
  price: '',
  status: 'pending',
  priority: 'medium',
  due_date: '',
  description: '',
});

const labelClass = 'block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1';
const inputClass =
  'w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-xs font-bold text-slate-800 dark:text-slate-100 outline-none focus:border-red-500 dark:focus:border-red-400';
const selectClass =
  'w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-100 outline-none focus:border-red-500 dark:focus:border-red-400 bg-white dark:bg-slate-900 cursor-pointer';

// Ажил нэмэх (modal) болон засах (дэлгэрэнгүй хуудас) формын нийтлэг талбарууд.
// Хоёр газар ижил талбартай байх ёстой тул энд нэг л удаа тодорхойлно.
// Багануудыг container query-ээр тооцдог тул нарийн modal дотор ч, өргөн хуудсан дээр ч зөв харагдана.
export default function WorkFormFields({
  formData,
  setFormData,
  options,
  errors = {},
  lockAssignee = false,
}: {
  formData: WorkFormData;
  setFormData: Dispatch<SetStateAction<WorkFormData>>;
  options: WorkOptionData;
  // useFormValidation-ийн алдаанууд (талбарын name-ээр)
  errors?: Record<string, string>;
  // Хариуцсан ажилтныг солихыг хориглох (ажилтан өөрийн ажлыг засах үед; зөвхөн админ солино)
  lockAssignee?: boolean;
}) {
  // Хуучин бүтэцтэй state (жишээ нь dev-ийн Fast Refresh-ээс үлдсэн) ирсэн ч унахгүй
  const services = useMemo(() => formData.services ?? [], [formData.services]);

  const customerOptions = useMemo(
    () =>
      formData.customer_type === 'individual'
        ? options.individuals.map((ind) => ({
            value: String(ind.id),
            label: `${ind.last_name ?? ''} ${ind.first_name ?? ''}`.trim(),
            sub: ind.phone || 'Утасгүй',
          }))
        : options.companies.map((comp) => ({
            value: String(comp.id),
            label: comp.name,
            sub: `Регистр: ${comp.tax_number}${comp.phone ? ` · ${comp.phone}` : ''}`,
          })),
    [formData.customer_type, options.individuals, options.companies]
  );

  const serviceOptions = useMemo(
    () =>
      options.services
        // Аль хэдийн нэмсэн үйлчилгээг сонголтоос хасна
        .filter((ser) => !services.some((line) => line.service_id === String(ser.service_id)))
        .map((ser) => ({
        value: String(ser.service_id),
        label: ser.name,
        sub: `${Number(ser.price).toLocaleString()} ₮${ser.duration ? ` · ${ser.duration} мин` : ''}`,
      })),
    [options.services, services]
  );

  const employeeOptions = useMemo(
    () =>
      options.employees.map((emp) => ({
        value: String(emp.user_id),
        label: `${emp.last_name ?? ''} ${emp.first_name ?? ''}`.trim(),
        sub: emp.email,
      })),
    [options.employees]
  );

  const withError = (base: string, name: string) => (errors[name] ? `${base} ${invalidClass}` : base);

  const update = (patch: Partial<WorkFormData>) => setFormData((prev) => ({ ...prev, ...patch }));

  const hasServices = services.length > 0;
  const servicesTotal = services.reduce((sum, line) => sum + lineTotal(line), 0);

  const addService = (serviceId: string) => {
    const service = options.services.find((s) => String(s.service_id) === serviceId);
    if (!service) return;
    setFormData((prev) => ({
      ...prev,
      services: [
        ...(prev.services ?? []),
        { service_id: serviceId, service_name: service.name, price: String(Number(service.price) || 0), quantity: '1' },
      ],
    }));
  };

  const updateLine = (index: number, patch: Partial<WorkServiceFormLine>) =>
    setFormData((prev) => ({
      ...prev,
      services: (prev.services ?? []).map((line, i) => (i === index ? { ...line, ...patch } : line)),
    }));

  const removeLine = (index: number) =>
    setFormData((prev) => ({ ...prev, services: (prev.services ?? []).filter((_, i) => i !== index) }));

  return (
    <div className="@container space-y-4">
      <div>
        <label className={labelClass}>Ажлын нэр / Гарчиг *</label>
        <input
          type="text"
          name="title"
          required
          placeholder="Жишээ: Засварын ажил..."
          value={formData.title}
          onChange={(e) => update({ title: e.target.value })}
          className={withError(inputClass, 'title')}
          aria-invalid={!!errors.title || undefined}
        />
        <FieldError message={errors.title} />
      </div>

      <div className="grid grid-cols-1 @sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Харилцагчийн төрөл *</label>
          <select
            value={formData.customer_type}
            onChange={(e) => update({ customer_type: e.target.value as WorkFormData['customer_type'], customer_id: '' })}
            className={selectClass}
          >
            <option value="individual">Хувь хүн</option>
            <option value="company">Компани</option>
          </select>
        </div>

        <div>
          <label className={labelClass}>Харилцагч *</label>
          <SearchSelect
            key={formData.customer_type}
            required
            requiredMessage="Харилцагчаа сонгоно уу."
            name="customer_id"
            invalid={!!errors.customer_id}
            options={customerOptions}
            value={formData.customer_id}
            onChange={(id) => update({ customer_id: id })}
            placeholder={formData.customer_type === 'individual' ? 'Нэр эсвэл утсаар хайх...' : 'Нэр, регистр эсвэл утсаар хайх...'}
            emptyText="Харилцагч олдсонгүй"
            aria-label="Харилцагч"
          />
          <FieldError message={errors.customer_id} />
        </div>
      </div>

      <div className="grid grid-cols-1 @sm:grid-cols-2 gap-4">
        <fieldset disabled={lockAssignee} className={`min-w-0 ${lockAssignee ? 'opacity-70' : ''}`}>
          <label className={labelClass}>Хариуцсан ажилтан *</label>
          <SearchSelect
            required
            requiredMessage="Хариуцсан ажилтнаа сонгоно уу."
            name="assigned_employee"
            invalid={!!errors.assigned_employee}
            options={employeeOptions}
            value={formData.assigned_employee}
            onChange={(id) => update({ assigned_employee: id })}
            placeholder="Ажилтан хайх..."
            emptyText="Ажилтан олдсонгүй"
            aria-label="Хариуцсан ажилтан"
          />
          <FieldError message={errors.assigned_employee} />
        </fieldset>

        <div>
          <label className={labelClass}>Дуусах хугацаа</label>
          <input
            type="date"
            value={formData.due_date}
            onChange={(e) => update({ due_date: e.target.value })}
            className={inputClass}
          />
        </div>
      </div>

      {/* Үйлчилгээнүүд — нэг ажилд олон үйлчилгээ */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className={labelClass}>Үйлчилгээнүүд *</label>
          {hasServices && <span className="text-[11px] font-bold text-slate-400">{services.length} үйлчилгээ</span>}
        </div>

        {hasServices && (
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-800">
            <div className="hidden @md:grid grid-cols-[1fr_4.5rem_7.5rem_6.5rem_2rem] gap-2 px-3 py-2 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
              <span>Үйлчилгээ</span>
              <span>Тоо</span>
              <span className="inline-flex items-center gap-1">Нэгж үнэ (₮) <InfoTip size={11} text="Үйлчилгээ нэмэхэд каталогийн үнэ автоматаар бөглөгдөнө. Энэ ажилд зориулж өөрчилж болно, каталог өөрчлөгдөхгүй." /></span>
              <span className="text-right inline-flex items-center justify-end gap-1">Дүн <InfoTip size={11} text="Тоо × нэгж үнэ" /></span>
              <span />
            </div>
            {services.map((line, i) => (
              <div
                key={`${line.service_id || line.service_name}-${i}`}
                className="grid grid-cols-[1fr_2rem] @md:grid-cols-[1fr_4.5rem_7.5rem_6.5rem_2rem] items-center gap-2 px-3 py-2"
              >
                <div className="min-w-0 flex items-center gap-2">
                  <Briefcase size={13} className="text-slate-400 shrink-0" />
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">{line.service_name}</span>
                  {!line.service_id && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 shrink-0">устсан</span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => removeLine(i)}
                  className="@md:order-last p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer justify-self-end"
                  aria-label={`${line.service_name} хасах`}
                >
                  <Trash2 size={14} />
                </button>
                {/* Нарийн дэлгэцэнд тоо, үнэ, дүн доод мөрөнд; өргөн дэлгэцэнд нэг мөрөнд */}
                <div className="col-span-2 @md:col-span-1 grid grid-cols-[4.5rem_1fr_auto] @md:contents gap-2 items-center">
                  <input
                    type="number"
                    min={1}
                    step={1}
                    required
                    name={`services.${i}.quantity`}
                    value={line.quantity}
                    onChange={(e) => updateLine(i, { quantity: e.target.value })}
                    className={withError(`${inputClass} py-2!`, `services.${i}.quantity`)}
                    aria-label="Тоо ширхэг"
                  />
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    required
                    name={`services.${i}.price`}
                    value={line.price}
                    onChange={(e) => updateLine(i, { price: e.target.value })}
                    className={withError(`${inputClass} py-2!`, `services.${i}.price`)}
                    aria-label="Нэгж үнэ"
                  />
                  <Tooltip text={`${Number(line.quantity) || 0} × ${(Number(line.price) || 0).toLocaleString()} ₮`} className="justify-end">
                    <span className="text-xs font-black text-slate-900 dark:text-white text-right tabular-nums whitespace-nowrap">
                      {lineTotal(line).toLocaleString()} ₮
                    </span>
                  </Tooltip>
                </div>
                {(errors[`services.${i}.quantity`] || errors[`services.${i}.price`]) && (
                  <div className="col-span-full -mt-1">
                    <FieldError message={errors[`services.${i}.quantity`] ?? errors[`services.${i}.price`]} />
                  </div>
                )}
              </div>
            ))}
            <div className="flex items-center justify-between px-3 py-2.5 bg-slate-50/70 dark:bg-slate-800/40 rounded-b-xl">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 inline-flex items-center gap-1">
                Нийт <InfoTip size={12} text="Бүх мөрийн дүнгийн нийлбэр (тоо × нэгж үнэ). Энэ нь ажлын нийт үнэ болж хадгалагдана." />
              </span>
              <span className="text-sm font-black text-red-600 dark:text-red-400 tabular-nums">{servicesTotal.toLocaleString()} ₮</span>
            </div>
          </div>
        )}

        <SearchSelect
          options={serviceOptions}
          value=""
          onChange={addService}
          required={!hasServices}
          requiredMessage="Дор хаяж нэг үйлчилгээ сонгоно уу."
          name="services"
          invalid={!hasServices && !!errors.services}
          clearable={false}
          placeholder={hasServices ? 'Өөр үйлчилгээ нэмэх...' : 'Үйлчилгээ хайж нэмэх...'}
          emptyText={options.services.length > 0 && serviceOptions.length === 0 ? 'Бүх үйлчилгээг нэмсэн байна' : 'Үйлчилгээ олдсонгүй'}
          aria-label="Үйлчилгээ нэмэх"
        />
        {/* Үйлчилгээ нэмэгдмэгц нуугдмал талбар алга болдог тул алдааг энд шүүнэ */}
        {!hasServices && <FieldError message={errors.services} />}
      </div>

      <div className="grid grid-cols-1 @sm:grid-cols-3 gap-4">
        <div>
          <label className={`${labelClass} flex items-center gap-1`}>
            Төлөв
            <InfoTip size={12} text="Хүлээгдэж буй: эхлээгүй. Хийгдэж байна: ажиллаж байгаа. Дууссан: орлогод тооцогдоно. Цуцлагдсан: гүйцэтгэл, орлогын тооцоонд орохгүй." />
          </label>
          <select value={formData.status} onChange={(e) => update({ status: e.target.value })} className={selectClass}>
            <option value="pending">Хүлээгдэж буй</option>
            <option value="in_progress">Хийгдэж байна</option>
            <option value="completed">Дууссан</option>
            <option value="cancelled">Цуцлагдсан</option>
          </select>
        </div>

        <div>
          <label className={`${labelClass} flex items-center gap-1`}>
            Зэрэглэл
            <InfoTip size={12} text="Ажлын яаралтай байдал. Жагсаалтыг зэрэглэлээр шүүж, эрэмбэлэхэд ашиглана. Тооцоонд нөлөөлөхгүй." />
          </label>
          <select value={formData.priority} onChange={(e) => update({ priority: e.target.value })} className={selectClass}>
            <option value="low">Энгийн</option>
            <option value="medium">Дунд</option>
            <option value="high">Яаралтай</option>
          </select>
        </div>

        <div>
          <label className={`${labelClass} flex items-center gap-1`}>
            {hasServices ? 'Нийт үнэ (₮)' : 'Үнэ (₮)'}
            <InfoTip
              size={12}
              text={
                hasServices
                  ? 'Үйлчилгээнүүдийн дүнгээс автоматаар бодогдоно, гараар өөрчлөх боломжгүй. Ажил “Дууссан” төлөвт орвол энэ дүн орлогод тооцогдоно.'
                  : 'Ажлын үнэ. Ажил “Дууссан” төлөвт орвол энэ дүн орлогод тооцогдоно.'
              }
            />
          </label>
          {hasServices ? (
            <div
              className={`${inputClass} bg-slate-50! dark:bg-slate-800/60! text-slate-500! dark:text-slate-400! tabular-nums`}
              title="Үйлчилгээнүүдийн дүнгээс автоматаар бодогдоно"
            >
              {servicesTotal.toLocaleString()}
            </div>
          ) : (
            <input
              type="number"
              min={0}
              step="0.01"
              name="price"
              placeholder="Үнийн дүн..."
              value={formData.price}
              onChange={(e) => update({ price: e.target.value })}
              className={withError(inputClass, 'price')}
            />
          )}
          {!hasServices && <FieldError message={errors.price} />}
        </div>
      </div>

      <div>
        <label className={labelClass}>Тайлбар</label>
        <textarea
          rows={4}
          placeholder="Ажлын дэлгэрэнгүй мэдээлэл..."
          value={formData.description}
          onChange={(e) => update({ description: e.target.value })}
          className={`${inputClass} resize-none`}
        />
      </div>
    </div>
  );
}
