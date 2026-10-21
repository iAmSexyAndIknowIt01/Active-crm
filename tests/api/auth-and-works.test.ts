import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { TEST_DATABASE_URL, call, createTestCompany, db, loginAs, type TestCompany } from './setup';

describe.skipIf(!TEST_DATABASE_URL)('sign-up email verification', () => {
  const email = `signup-${Date.now()}@test.mn`;
  afterAll(async () => {
    await (await db()).query(`DELETE FROM mt_company WHERE company_id IN (SELECT company_id FROM mt_user WHERE email = $1)`, [email]);
  });

  it('requires the emailed link before login', async () => {
    const register = await import('@/src/app/api/auth/register/route');
    const login = await import('@/src/app/api/auth/login/route');
    const verify = await import('@/src/app/api/auth/verify-email/route');
    const logs: string[] = [];
    const spy = vi.spyOn(console, 'log').mockImplementation((...args) => void logs.push(args.join(' ')));

    const body = { companyName: 'Шинэ ХХК', lastName: 'Бат', firstName: 'Болд', email, password: 'Passw0rd123' };
    expect((await call(register.POST, { method: 'POST', body })).status).toBe(201);

    const denied = await call(login.POST, { method: 'POST', body: { email, password: 'Passw0rd123' } });
    expect(denied.status).toBe(403);
    expect(denied.body.code).toBe('email_not_verified');

    const link = logs.join('\n').match(/verify-email\?token=(\S+)/);
    expect(link).not.toBeNull();
    const token = decodeURIComponent(link![1]);
    expect((await call(verify.POST, { method: 'POST', body: { token: token.slice(0, -2) + 'xx' } })).status).toBe(400);
    expect((await call(verify.POST, { method: 'POST', body: { token } })).status).toBe(200);
    expect((await call(login.POST, { method: 'POST', body: { email, password: 'Passw0rd123' } })).status).toBe(200);
    spy.mockRestore();
  });
});

describe.skipIf(!TEST_DATABASE_URL)('works API paging and filters', () => {
  let company: TestCompany;
  let works: typeof import('@/src/app/api/workshop/route');

  beforeAll(async () => {
    company = await createTestCompany();
    works = await import('@/src/app/api/workshop/route');
    const pool = await db();
    await pool.query(
      `INSERT INTO mt_works (company_id, customer_type, title, price, status, priority, due_date, assigned_employee) VALUES
        ($1, 'individual', 'Хоцорсон тос солих', 50000, 'pending', 'high', now() - interval '2 days', $2),
        ($1, 'individual', 'Дугуй солих', 120000, 'in_progress', 'low', NULL, NULL),
        ($1, 'individual', 'Дууссан угаалга', 15000, 'completed', 'medium', now() - interval '5 days', NULL)`,
      [company.companyId, company.users.employee.userId]
    );
  });
  afterAll(async () => {
    await company.cleanup();
  });

  const list = async (query: string) => {
    const res = await call(works.GET, { url: `http://localhost/api/workshop?${query}` });
    expect(res.status).toBe(200);
    return res.body as unknown as { total: number; overdueCount: number; data: { title: string; can_edit: boolean }[] };
  };

  it('pages, filters and sorts on the server', async () => {
    await loginAs(company, 'manager');
    const first = await list('page=1&pageSize=2');
    expect(first.total).toBe(3);
    expect(first.data).toHaveLength(2);
    expect(first.overdueCount).toBe(1); // дууссан ажил хоцорсонд тооцогдохгүй

    expect((await list('due=overdue')).data.map((w) => w.title)).toEqual(['Хоцорсон тос солих']);
    expect((await list('employee=none')).total).toBe(2);
    expect((await list('q=тос')).data.map((w) => w.title)).toEqual(['Хоцорсон тос солих']);
    expect((await list('sort=price_desc')).data[0].title).toBe('Дугуй солих');
    expect((await list('due=none')).data.map((w) => w.title)).toEqual(['Дугуй солих']);
  });

  it('lets employees see works but edit only their own', async () => {
    await loginAs(company, 'employee');
    const all = await list('page=1&sort=price_asc');
    expect(all.data.find((w) => w.title === 'Хоцорсон тос солих')?.can_edit).toBe(true);
    expect(all.data.find((w) => w.title === 'Дугуй солих')?.can_edit).toBe(false);
  });
});
