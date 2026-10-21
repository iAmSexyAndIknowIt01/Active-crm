import 'server-only';
import { pool } from './db';
import { computeSubscription, PLAN_INFO, type Subscription } from './plans';

// Багцын хязгаар (lib/plans.ts): хэрэглэгч, харилцагчийн тоо.

export async function getCompanySubscription(companyId: string): Promise<Subscription> {
  const { rows } = await pool.query('SELECT plan, trial_ends_at, paid_until FROM mt_company WHERE company_id = $1', [companyId]);
  return computeSubscription(rows[0] ?? { plan: null, trial_ends_at: null, paid_until: null });
}

export async function countCustomers(companyId: string): Promise<number> {
  const { rows } = await pool.query(
    `SELECT (SELECT COUNT(*) FROM mt_customer WHERE company_id = $1) +
            (SELECT COUNT(*) FROM mt_customercompany WHERE company_id = $1) AS total`,
    [companyId]
  );
  return Number(rows[0].total);
}

export async function countActiveUsers(companyId: string): Promise<number> {
  const { rows } = await pool.query('SELECT COUNT(*) AS total FROM mt_user WHERE company_id = $1 AND is_active IS NOT FALSE', [
    companyId,
  ]);
  return Number(rows[0].total);
}

const UPGRADE_HINT = '"Багц" хуудаснаас Pro багц руу шилжинэ үү.';

// count ширхэг харилцагч нэмж болох эсэх. Болохгүй бол хэрэглэгчид харуулах алдааны текст, болвол null.
export async function customerLimitError(companyId: string, subscription: Subscription, count = 1): Promise<string | null> {
  const limit = subscription.limits.customers;
  if (limit === null) return null;
  const current = await countCustomers(companyId);
  if (current + count <= limit) return null;
  const left = Math.max(0, limit - current);
  return `${PLAN_INFO[subscription.plan].name} багц ${limit.toLocaleString('en-US')} хүртэл харилцагчтай (үлдсэн: ${left}). ${UPGRADE_HINT}`;
}

export async function userLimitError(companyId: string, subscription: Subscription): Promise<string | null> {
  const limit = subscription.limits.users;
  if (limit === null) return null;
  if ((await countActiveUsers(companyId)) < limit) return null;
  return `${PLAN_INFO[subscription.plan].name} багц ${limit} хүртэл хэрэглэгчтэй. ${UPGRADE_HINT}`;
}
