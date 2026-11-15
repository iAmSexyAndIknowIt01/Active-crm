import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { TEST_DATABASE_URL, call, createTestCompany, db, loginAs, type TestCompany } from './setup';

describe.skipIf(!TEST_DATABASE_URL)('subscription, limits and billing API', () => {
  let company: TestCompany;
  let customers: typeof import('@/src/app/api/customers/route');
  let employees: typeof import('@/src/app/api/employees/route');
  let billing: typeof import('@/src/app/api/billing/route');
  let payments: typeof import('@/src/app/api/billing/payments/route');
  let report: typeof import('@/src/app/api/billing/payments/[id]/report/route');
  let confirm: typeof import('@/src/app/api/platform/payments/[id]/route');

  beforeAll(async () => {
    company = await createTestCompany();
    customers = await import('@/src/app/api/customers/route');
    employees = await import('@/src/app/api/employees/route');
    billing = await import('@/src/app/api/billing/route');
    payments = await import('@/src/app/api/billing/payments/route');
    report = await import('@/src/app/api/billing/payments/[id]/report/route');
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

  it('shows a demo bank account until a real one is configured', async () => {
    await (await db()).query(`DELETE FROM mt_site_content WHERE key = 'bank'`);
    await loginAs(company, 'admin');
    const demo = (await call(billing.GET)).body.data as { bank: { account_number: string; is_demo: boolean } };
    expect(demo.bank).toMatchObject({ account_number: '0000 0000 0000', is_demo: true });

    // Жишээ данстай үед ч төлбөр үүснэ
    const created = await call(payments.POST, { method: 'POST', body: { plan: 'pro', months: 1, method: 'bank' } });
    expect(created.status).toBe(200);

    await (await db()).query(
      `INSERT INTO mt_site_content (key, value) VALUES ('bank', '{"bank_name":"Хаан","account_number":"5000","account_holder":"ХХК"}')
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`
    );
    const real = (await call(billing.GET)).body.data as { bank: { account_number: string; is_demo: boolean } };
    expect(real.bank).toMatchObject({ account_number: '5000', is_demo: false });
  });

  it('puts a reported bank payment under review and extends the plan only when a platform admin confirms it', async () => {
    await loginAs(company, 'manager');
    expect((await call(payments.POST, { method: 'POST', body: { plan: 'pro', months: 1, method: 'bank' } })).status).toBe(403);

    await loginAs(company, 'admin');
    const created = await call(payments.POST, { method: 'POST', body: { plan: 'pro', months: 3, method: 'bank' } });
    expect(created.status).toBe(200);
    const payment = (created.body.data as { payment: { id: string; amount: string; reference: string } }).payment;
    expect(Number(payment.amount)).toBe(99000 * 3);
    expect(payment.reference).toMatch(/^ACRM-[A-Z0-9]{6}$/);

    // "Төлбөр хийсэн": зөвхөн админ, төлөв review болно, багц сунгагдахгүй
    await loginAs(company, 'manager');
    expect((await call(report.POST, { method: 'POST', params: { id: payment.id } })).status).toBe(403);
    await loginAs(company, 'admin');
    const reported = await call(report.POST, { method: 'POST', params: { id: payment.id } });
    expect(reported.status).toBe(200);
    expect((reported.body.data as { status: string }).status).toBe('review');
    expect((await call(report.POST, { method: 'POST', params: { id: payment.id } })).body.data).toMatchObject({ status: 'review' });

    const pendingInfo = await call(billing.GET);
    const pendingData = pendingInfo.body.data as {
      subscription: { status: string };
      payments: { id: string; status: string }[];
    };
    expect(pendingData.subscription.status).toBe('trial');
    expect(pendingData.payments.find((p) => p.id === payment.id)?.status).toBe('review');

    // Платформын админ баталгаажуулахад багц сунгагдана
    const res = await call(confirm.POST, { method: 'POST', body: { action: 'confirm' }, params: { id: payment.id } });
    expect(res.status).toBe(200);
    expect((await call(confirm.POST, { method: 'POST', body: { action: 'confirm' }, params: { id: payment.id } })).status).toBe(409);

    const info = await call(billing.GET);
    const sub = (info.body.data as { subscription: { status: string; plan: string; daysLeft: number } }).subscription;
    expect(sub).toMatchObject({ status: 'active', plan: 'pro' });
    expect(sub.daysLeft).toBeGreaterThan(85);
  });

  it('lets a platform admin cancel a payment under review', async () => {
    await loginAs(company, 'admin');
    const created = await call(payments.POST, { method: 'POST', body: { plan: 'standard', months: 1, method: 'bank' } });
    const { id } = (created.body.data as { payment: { id: string } }).payment;
    expect((await call(report.POST, { method: 'POST', params: { id } })).status).toBe(200);

    expect((await call(confirm.POST, { method: 'POST', body: { action: 'cancel' }, params: { id } })).status).toBe(200);
    // Цуцлагдсан төлбөрийг дахин "Төлбөр хийсэн" гэж мэдэгдэх боломжгүй, багц сунгагдаагүй
    expect((await call(report.POST, { method: 'POST', params: { id } })).status).toBe(409);
    const sub = ((await call(billing.GET)).body.data as { subscription: { status: string } }).subscription;
    expect(sub.status).toBe('trial');
  });

  it('rejects platform actions from non-platform admins', async () => {
    process.env.PLATFORM_ADMIN_EMAILS = 'someone-else@test.mn';
    await loginAs(company, 'admin');
    const res = await call(confirm.POST, { method: 'POST', body: { action: 'confirm' }, params: { id: '00000000-0000-0000-0000-000000000000' } });
    expect(res.status).toBe(403);
    process.env.PLATFORM_ADMIN_EMAILS = company.users.admin.email;
  });
});
