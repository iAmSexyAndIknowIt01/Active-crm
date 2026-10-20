import 'server-only';
import type { PoolClient } from 'pg';
import { pool } from './db';
import type { Session } from './session';

export type AuditAction =
  | 'customer.create'
  | 'customer.update'
  | 'customer.delete'
  | 'customer.import'
  | 'work.create'
  | 'work.update'
  | 'employee.create'
  | 'employee.update'
  | 'data.export';

// Үйлдлийн түүхэнд нэг мөр бичнэ. Түүх бичиж чадаагүй ч үндсэн үйлдлийг зогсоохгүй (алдааг лог хийнэ).
// Transaction доторх өөрчлөлтийг бичих бол тэр transaction-ы client-ийг дамжуулна.
export async function logAudit(
  entry: {
    session: Pick<Session, 'companyId' | 'userId'>;
    action: AuditAction;
    entityType: string;
    entityId?: string | null;
    summary?: string | null;
    details?: Record<string, unknown> | null;
  },
  client?: PoolClient
) {
  try {
    await (client ?? pool).query(
      `
        INSERT INTO mt_audit_log (company_id, user_id, user_name, action, entity_type, entity_id, summary, details)
        VALUES ($1, $2,
                (SELECT NULLIF(TRIM(CONCAT(last_name, ' ', first_name)), '') FROM mt_user WHERE user_id = $2),
                $3, $4, $5, $6, $7)
      `,
      [
        entry.session.companyId,
        entry.session.userId,
        entry.action,
        entry.entityType,
        entry.entityId ?? null,
        entry.summary?.slice(0, 500) ?? null,
        entry.details ? JSON.stringify(entry.details) : null,
      ]
    );
  } catch (error) {
    console.error('Audit log write failed:', error);
  }
}

// Хоёр объектын ялгаатай талбаруудыг { талбар: [хуучин, шинэ] } хэлбэрээр буцаана
export function diffFields(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  keys: string[]
): Record<string, [unknown, unknown]> {
  const changes: Record<string, [unknown, unknown]> = {};
  for (const key of keys) {
    const a = before[key] ?? null;
    const b = after[key] ?? null;
    if (String(a) !== String(b)) changes[key] = [a, b];
  }
  return changes;
}
