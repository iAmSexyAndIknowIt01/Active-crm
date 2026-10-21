// Багцын тодорхойлолт ба компанийн одоогийн багцын төлөв. Клиент болон сервер хоёуланд ашиглагдана.
// Үнийг платформын админ "Платформ → Контент"-оос өөрчилнө (энд анхдагч утга).

export type PaidPlan = 'standard' | 'pro';
export type PlanKey = 'trial' | PaidPlan;

export interface PlanLimits {
  users: number | null; // null = хязгааргүй
  customers: number | null;
  sms: boolean;
}

export const PLAN_INFO: Record<PlanKey, { name: string; defaultPrice: number; limits: PlanLimits; features: string[] }> = {
  trial: {
    name: 'Туршилт',
    defaultPrice: 0,
    limits: { users: null, customers: null, sms: true },
    features: ['14 хоног Pro багцын бүх боломж'],
  },
  standard: {
    name: 'Стандарт',
    defaultPrice: 49000,
    limits: { users: 3, customers: 1000, sms: false },
    features: ['3 хүртэл хэрэглэгч', '1,000 хүртэл харилцагч', 'QR анкет, файлаас оруулах', 'Имэйл сануулга'],
  },
  pro: {
    name: 'Pro',
    defaultPrice: 99000,
    limits: { users: null, customers: null, sms: true },
    features: ['Хязгааргүй хэрэглэгч', 'Хязгааргүй харилцагч', 'SMS болон имэйл сануулга', 'Бүх боломж'],
  },
};

export const PAID_PLANS: PaidPlan[] = ['standard', 'pro'];
export const TRIAL_DAYS = 14;

export function isPaidPlan(value: unknown): value is PaidPlan {
  return value === 'standard' || value === 'pro';
}

export interface SubscriptionRow {
  plan: string | null;
  trial_ends_at: string | Date | null;
  paid_until: string | Date | null;
}

export interface Subscription {
  plan: PlanKey; // одоо үйлчилж буй багц (туршилт эсвэл төлсөн)
  status: 'trial' | 'active' | 'expired';
  endsAt: string | null; // ISO
  daysLeft: number; // дуусахад үлдсэн бүтэн хоног (дууссан бол 0)
  limits: PlanLimits;
}

const DAY = 24 * 60 * 60 * 1000;

// Төлсөн хугацаа үлдсэн бол төлсөн багц, үгүй бол туршилт, аль аль нь дууссан бол "expired"
export function computeSubscription(row: SubscriptionRow, now = Date.now()): Subscription {
  const paidUntil = row.paid_until ? new Date(row.paid_until).getTime() : null;
  const trialEnds = row.trial_ends_at ? new Date(row.trial_ends_at).getTime() : null;
  const paidPlan: PaidPlan = isPaidPlan(row.plan) ? row.plan : 'standard';

  if (paidUntil && paidUntil > now) {
    return {
      plan: paidPlan,
      status: 'active',
      endsAt: new Date(paidUntil).toISOString(),
      daysLeft: Math.ceil((paidUntil - now) / DAY),
      limits: PLAN_INFO[paidPlan].limits,
    };
  }
  if (trialEnds && trialEnds > now) {
    return {
      plan: 'trial',
      status: 'trial',
      endsAt: new Date(trialEnds).toISOString(),
      daysLeft: Math.ceil((trialEnds - now) / DAY),
      limits: PLAN_INFO.trial.limits,
    };
  }
  const lastEnd = Math.max(paidUntil ?? 0, trialEnds ?? 0);
  return {
    plan: paidUntil ? paidPlan : 'trial',
    status: 'expired',
    endsAt: lastEnd ? new Date(lastEnd).toISOString() : null,
    daysLeft: 0,
    limits: { users: 0, customers: 0, sms: false },
  };
}

// Багцын хугацаа дууссан ч нээгдэх хуудсууд (төлбөр төлөх, профайл)
export const EXPIRED_ALLOWED_PATHS = ['/dashboard/billing', '/dashboard/profile', '/dashboard/platform'];
