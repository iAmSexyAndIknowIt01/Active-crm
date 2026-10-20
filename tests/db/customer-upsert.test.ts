import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TEST_DATABASE_URL, createCompany, getPool, inTransaction } from './helpers';
import { upsertIndividualCustomer, type ExtractedCustomer } from '@/src/lib/form-customer';

const empty: ExtractedCustomer = {
  first_name: null,
  last_name: null,
  phone: null,
  email: null,
  address: null,
  birth_date: null,
  male: null,
};

describe.skipIf(!TEST_DATABASE_URL)('upsertIndividualCustomer', () => {
  let company: Awaited<ReturnType<typeof createCompany>>;
  beforeEach(async () => {
    company = await createCompany();
  });
  afterEach(async () => {
    await company.cleanup();
  });

  const upsert = (fields: Partial<ExtractedCustomer>, requireContact = true) =>
    inTransaction((client) =>
      upsertIndividualCustomer(client, company.companyId, { ...empty, ...fields }, { source: 'form', requireContact })
    );

  it('creates a customer and then matches the same phone in another format', async () => {
    const first = await upsert({ first_name: 'Сүхбат', last_name: 'Дорж', phone: '99112233' });
    expect(first).toMatchObject({ created: true });

    const second = await upsert({ first_name: 'Өөр', phone: '+976 9911 2233', email: 'suhee@mail.mn' });
    expect(second).toEqual({ customerId: first!.customerId, created: false });

    const pool = await getPool();
    const { rows } = await pool.query('SELECT first_name, email, source FROM mt_customer WHERE company_id = $1', [
      company.companyId,
    ]);
    // Байгаа нэрийг дарж бичихгүй, хоосон имэйлийг нөхнө
    expect(rows).toEqual([{ first_name: 'Сүхбат', email: 'suhee@mail.mn', source: 'form' }]);
  });

  it('matches by email (case-insensitive) when the phone differs', async () => {
    const first = await upsert({ first_name: 'Бат', email: 'bat@mail.mn' });
    const second = await upsert({ first_name: 'Бат', phone: '88001122', email: 'bat@mail.mn' });
    expect(second?.customerId).toBe(first?.customerId);
  });

  it('does not match customers of another company', async () => {
    const other = await createCompany();
    try {
      await inTransaction((client) =>
        upsertIndividualCustomer(client, other.companyId, { ...empty, first_name: 'Бат', phone: '99112233' }, {
          source: 'form',
          requireContact: true,
        })
      );
      const mine = await upsert({ first_name: 'Бат', phone: '99112233' });
      expect(mine?.created).toBe(true);
    } finally {
      await other.cleanup();
    }
  });

  it('requires a phone or email for forms but not for imports', async () => {
    expect(await upsert({ first_name: 'Нэргүй' })).toBeNull();
    expect(await upsert({ first_name: 'Ганаа' }, false)).toMatchObject({ created: true });
  });

  it('does not create a nameless customer', async () => {
    expect(await upsert({ phone: '99887766' })).toBeNull();
  });
});
