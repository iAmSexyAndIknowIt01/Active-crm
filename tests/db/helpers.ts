import { randomUUID } from 'node:crypto';

// DB тестүүд TEST_DATABASE_URL заасан үед л ажиллана (migration хийсэн хоосон мэдээллийн сан).
// Жишээ: TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/activecrm_test DATABASE_SSL=false npm test
export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;

if (TEST_DATABASE_URL) {
  // src/lib/db.ts нь import хийгдэх үедээ DATABASE_URL-ийг уншдаг
  process.env.DATABASE_URL = TEST_DATABASE_URL;
}

export async function getPool() {
  const { pool } = await import('@/src/lib/db');
  return pool;
}

// Тест бүрд тусдаа компани үүсгэж, дуусахад бүх холбоотой өгөгдлийг (CASCADE) устгана
export async function createCompany() {
  const pool = await getPool();
  const companyId = randomUUID();
  await pool.query(`INSERT INTO mt_company (company_id, company_name, phone_number) VALUES ($1, 'Тест ХХК', '77001122')`, [
    companyId,
  ]);
  return {
    companyId,
    cleanup: () => pool.query('DELETE FROM mt_company WHERE company_id = $1', [companyId]),
  };
}

export async function inTransaction<T>(fn: (client: import('pg').PoolClient) => Promise<T>): Promise<T> {
  const pool = await getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
