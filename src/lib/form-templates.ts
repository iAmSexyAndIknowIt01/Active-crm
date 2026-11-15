import { isCustomerField } from './form-customer';

// QR анкетын загвар (mt_templates). Клиент (засварлагч) болон сервер (API) хоёуланд ашиглагдана.

export const QUESTION_TYPES = ['text', 'number', 'select'] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

export interface TemplateQuestion {
  id: string;
  label: string;
  type: QuestionType;
  required: boolean;
  options?: string[];
  // Хариултыг харилцагчийн аль талбарт хадгалах ('' = холбохгүй)
  maps_to?: string;
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
    { id: '1', label: 'Овог, Нэр', type: 'text', required: true, maps_to: 'full_name' },
    { id: '2', label: 'Утасны дугаар', type: 'number', required: true, maps_to: 'phone' },
    { id: '3', label: 'Имэйл хаяг', type: 'text', required: false, maps_to: 'email' },
    {
      id: '4',
      label: 'Үйлчилгээний төрөл',
      type: 'select',
      required: true,
      maps_to: '',
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
      maps_to: isCustomerField(q.maps_to) ? q.maps_to : '',
    };

    if (type === 'select') {
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
