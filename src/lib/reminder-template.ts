// Сануулгын мессежийн загвар. Клиент (тохиргооны хуудас, урьдчилан харах) болон сервер хоёуланд ашиглагдана.

export const DEFAULT_RESERVATION_TEMPLATE =
  'Сайн байна уу, {name}! {company}-д маргааш {date} {time} цагт {service} захиалгатай байгааг сануулж байна. Асуух зүйл байвал {phone} дугаарт холбогдоорой.';

export const DEFAULT_FOLLOWUP_TEMPLATE =
  'Сайн байна уу, {name}! {company}-д сүүлд үйлчлүүлснээс хойш {days} хоног өнгөрлөө. Оочер үүсэхээс өмнө цагаа урьдчилан захиалаарай: {phone}.';

export const TEMPLATE_MAX_LENGTH = 500;

export const TEMPLATE_PLACEHOLDERS: { key: string; label: string }[] = [
  { key: 'name', label: 'Харилцагчийн нэр' },
  { key: 'company', label: 'Танай байгууллагын нэр' },
  { key: 'phone', label: 'Танай утас (Ерөнхий тохиргооноос)' },
  { key: 'date', label: 'Захиалгын огноо' },
  { key: 'time', label: 'Захиалгын цаг' },
  { key: 'service', label: 'Үйлчилгээ' },
  { key: 'days', label: 'Сүүлд үйлчлүүлснээс хойших хоног' },
];

// {name} гэх мэт орлуулагчийг утгаар солино. Утга байхгүй бол хоосон болгож, илүүдэл зайг цэвэрлэнэ.
export function renderReminderTemplate(template: string, values: Record<string, string | number | null | undefined>) {
  return template
    .replace(/\{(\w+)\}/g, (match, key: string) => {
      if (!(key in values)) return match;
      const value = values[key];
      return value === null || value === undefined ? '' : String(value);
    })
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\s+([,.!?])/g, '$1')
    .trim();
}
