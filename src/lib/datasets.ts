import 'server-only';
import { pool } from './db';

// "Өгөгдөл" хуудсаар экспортлох боломжтой өгөгдлийн багцууд.
// Query бүр $1 = company_id-аар шүүгддэг тул өөр компанийн өгөгдөл орохгүй.

export interface DatasetColumn {
  key: string;
  label: string;
  values?: Record<string, string>; // DB утгыг монгол нэр рүү хөрвүүлэх
}

export interface DatasetTable {
  columns: DatasetColumn[];
  rows: string[][];
}

interface DatasetDefinition {
  key: string;
  label: string;
  description: string;
  // Нийт мөрийн тоо болон хамгийн сүүлд нэмэгдсэн огноо
  summaryQuery: string;
  load: (companyId: string) => Promise<DatasetTable>;
}

const STATUS_LABELS: Record<string, string> = {
  active: 'Идэвхтэй',
  inactive: 'Идэвхгүй',
};

const WORK_STATUS_LABELS: Record<string, string> = {
  pending: 'Хүлээгдэж буй',
  in_progress: 'Хийгдэж байна',
  completed: 'Дууссан',
  cancelled: 'Цуцлагдсан',
};

const PRIORITY_LABELS: Record<string, string> = {
  low: 'Бага',
  medium: 'Дунд',
  high: 'Өндөр',
};

const BOOLEAN_LABELS: Record<string, string> = {
  true: 'Тийм',
  false: 'Үгүй',
};

function formatValue(value: unknown, column?: DatasetColumn): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) {
    // "2026-09-27 11:14" хэлбэрээр Улаанбаатарын цагаар
    return value
      .toLocaleString('sv-SE', { timeZone: 'Asia/Ulaanbaatar' })
      .slice(0, 16);
  }
  const text = String(value);
  return column?.values?.[text] ?? text;
}

// Энгийн SQL-ээс баганын жагсаалтын дагуу хүснэгт үүсгэх
function fromQuery(sql: string, columns: DatasetColumn[]) {
  return async (companyId: string): Promise<DatasetTable> => {
    const { rows } = await pool.query(sql, [companyId]);
    return {
      columns,
      rows: rows.map((row) => columns.map((col) => formatValue(row[col.key], col))),
    };
  };
}

// Анкетын хариулт бүр тусдаа мөр болж хадгалагддаг тул
// нэг илгээлтийг нэг мөр, асуулт бүрийг нэг багана болгож эргүүлнэ.
async function loadSubmissions(companyId: string): Promise<DatasetTable> {
  const { rows } = await pool.query(
    `
      SELECT s.id, s.submitted_at, t.title AS template_title, t.questions,
             a.question_id, a.question_label, a.answer_value
      FROM form_submissions s
      LEFT JOIN mt_templates t ON t.id = s.form_template_id
      LEFT JOIN form_submission_answers a ON a.submission_id = s.id
      WHERE s.company_id = $1
      ORDER BY s.submitted_at DESC, a.question_label
    `,
    [companyId]
  );

  const questionLabels: string[] = [];
  const questionOrder = new Map<string, number>(); // асуултын дараалал анкетын загвараас
  const submissions = new Map<string, { submittedAt: Date; title: string; answers: Map<string, string> }>();

  for (const row of rows) {
    if (row.question_label && !questionOrder.has(row.question_label) && Array.isArray(row.questions)) {
      const index = row.questions.findIndex((q: { id?: unknown }) => String(q.id) === row.question_id);
      if (index >= 0) questionOrder.set(row.question_label, index);
    }

    let submission = submissions.get(row.id);
    if (!submission) {
      submission = { submittedAt: row.submitted_at, title: row.template_title ?? '', answers: new Map() };
      submissions.set(row.id, submission);
    }
    if (row.question_label) {
      if (!questionLabels.includes(row.question_label)) questionLabels.push(row.question_label);
      submission.answers.set(row.question_label, row.answer_value ?? '');
    }
  }

  // Загварт байхгүй (устгагдсан) асуултууд төгсгөлд орно
  const orderOf = (label: string) => questionOrder.get(label) ?? Number.MAX_SAFE_INTEGER;
  questionLabels.sort((a, b) => orderOf(a) - orderOf(b));

  const columns: DatasetColumn[] = [
    { key: 'submitted_at', label: 'Илгээсэн огноо' },
    { key: 'template_title', label: 'Анкет' },
    ...questionLabels.map((label) => ({ key: `q:${label}`, label })),
  ];

  return {
    columns,
    rows: [...submissions.values()].map((s) => [
      formatValue(s.submittedAt),
      s.title,
      ...questionLabels.map((label) => s.answers.get(label) ?? ''),
    ]),
  };
}

const DATASETS: DatasetDefinition[] = [
  {
    key: 'customers',
    label: 'Харилцагч (хувь хүн)',
    description: 'Хувь хүн харилцагчдын холбоо барих мэдээлэл',
    summaryQuery: 'SELECT COUNT(*)::int AS count, MAX(create_date) AS last_updated FROM mt_customer WHERE company_id = $1',
    load: fromQuery(
      `SELECT last_name, first_name, male, to_char(birth_date, 'YYYY-MM-DD') AS birth_date, email, phone, address, status, create_date
       FROM mt_customer WHERE company_id = $1 ORDER BY create_date DESC`,
      [
        { key: 'last_name', label: 'Овог' },
        { key: 'first_name', label: 'Нэр' },
        { key: 'male', label: 'Хүйс' },
        { key: 'birth_date', label: 'Төрсөн огноо' },
        { key: 'email', label: 'Имэйл' },
        { key: 'phone', label: 'Утас' },
        { key: 'address', label: 'Хаяг' },
        { key: 'status', label: 'Төлөв', values: STATUS_LABELS },
        { key: 'create_date', label: 'Бүртгэсэн огноо' },
      ]
    ),
  },
  {
    key: 'customer-companies',
    label: 'Харилцагч (байгууллага)',
    description: 'Байгууллага харилцагчид, регистрийн дугаартай',
    summaryQuery: 'SELECT COUNT(*)::int AS count, MAX(create_date) AS last_updated FROM mt_customercompany WHERE company_id = $1',
    load: fromQuery(
      `SELECT name, tax_number, email, phone, address, status, create_date
       FROM mt_customercompany WHERE company_id = $1 ORDER BY create_date DESC`,
      [
        { key: 'name', label: 'Байгууллагын нэр' },
        { key: 'tax_number', label: 'Регистр' },
        { key: 'email', label: 'Имэйл' },
        { key: 'phone', label: 'Утас' },
        { key: 'address', label: 'Хаяг' },
        { key: 'status', label: 'Төлөв', values: STATUS_LABELS },
        { key: 'create_date', label: 'Бүртгэсэн огноо' },
      ]
    ),
  },
  {
    key: 'works',
    label: 'Ажил',
    description: 'Бүртгэгдсэн ажлууд, харилцагч болон хариуцсан ажилтны хамт',
    summaryQuery: 'SELECT COUNT(*)::int AS count, MAX(create_date) AS last_updated FROM mt_works WHERE company_id = $1',
    load: fromQuery(
      `SELECT
         w.title,
         CASE
           WHEN w.customer_type = 'individual' THEN TRIM(CONCAT(c.last_name, ' ', c.first_name))
           WHEN w.customer_type = 'company' THEN cc.name
         END AS customer_name,
         (SELECT string_agg(ws.service_name, ', ' ORDER BY ws.sort_order)
          FROM mt_work_services ws WHERE ws.work_id = w.work_id) AS service_name,
         TRIM(CONCAT(u.last_name, ' ', u.first_name)) AS employee_name,
         w.price, w.status, w.priority, w.due_date, w.description, w.create_date
       FROM mt_works w
       LEFT JOIN mt_customer c ON w.customer_id = c.customer_id
       LEFT JOIN mt_customercompany cc ON w.company_customer_id = cc.company_customer_id
       LEFT JOIN mt_user u ON w.assigned_employee = u.user_id
       WHERE w.company_id = $1
       ORDER BY w.create_date DESC`,
      [
        { key: 'title', label: 'Гарчиг' },
        { key: 'customer_name', label: 'Харилцагч' },
        { key: 'service_name', label: 'Үйлчилгээ' },
        { key: 'employee_name', label: 'Хариуцсан ажилтан' },
        { key: 'price', label: 'Үнэ' },
        { key: 'status', label: 'Төлөв', values: WORK_STATUS_LABELS },
        { key: 'priority', label: 'Зэрэглэл', values: PRIORITY_LABELS },
        { key: 'due_date', label: 'Дуусах огноо' },
        { key: 'description', label: 'Тайлбар' },
        { key: 'create_date', label: 'Бүртгэсэн огноо' },
      ]
    ),
  },
  {
    key: 'services',
    label: 'Үйлчилгээ',
    description: 'Үйлчилгээний жагсаалт, үнэ болон хугацаа',
    summaryQuery: 'SELECT COUNT(*)::int AS count, MAX(created_at) AS last_updated FROM mt_services WHERE company_id = $1',
    load: fromQuery(
      `SELECT name, category, price, duration, description, status, created_at
       FROM mt_services WHERE company_id = $1 ORDER BY created_at DESC`,
      [
        { key: 'name', label: 'Нэр' },
        { key: 'category', label: 'Ангилал' },
        { key: 'price', label: 'Үнэ' },
        { key: 'duration', label: 'Хугацаа (мин)' },
        { key: 'description', label: 'Тайлбар' },
        { key: 'status', label: 'Төлөв', values: STATUS_LABELS },
        { key: 'created_at', label: 'Бүртгэсэн огноо' },
      ]
    ),
  },
  {
    key: 'employees',
    label: 'Ажилчид',
    description: 'Компанийн ажилчид, эрх болон албан тушаал',
    summaryQuery: 'SELECT COUNT(*)::int AS count, MAX(create_date) AS last_updated FROM mt_user WHERE company_id = $1',
    load: fromQuery(
      `SELECT last_name, first_name, email, phone, role, position, is_active, create_date
       FROM mt_user WHERE company_id = $1 ORDER BY create_date DESC`,
      [
        { key: 'last_name', label: 'Овог' },
        { key: 'first_name', label: 'Нэр' },
        { key: 'email', label: 'Имэйл' },
        { key: 'phone', label: 'Утас' },
        { key: 'role', label: 'Эрх' },
        { key: 'position', label: 'Албан тушаал' },
        { key: 'is_active', label: 'Идэвхтэй', values: BOOLEAN_LABELS },
        { key: 'create_date', label: 'Бүртгэсэн огноо' },
      ]
    ),
  },
  {
    key: 'submissions',
    label: 'Анкетын хариулт',
    description: 'Нийтийн анкетаар ирсэн хариултууд, асуулт бүр тусдаа багана',
    summaryQuery: 'SELECT COUNT(*)::int AS count, MAX(submitted_at) AS last_updated FROM form_submissions WHERE company_id = $1',
    load: loadSubmissions,
  },
];

export function getDataset(key: string) {
  return DATASETS.find((d) => d.key === key);
}

export async function getDatasetSummaries(companyId: string) {
  return Promise.all(
    DATASETS.map(async (d) => {
      const { rows } = await pool.query(d.summaryQuery, [companyId]);
      return {
        key: d.key,
        label: d.label,
        description: d.description,
        count: rows[0]?.count ?? 0,
        lastUpdated: rows[0]?.last_updated ? formatValue(rows[0].last_updated) : null,
      };
    })
  );
}

// Excel "=", "+", "-", "@"-ээр эхэлсэн утгыг томьёо гэж ажиллуулдаг тул
// (анкетын хариулт гаднаас ирдэг) эхэнд нь ' нэмж текст болгоно.
// Утасны дугаар, сөрөг тоо зэрэг зөвхөн цифртэй утгыг хэвээр үлдээнэ.
function csvCell(value: string) {
  const isFormula = /^[=+\-@\t\r]/.test(value) && !/^[+-]?[\d\s().-]+$/.test(value);
  const safe = isFormula ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCsv(table: DatasetTable) {
  const lines = [
    table.columns.map((c) => csvCell(c.label)).join(','),
    ...table.rows.map((row) => row.map(csvCell).join(',')),
  ];
  // BOM нь Excel-д кирилл үсгийг зөв (UTF-8) уншуулна
  return '﻿' + lines.join('\r\n');
}
