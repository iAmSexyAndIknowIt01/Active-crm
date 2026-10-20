import { Pool } from 'pg';
import { attachDatabasePool } from '@vercel/functions';

// Supabase pooler нь нэгэн зэрэг холболтын тоог хязгаарладаг (session mode: 15).
// Vercel дээр DATABASE_URL нь transaction mode (порт 6543) байх ёстой — session mode (5432)
// нь serverless instance бүрийн холболтыг барьж, хязгаарт хурдан хүрдэг (EMAXCONNSESSION).
// - Pool-ийг globalThis дээр хадгалснаар dev орчинд HMR бүрт шинэ Pool үүсэхгүй
// - max-аар нэг процесс хэдэн холболт эзлэхийг хязгаарлана (илүү query дараалалд орно).
//   Vercel дээр instance олон үүсдэг тул анхдагч утгыг бага байлгана
const defaultMax = process.env.VERCEL ? 2 : 5;

export const pool =
  globalForDb().pgPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    // Supabase SSL шаарддаг. Локал / CI-ийн PostgreSQL-д DATABASE_SSL=false тохируулна
    ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false },
    max: Number(process.env.DB_POOL_MAX ?? defaultMax),
    idleTimeoutMillis: 5_000,
    connectionTimeoutMillis: 10_000,
  });

function globalForDb() {
  return globalThis as unknown as { pgPool?: Pool };
}

if (process.env.NODE_ENV !== 'production') {
  globalForDb().pgPool = pool;
}

// Vercel Fluid compute: instance түр зогсохоос өмнө сул холболтуудыг хааж, pooler-т буцаана
attachDatabasePool(pool);
