// Ажлын жагсаалтын шүүлтүүрийг SQL нөхцөл болгоно (сервер талын хуудаслалт).
// Огноог Улаанбаатарын цагаар тооцно (аналитиктай ижил). Бүх утгыг параметрээр дамжуулна.

const TZ = 'Asia/Ulaanbaatar';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const WORK_STATUSES = ['pending', 'in_progress', 'completed', 'cancelled'];
export const WORK_PRIORITIES = ['low', 'medium', 'high'];
export const WORK_SORTS = ['newest', 'oldest', 'due', 'price_desc', 'price_asc'];

export interface WorkFilterParams {
  q?: string | null;
  status?: string | null;
  priority?: string | null;
  customerType?: string | null;
  employee?: string | null; // 'all' | 'none' | user_id
  service?: string | null;
  customer?: string | null; // 'i:<id>' | 'c:<id>'
  due?: string | null; // 'all' | 'overdue' | 'today' | 'week' | 'month' | 'none' | 'custom'
  dueFrom?: string | null;
  dueTo?: string | null;
  createdFrom?: string | null;
  createdTo?: string | null;
  priceMin?: string | null;
  priceMax?: string | null;
  sort?: string | null;
}

// Ажлын хүснэгтийн alias нь `w`, харилцагч `c`/`cc`, ажилтан `u` (workshop GET-ийн JOIN-той тохирно)
export const WORK_DUE_DAY = `(w.due_date AT TIME ZONE '${TZ}')::date`;
const TODAY = `(now() AT TIME ZONE '${TZ}')::date`;
const OPEN = `w.status NOT IN ('completed', 'cancelled')`;

export function buildWorkFilter(companyId: string, params: WorkFilterParams, firstParam = 1) {
  const conditions: string[] = ['w.company_id = $' + firstParam];
  const values: unknown[] = [companyId];
  const add = (value: unknown) => {
    values.push(value);
    return `$${firstParam + values.length - 1}`;
  };

  // Гарчиг, тайлбар, харилцагч, ажилтан, үйлчилгээний нэрээр — үг бүр тааралдах ёстой
  const words = (params.q ?? '').trim().split(/\s+/).filter(Boolean).slice(0, 8);
  if (words.length > 0) {
    const haystack = `concat_ws(' ', w.title, w.description,
      CASE WHEN w.customer_type = 'company' THEN cc.name ELSE concat_ws(' ', c.last_name, c.first_name) END,
      concat_ws(' ', u.last_name, u.first_name),
      (SELECT string_agg(ws.service_name, ' ') FROM mt_work_services ws WHERE ws.work_id = w.work_id))`;
    for (const word of words) {
      conditions.push(`${haystack} ILIKE ${add(`%${word.slice(0, 50).replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`)}`);
    }
  }

  if (params.status && WORK_STATUSES.includes(params.status)) conditions.push(`w.status = ${add(params.status)}`);
  if (params.priority && WORK_PRIORITIES.includes(params.priority)) conditions.push(`w.priority = ${add(params.priority)}`);
  if (params.customerType === 'individual' || params.customerType === 'company') {
    conditions.push(`w.customer_type = ${add(params.customerType)}`);
  }

  if (params.employee === 'none') conditions.push('w.assigned_employee IS NULL');
  else if (params.employee && UUID_RE.test(params.employee)) conditions.push(`w.assigned_employee::text = ${add(params.employee)}`);

  if (params.service && /^\d+$/.test(params.service)) {
    conditions.push(`EXISTS (SELECT 1 FROM mt_work_services ws WHERE ws.work_id = w.work_id AND ws.service_id = ${add(Number(params.service))})`);
  }

  const customer = /^([ic]):(.+)$/.exec(params.customer ?? '');
  if (customer && UUID_RE.test(customer[2])) {
    conditions.push(
      customer[1] === 'c'
        ? `w.customer_type = 'company' AND w.company_customer_id::text = ${add(customer[2])}`
        : `w.customer_type <> 'company' AND w.customer_id::text = ${add(customer[2])}`
    );
  }

  switch (params.due) {
    case 'overdue':
      conditions.push(`${WORK_DUE_DAY} < ${TODAY} AND ${OPEN}`);
      break;
    case 'today':
      conditions.push(`${WORK_DUE_DAY} = ${TODAY}`);
      break;
    case 'week': // Даваа – Ням
      conditions.push(`${WORK_DUE_DAY} BETWEEN date_trunc('week', ${TODAY})::date AND date_trunc('week', ${TODAY})::date + 6`);
      break;
    case 'month':
      conditions.push(`date_trunc('month', ${WORK_DUE_DAY}) = date_trunc('month', ${TODAY})`);
      break;
    case 'none':
      conditions.push('w.due_date IS NULL');
      break;
    case 'custom':
      if (params.dueFrom && DATE_RE.test(params.dueFrom)) conditions.push(`${WORK_DUE_DAY} >= ${add(params.dueFrom)}::date`);
      if (params.dueTo && DATE_RE.test(params.dueTo)) conditions.push(`${WORK_DUE_DAY} <= ${add(params.dueTo)}::date`);
      break;
  }

  const createdDay = `(w.create_date AT TIME ZONE '${TZ}')::date`;
  if (params.createdFrom && DATE_RE.test(params.createdFrom)) conditions.push(`${createdDay} >= ${add(params.createdFrom)}::date`);
  if (params.createdTo && DATE_RE.test(params.createdTo)) conditions.push(`${createdDay} <= ${add(params.createdTo)}::date`);

  const priceMin = Number(params.priceMin);
  const priceMax = Number(params.priceMax);
  if (params.priceMin && Number.isFinite(priceMin)) conditions.push(`COALESCE(w.price, 0) >= ${add(priceMin)}`);
  if (params.priceMax && Number.isFinite(priceMax)) conditions.push(`COALESCE(w.price, 0) <= ${add(priceMax)}`);

  const orderBy = {
    newest: 'w.create_date DESC NULLS LAST',
    oldest: 'w.create_date ASC NULLS LAST',
    due: `${WORK_DUE_DAY} ASC NULLS LAST, w.create_date DESC`, // хугацаагүй ажлууд сүүлд
    price_desc: 'COALESCE(w.price, 0) DESC, w.create_date DESC',
    price_asc: 'COALESCE(w.price, 0) ASC, w.create_date DESC',
  }[WORK_SORTS.includes(params.sort ?? '') ? (params.sort as string) : 'newest'];

  return { where: conditions.join(' AND '), values, orderBy: `${orderBy}, w.work_id` };
}

// Хугацаа хэтэрсэн нээлттэй ажлын тоо (шүүлтүүрээс үл хамааран)
export const OVERDUE_CONDITION = `${WORK_DUE_DAY} < ${TODAY} AND ${OPEN}`;
