import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TEST_DATABASE_URL, createCompany, getPool } from './helpers';

describe.skipIf(!TEST_DATABASE_URL)('duplicate detection and audit log', () => {
  let company: Awaited<ReturnType<typeof createCompany>>;
  beforeEach(async () => {
    company = await createCompany();
  });
  afterEach(async () => {
    await company.cleanup();
  });

  it('finds individuals by phone in any format or by email, excluding the customer itself', async () => {
    const { findDuplicateIndividual } = await import('@/src/lib/customer-duplicates');
    const pool = await getPool();
    const { rows } = await pool.query(
      `INSERT INTO mt_customer (company_id, first_name, last_name, phone, email) VALUES ($1, 'Сүхбат', 'Дорж', '9911-2233', 'suhee@mail.mn') RETURNING customer_id`,
      [company.companyId]
    );
    const id = rows[0].customer_id;

    expect(await findDuplicateIndividual(company.companyId, { phone: '+97699112233', email: null })).toMatchObject({
      customer_id: id,
      matched_by: 'phone',
      name: 'Дорж Сүхбат',
    });
    expect(await findDuplicateIndividual(company.companyId, { phone: null, email: 'SUHEE@mail.mn' })).toMatchObject({ matched_by: 'email' });
    expect(await findDuplicateIndividual(company.companyId, { phone: '99112233', email: null }, id)).toBeNull();
    expect(await findDuplicateIndividual(company.companyId, { phone: '88888888', email: null })).toBeNull();
  });

  it('finds companies by register number ignoring spaces and case', async () => {
    const { findDuplicateCompany } = await import('@/src/lib/customer-duplicates');
    const pool = await getPool();
    await pool.query(`INSERT INTO mt_customercompany (company_id, name, tax_number) VALUES ($1, 'ХХК', 'ab 123')`, [company.companyId]);
    expect(await findDuplicateCompany(company.companyId, 'AB123')).toMatchObject({ name: 'ХХК', matched_by: 'tax_number' });
  });

  it('writes audit rows with the acting user name', async () => {
    const { logAudit } = await import('@/src/lib/audit');
    const pool = await getPool();
    const { rows: users } = await pool.query(
      `INSERT INTO mt_user (company_id, email, password_hash, first_name, last_name, role)
       VALUES ($1, $2, 'x', 'Болд', 'Бат', 'admin') RETURNING user_id`,
      [company.companyId, `audit-${company.companyId}@test.mn`]
    );
    await logAudit({
      session: { companyId: company.companyId, userId: users[0].user_id },
      action: 'customer.update',
      entityType: 'customer',
      entityId: 'x',
      summary: 'Дорж Сүхбат',
      details: { phone: ['1', '2'] },
    });
    const { rows } = await pool.query(`SELECT user_name, action, details FROM mt_audit_log WHERE company_id = $1`, [company.companyId]);
    expect(rows).toEqual([{ user_name: 'Бат Болд', action: 'customer.update', details: { phone: ['1', '2'] } }]);
  });
});
