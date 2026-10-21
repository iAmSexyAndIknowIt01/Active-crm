import 'server-only';
import { isManager } from './roles';
import type { PoolClient } from 'pg';
import { pool } from './db';
import type { Session } from './session';

// Админ бүх ажлыг, ажилтан зөвхөн өөрт нь хуваарилагдсан ажлыг засна
export function canEditWork(session: Pick<Session, 'role' | 'userId'>, assignedEmployee: unknown): boolean {
  if (isManager(session.role)) return true;
  return assignedEmployee !== null && assignedEmployee !== undefined && String(assignedEmployee) === session.userId;
}

const CUSTOMER_TYPES = ['individual', 'company'];
const STATUSES = ['pending', 'in_progress', 'completed', 'cancelled'];
const PRIORITIES = ['low', 'medium', 'high'];

interface WorkInput {
  customer_type?: unknown;
  customer_id?: unknown;
  assigned_employee?: unknown;
  status?: unknown;
  priority?: unknown;
}

// Ажил үүсгэх/засах хүсэлтэд ирсэн ID-ууд тухайн компанийх эсэхийг шалгана.
// Клиентээс ирсэн ID-д итгэвэл өөр компанийн харилцагч, ажилтантай холбох боломжтой болно.
// Алдаатай бол монгол тайлбар, зөв бол null буцаана.
export async function validateWorkInput(companyId: string, input: WorkInput): Promise<string | null> {
  if (!CUSTOMER_TYPES.includes(String(input.customer_type))) {
    return 'Харилцагчийн төрөл буруу байна.';
  }
  if (input.status && !STATUSES.includes(String(input.status))) {
    return 'Ажлын төлөв буруу байна.';
  }
  if (input.priority && !PRIORITIES.includes(String(input.priority))) {
    return 'Зэрэглэл буруу байна.';
  }
  if (!input.customer_id) {
    return 'Харилцагчаа сонгоно уу.';
  }
  if (!input.assigned_employee) {
    return 'Хариуцсан ажилтнаа сонгоно уу.';
  }

  const checks: { sql: string; value: unknown; message: string }[] = [];
  if (input.customer_id) {
    checks.push(
      input.customer_type === 'company'
        ? {
            sql: 'SELECT 1 FROM mt_customercompany WHERE company_customer_id::text = $1 AND company_id = $2',
            value: input.customer_id,
            message: 'Сонгосон байгууллага харилцагч олдсонгүй.',
          }
        : {
            sql: 'SELECT 1 FROM mt_customer WHERE customer_id::text = $1 AND company_id = $2',
            value: input.customer_id,
            message: 'Сонгосон харилцагч олдсонгүй.',
          }
    );
  }
  if (input.assigned_employee) {
    checks.push({
      sql: 'SELECT 1 FROM mt_user WHERE user_id::text = $1 AND company_id = $2 AND is_active IS NOT FALSE',
      value: input.assigned_employee,
      message: 'Сонгосон ажилтан олдсонгүй эсвэл идэвхгүй байна.',
    });
  }

  for (const check of checks) {
    const { rows } = await pool.query(check.sql, [String(check.value), companyId]);
    if (rows.length === 0) return check.message;
  }
  return null;
}

// Ажлын үйлчилгээ бүрийн мөр. Нэр, үнийг хадгалах үеийнхээр нь хуулж хадгална.
export interface WorkServiceLine {
  service_id: number | null;
  service_name: string;
  price: number;
  quantity: number;
}

const MAX_SERVICE_LINES = 50;

// Ажлын жагсаалт/дэлгэрэнгүй query-д үйлчилгээнүүдийг нэмэх SELECT хэсэг (mt_works-ийн alias нь w)
export const WORK_SERVICES_SELECT = `
  COALESCE((
    SELECT json_agg(json_build_object(
      'work_service_id', ws.work_service_id,
      'service_id', ws.service_id,
      'service_name', ws.service_name,
      'price', ws.price,
      'quantity', ws.quantity
    ) ORDER BY ws.sort_order)
    FROM mt_work_services ws WHERE ws.work_id = w.work_id
  ), '[]'::json) AS services,
  (SELECT string_agg(ws.service_name, ', ' ORDER BY ws.sort_order)
   FROM mt_work_services ws WHERE ws.work_id = w.work_id) AS service_name
`;

// Хүсэлтийн services: [{ service_id, price?, quantity? }] массивыг шалгаж, нэр/үнийг DB-ээс нөхнө.
// Хуучин клиентэд зориулж ганц service_id ирвэл нэг мөр гэж үзнэ.
// service_id-гүй мөр нь устсан үйлчилгээний хадгалсан мөр (service_name заавал).
export async function normalizeWorkServices(
  companyId: string,
  body: { services?: unknown; service_id?: unknown }
): Promise<{ lines: WorkServiceLine[]; error?: never } | { lines?: never; error: string }> {
  const raw: unknown[] = Array.isArray(body.services)
    ? body.services
    : body.service_id
      ? [{ service_id: body.service_id }]
      : [];

  if (raw.length > MAX_SERVICE_LINES) {
    return { error: `Нэг ажилд хамгийн ихдээ ${MAX_SERVICE_LINES} үйлчилгээ нэмэх боломжтой.` };
  }

  const ids = raw
    .map((item) => (item as { service_id?: unknown })?.service_id)
    .filter((id) => id !== null && id !== undefined && id !== '')
    .map(String);
  if (new Set(ids).size !== ids.length) {
    return { error: 'Нэг үйлчилгээг давхар нэмсэн байна.' };
  }

  const catalog = new Map<string, { service_id: number; name: string; price: number }>();
  if (ids.length > 0) {
    const { rows } = await pool.query(
      'SELECT service_id, name, price FROM mt_services WHERE company_id = $1 AND service_id::text = ANY($2::text[])',
      [companyId, ids]
    );
    for (const row of rows) catalog.set(String(row.service_id), row);
    if (catalog.size !== ids.length) return { error: 'Сонгосон үйлчилгээ олдсонгүй.' };
  }

  const lines: WorkServiceLine[] = [];
  for (const item of raw) {
    const line = (item ?? {}) as { service_id?: unknown; service_name?: unknown; price?: unknown; quantity?: unknown };

    const quantity = line.quantity === undefined || line.quantity === '' ? 1 : Number(line.quantity);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 9999) {
      return { error: 'Үйлчилгээний тоо ширхэг 1-ээс их бүхэл тоо байх ёстой.' };
    }

    const hasPrice = line.price !== undefined && line.price !== null && line.price !== '';
    const price = hasPrice ? Number(line.price) : null;
    if (price !== null && (!Number.isFinite(price) || price < 0)) {
      return { error: 'Үйлчилгээний үнэ буруу байна.' };
    }

    const service = line.service_id ? catalog.get(String(line.service_id)) : undefined;
    if (service) {
      lines.push({
        service_id: service.service_id,
        service_name: service.name,
        price: round2(price ?? Number(service.price ?? 0)),
        quantity,
      });
    } else {
      const name = typeof line.service_name === 'string' ? line.service_name.trim().slice(0, 255) : '';
      if (!name) return { error: 'Үйлчилгээгээ сонгоно уу.' };
      lines.push({ service_id: null, service_name: name, price: round2(price ?? 0), quantity });
    }
  }
  return { lines };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export const sumWorkServices = (lines: WorkServiceLine[]) =>
  round2(lines.reduce((sum, l) => sum + l.price * l.quantity, 0));

// Ажлын үйлчилгээнүүдийг бүхэлд нь солино. Transaction доторх client-ээр дуудна.
export async function replaceWorkServices(client: PoolClient, workId: string, lines: WorkServiceLine[]) {
  await client.query('DELETE FROM mt_work_services WHERE work_id = $1', [workId]);
  if (lines.length === 0) return;

  const values: unknown[] = [];
  const placeholders = lines.map((line, i) => {
    values.push(workId, line.service_id, line.service_name, line.price, line.quantity, i);
    const b = i * 6;
    return `($${b + 1}, $${b + 2}, $${b + 3}, $${b + 4}, $${b + 5}, $${b + 6})`;
  });
  await client.query(
    `INSERT INTO mt_work_services (work_id, service_id, service_name, price, quantity, sort_order)
     VALUES ${placeholders.join(', ')}`,
    values
  );
}
