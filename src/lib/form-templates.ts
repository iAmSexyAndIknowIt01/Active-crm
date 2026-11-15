// QR анкетын загвар (mt_templates). Клиент (засварлагч) болон сервер (API) хоёуланд ашиглагдана.

export const QUESTION_TYPES = ['text', 'textarea', 'number', 'select', 'multiselect', 'rating'] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

// Засварлагчид харагдах хариултын төрлийн нэр, тайлбар
export const QUESTION_TYPE_INFO: Record<QuestionType, { label: string; hint: string }> = {
  text: { label: 'Богино хариулт', hint: 'Нэг мөр текст (нэр, утас, имэйл г.м.)' },
  textarea: { label: 'Урт хариулт', hint: 'Санал, тайлбар зэрэг хэдэн өгүүлбэр' },
  number: { label: 'Тоо', hint: 'Зөвхөн тоо' },
  select: { label: 'Нэг сонголт', hint: 'Жагсаалтаас нэгийг сонгоно' },
  multiselect: { label: 'Олон сонголт', hint: 'Жагсаалтаас хэд хэдийг сонгож болно' },
  rating: { label: 'Үнэлгээ', hint: 'Сонголтууд нэг мөрөнд оноо мэт (1–5 г.м.)' },
};

export const hasOptions = (type: QuestionType) => type === 'select' || type === 'multiselect' || type === 'rating';

// "1 - Маш муу", "2", ... "5 - Маш сайн" хэлбэрийн сонголт: тоо ба (байвал) тайлбар
const SCALE_OPTION = /^(\d{1,2})(?:\s*[-–—.:)]\s*(.*))?$/;
export function parseScaleOption(option: string): { number: string; caption: string } | null {
  const m = option.match(SCALE_OPTION);
  return m ? { number: m[1], caption: m[2]?.trim() ?? '' } : null;
}

// "Нэг сонголт" асуултын сонголтууд оноо мэт эсэх: тоотой сонголтууд 0 эсвэл 1-ээс эхэлж дараалсан
// (1, 2, 3, 4, 5 эсвэл 0…10), дор хаяж 3. "1–3 жил", "10–49" зэрэг хүрээг оноо гэж үзэхгүй.
// Засварлагч "Үнэлгээ" төрөл болгохыг санал болгоход ашиглана (харагдах байдлыг өөрөө өөрчлөхгүй).
export function looksLikeRating(options: string[] | undefined) {
  const numbers = (options ?? []).map((o) => parseScaleOption(o)?.number).filter((n): n is string => n !== undefined).map(Number);
  if (numbers.length < 3 || numbers[0] > 1) return false;
  return numbers.every((n, i) => n === numbers[0] + i);
}

// Олон сонголттой хариултыг нэг текст болгож хадгалах тусгаарлагч.
// Сонголтын текстэд таслал байж болох тул ("Агуулах, бараа материал") "; " ашиглана.
export const MULTI_ANSWER_SEPARATOR = '; ';
export const splitMultiAnswer = (value: string) =>
  value
    .split(MULTI_ANSWER_SEPARATOR)
    .map((v) => v.trim())
    .filter(Boolean);

export interface TemplateQuestion {
  id: string;
  label: string;
  type: QuestionType;
  required: boolean;
  options?: string[];
}

export interface TemplateInput {
  title: string;
  description: string | null;
  questions: TemplateQuestion[];
}

export const MAX_QUESTIONS = 100;
const MAX_OPTIONS = 50;

// Шинэ анкетын анхны агуулга
export const DEFAULT_TEMPLATE: TemplateInput = {
  title: 'Үйлчлүүлэгчийн бүртгэлийн анкет',
  description: 'Та манай үйлчилгээг сонгосонд баярлалаа. Доорх мэдээллийг үнэн зөв бөглөнө үү.',
  questions: [
    { id: '1', label: 'Овог, Нэр', type: 'text', required: true },
    { id: '2', label: 'Утасны дугаар', type: 'text', required: true },
    { id: '3', label: 'Имэйл хаяг', type: 'text', required: false },
    {
      id: '4',
      label: 'Үйлчилгээний төрөл',
      type: 'select',
      required: true,
      options: ['Авто угаалга', 'Тос солих', 'Засвар үйлчилгээ', 'Бусад'],
    },
  ],
};

// Хүсэлтийн анкетын агуулгыг шалгаж цэвэрлэнэ. Алдаатай бол { error }, зөв бол { value }.
export type ParsedTemplate = { ok: true; value: TemplateInput } | { ok: false; error: string };

export function parseTemplateInput(body: unknown): ParsedTemplate {
  const input = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>;

  const title = typeof input.title === 'string' ? input.title.trim() : '';
  if (!title) return { ok: false, error: 'Анкетын гарчиг заавал шаардлагатай.' };

  const description = typeof input.description === 'string' ? input.description.trim().slice(0, 2000) || null : null;

  if (!Array.isArray(input.questions)) return { ok: false, error: 'Асуултын жагсаалт буруу байна.' };
  if (input.questions.length === 0) return { ok: false, error: 'Анкетад дор хаяж нэг асуулт нэмнэ үү.' };
  if (input.questions.length > MAX_QUESTIONS) {
    return { ok: false, error: `Анкетад хамгийн ихдээ ${MAX_QUESTIONS} асуулт байна.` };
  }

  const ids = new Set<string>();
  const questions: TemplateQuestion[] = [];
  for (const [index, raw] of input.questions.entries()) {
    const q = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
    const position = index + 1;

    const id = typeof q.id === 'string' || typeof q.id === 'number' ? String(q.id).slice(0, 100) : '';
    if (!id || ids.has(id)) return { ok: false, error: `${position}-р асуултын ID буруу байна.` };
    ids.add(id);

    const label = typeof q.label === 'string' ? q.label.trim().slice(0, 300) : '';
    if (!label) return { ok: false, error: `${position}-р асуултын нэрийг бөглөнө үү.` };

    const type = (QUESTION_TYPES as readonly string[]).includes(q.type as string) ? (q.type as QuestionType) : 'text';
    const question: TemplateQuestion = {
      id,
      label,
      type,
      required: q.required === true,
    };

    if (hasOptions(type)) {
      const options = Array.isArray(q.options)
        ? [...new Set(q.options.filter((o): o is string => typeof o === 'string').map((o) => o.trim().slice(0, 200)).filter(Boolean))]
        : [];
      if (options.length === 0) return { ok: false, error: `"${label}" асуултад дор хаяж нэг сонголт оруулна уу.` };
      question.options = options.slice(0, MAX_OPTIONS);
    }

    questions.push(question);
  }

  return { ok: true, value: { title: title.slice(0, 200), description, questions } };
}
