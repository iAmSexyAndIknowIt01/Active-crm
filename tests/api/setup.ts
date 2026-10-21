import { randomUUID } from 'node:crypto';

// API route-уудыг жинхэнэ DB, жинхэнэ session/эрхийн шалгалттай тестлэх орчин.
// next/headers-ийн cookies()/headers()-ийг санах ойн cookie хадгалалтаар солино.
export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
if (TEST_DATABASE_URL) process.env.DATABASE_URL = TEST_DATABASE_URL;
process.env.SESSION_SECRET ??= 'vitest-session-secret-0123456789abcdef0123';

// Mock-ууд tests/vitest.setup.ts-д бүртгэгдсэн; cookie хадгалалтыг globalThis-ээр хуваалцана
const store = globalThis as unknown as { __cookieJar?: Map<string, string> };
export const cookieJar = (store.__cookieJar ??= new Map<string, string>());

export async function db() {
  return (await import('@/src/lib/db')).pool;
}

export interface TestCompany {
  companyId: string;
  users: Record<'admin' | 'manager' | 'employee', { userId: string; email: string }>;
  cleanup: () => Promise<void>;
}

// Компани ба гурван эрхийн хэрэглэгч үүсгэнэ (имэйл баталгаажсан)
export async function createTestCompany(): Promise<TestCompany> {
  const pool = await db();
  const companyId = randomUUID();
  await pool.query(`INSERT INTO mt_company (company_id, company_name, email) VALUES ($1, 'API Тест ХХК', $2)`, [
    companyId,
    `owner-${companyId}@test.mn`,
  ]);
  const users = {} as TestCompany['users'];
  for (const role of ['admin', 'manager', 'employee'] as const) {
    const userId = randomUUID();
    const email = `${role}-${companyId}@test.mn`;
    await pool.query(
      `INSERT INTO mt_user (user_id, company_id, email, password_hash, first_name, last_name, role, email_verified_at)
       VALUES ($1, $2, $3, 'x', $4, 'Тест', $5, now())`,
      [userId, companyId, email, role, role]
    );
    users[role] = { userId, email };
  }
  return {
    companyId,
    users,
    cleanup: async () => {
      await pool.query('DELETE FROM mt_company WHERE company_id = $1', [companyId]);
    },
  };
}

// Тухайн хэрэглэгчээр нэвтэрсэн session cookie үүсгэнэ (lib/session.ts-ийн createSession)
export async function loginAs(company: TestCompany, role: 'admin' | 'manager' | 'employee') {
  cookieJar.clear();
  const { createSession } = await import('@/src/lib/session');
  await createSession({ userId: company.users[role].userId, companyId: company.companyId });
}

export function logout() {
  cookieJar.clear();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- route-ийн params төрөл бүр өөр
type Handler = (request: Request, ctx: any) => Promise<Response>;

// Route handler-ийг дуудаж { status, body } буцаана
export async function call(
  handler: Handler | (() => Promise<Response>),
  { method = 'GET', url = 'http://localhost/api/test', body, params = {} }: { method?: string; url?: string; body?: unknown; params?: Record<string, string> } = {}
) {
  const request = new Request(url, {
    method,
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const response = await (handler as Handler)(request, { params: Promise.resolve(params) });
  const text = await response.text();
  let json: unknown = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- тестэд хариуг чөлөөтэй уншина
  return { status: response.status, body: json as any };
}
