import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TEST_DATABASE_URL, call, createTestCompany, db, loginAs, logout, type TestCompany } from './setup';

describe.skipIf(!TEST_DATABASE_URL)('customers API and role checks', () => {
  let company: TestCompany;
  let customers: typeof import('@/src/app/api/customers/route');
  let customer: typeof import('@/src/app/api/customers/[id]/route');
  let analytics: typeof import('@/src/app/api/analytics/route');
  let audit: typeof import('@/src/app/api/audit/route');

  beforeAll(async () => {
    company = await createTestCompany();
    customers = await import('@/src/app/api/customers/route');
    customer = await import('@/src/app/api/customers/[id]/route');
    analytics = await import('@/src/app/api/analytics/route');
    audit = await import('@/src/app/api/audit/route');
  });
  afterAll(async () => {
    await company.cleanup();
  });

  it('rejects anonymous requests', async () => {
    logout();
    expect((await call(customers.GET)).status).toBe(401);
  });

  it('lets admins and managers read customers but not employees', async () => {
    await loginAs(company, 'employee');
    expect((await call(customers.GET)).status).toBe(403);
    expect((await call(analytics.GET, { url: 'http://localhost/api/analytics' })).status).toBe(403);
    await loginAs(company, 'manager');
    expect((await call(customers.GET)).status).toBe(200);
    expect((await call(analytics.GET, { url: 'http://localhost/api/analytics' })).status).toBe(200);
    await loginAs(company, 'admin');
    expect((await call(customers.GET)).status).toBe(200);
  });

  it('validates input, warns about duplicates and pages results', async () => {
    await loginAs(company, 'manager');
    const bad = await call(customers.POST, { method: 'POST', body: { customer_type: 'individual', first_name: 'Бат', male: 'Эрэгтэй', email: 'bad@' } });
    expect(bad.status).toBe(400);

    const body = { customer_type: 'individual', first_name: 'Бат', last_name: 'Дорж', male: 'Эрэгтэй', phone: '99112233' };
    expect((await call(customers.POST, { method: 'POST', body })).status).toBe(200);
    const dup = await call(customers.POST, { method: 'POST', body: { ...body, phone: '+976 9911-2233' } });
    expect(dup.status).toBe(409);
    expect(dup.body.duplicate).toMatchObject({ matched_by: 'phone' });
    expect((await call(customers.POST, { method: 'POST', body: { ...body, allow_duplicate: true } })).status).toBe(200);

    const page = await call(customers.GET, { url: 'http://localhost/api/customers?page=1&pageSize=1&q=Дорж' });
    expect(page.body.total).toBe(2);
    expect((page.body.data as unknown[]).length).toBe(1);
  });

  it('only admins can delete, and deletes are audited', async () => {
    const pool = await db();
    const { rows } = await pool.query(`SELECT customer_id FROM mt_customer WHERE company_id = $1 LIMIT 1`, [company.companyId]);
    const params = { id: rows[0].customer_id };
    const url = 'http://localhost/api/customers/x?type=individual';

    await loginAs(company, 'manager');
    expect((await call(customer.DELETE, { method: 'DELETE', url, params })).status).toBe(403);
    expect((await call(audit.GET, { url: 'http://localhost/api/audit' })).status).toBe(403);

    await loginAs(company, 'admin');
    expect((await call(customer.DELETE, { method: 'DELETE', url, params })).status).toBe(200);
    expect((await call(customer.GET, { url, params })).status).toBe(404);

    const log = await call(audit.GET, { url: 'http://localhost/api/audit' });
    const actions = (log.body.data as { action: string }[]).map((r) => r.action);
    expect(actions).toContain('customer.delete');
    expect(actions).toContain('customer.create');
  });

  it('returns 404 for malformed ids instead of a server error', async () => {
    await loginAs(company, 'admin');
    expect((await call(customer.GET, { url: 'http://localhost/api/customers/x', params: { id: 'not-a-uuid' } })).status).toBe(404);
  });
});
