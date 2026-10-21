import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { TEST_DATABASE_URL, call, createTestCompany, db, loginAs, type TestCompany } from './setup';

describe.skipIf(!TEST_DATABASE_URL)('subscription, limits and billing API', () => {
  let company: TestCompany;
  let customers: typeof import('@/src/app/api/customers/route');
  let employees: typeof import('@/src/app/api/employees/route');
  let billing: typeof import('@/src/app/api/billing/route');
  let payments: typeof import('@/src/app/api/billing/payments/route');
  let confirm: typeof import('@/src/app/api/platform/payments/[id]/route');

  beforeAll(async () => {
    company = await createTestCompany();
    customers = await import('@/src/app/api/customers/route');
    employees = await import('@/src/app/api/employees/route');
    billing = await import('@/src/app/api/billing/route');
    payments = await import('@/src/app/api/billing/payments/route');
    confirm = await import('@/src/app/api/platform/payments/[id]/route');
    process.env.PLATFORM_ADMIN_EMAILS = company.users.admin.email;
  });
  afterAll(async () => {
    delete process.env.PLATFORM_ADMIN_EMAILS;
    const pool = await db();
    await pool.query(`DELETE FROM mt_site_content WHERE key = 'bank'`);
    await company.cleanup();
  });

  const setCompany = async (sql: string) => (await db()).query(`UPDATE mt_company SET ${sql} WHERE company_id = $1`, [company.companyId]);
  beforeEach(async () => {
    await setCompany(`plan = 'trial', trial_ends_at = now() + interval '14 days', paid_until = NULL`);
  });

  it('blocks the API with 402 after the trial ends but keeps billing open', async () => {
    await setCompany(`trial_ends_at = now() - interval '1 day'`);
    await loginAs(company, 'admin');
    const res = await call(customers.GET);
    expect(res.status).toBe(402);
    expect(res.body.code).toBe('subscription_expired');
    const info = await call(billing.GET);
    expect(info.status).toBe(200);
    expect((info.body.data as { subscription: { status: string } }).subscription.status).toBe('expired');
  });

  it('enforces the Standard plan user limit', async () => {
    await setCompany(`plan = 'standard', paid_until = now() + interval '1 month'`); // 3 хэрэглэгч аль хэдийн бий
    await loginAs(company, 'admin');
    const res = await call(employees.POST, {
      method: 'POST',
      body: { first_name: 'Нэмэлт', last_name: 'Ажилтан', email: `extra-${company.companyId}@test.mn`, password: 'Passw0rd99', role: 'employee' },
    });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('plan_limit');
  });

  it('creates a bank payment and extends the plan when a platform admin confirms it', async () => {
    await loginAs(company, 'manager');
    expect((await call(payments.POST, { method: 'POST', body: { plan: 'pro', months: 1, method: 'bank' } })).status).toBe(403);

    await loginAs(company, 'admin');
    expect((await call(payments.POST, { method: 'POST', body: { plan: 'pro', months: 1, method: 'bank' } })).status).toBe(400); // данс тохируулаагүй
    await (await db()).query(
      `INSERT INTO mt_site_content (key, value) VALUES ('bank', '{"bank_name":"Хаан","account_number":"5000","account_holder":"ХХК"}')
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`
    );
    const created = await call(payments.POST, { method: 'POST', body: { plan: 'pro', months: 3, method: 'bank' } });
    expect(created.status).toBe(200);
    const payment = (created.body.data as { payment: { id: string; amount: string; reference: string } }).payment;
    expect(Number(payment.amount)).toBe(99000 * 3);
    expect(payment.reference).toMatch(/^ACRM-[A-Z0-9]{6}$/);

    const res = await call(confirm.POST, { method: 'POST', body: { action: 'confirm' }, params: { id: payment.id } });
    expect(res.status).toBe(200);
    expect((await call(confirm.POST, { method: 'POST', body: { action: 'confirm' }, params: { id: payment.id } })).status).toBe(409);

    const info = await call(billing.GET);
    const sub = (info.body.data as { subscription: { status: string; plan: string; daysLeft: number } }).subscription;
    expect(sub).toMatchObject({ status: 'active', plan: 'pro' });
    expect(sub.daysLeft).toBeGreaterThan(85);
  });

  it('rejects platform actions from non-platform admins', async () => {
    process.env.PLATFORM_ADMIN_EMAILS = 'someone-else@test.mn';
    await loginAs(company, 'admin');
    const res = await call(confirm.POST, { method: 'POST', body: { action: 'confirm' }, params: { id: '00000000-0000-0000-0000-000000000000' } });
    expect(res.status).toBe(403);
    process.env.PLATFORM_ADMIN_EMAILS = company.users.admin.email;
  });
});
