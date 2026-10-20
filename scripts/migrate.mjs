// db/migrations доторх SQL файлуудыг нэрийн дарааллаар ажиллуулна.
// Ажилласан файлыг schema_migrations хүснэгтэд тэмдэглэж, дараагийн удаа алгасна.
//
//   npm run db:migrate            — шинэ migration-уудыг ажиллуулна
//   npm run db:migrate -- --list  — аль нь ажилласан / хүлээгдэж байгааг харуулна
//
// DATABASE_URL (.env.local-оос уншина) шаардлагатай. Локал / CI-ийн PostgreSQL-д DATABASE_SSL=false.
// Migration бүр өөрөө BEGIN/COMMIT-тэй бөгөөд дахин ажиллуулахад аюулгүй (IF NOT EXISTS) бичигдсэн.
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'db', 'migrations');
const listOnly = process.argv.includes('--list');

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL тохируулаагүй байна.');
  process.exit(1);
}

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false },
});

await client.connect();
try {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name       varchar(255) PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await client.query('ALTER TABLE schema_migrations ENABLE ROW LEVEL SECURITY');

  const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort();
  const { rows } = await client.query('SELECT name FROM schema_migrations');
  const applied = new Set(rows.map((r) => r.name));
  const pending = files.filter((f) => !applied.has(f));

  if (listOnly) {
    for (const f of files) console.log(`${applied.has(f) ? '✔' : '·'} ${f}`);
    console.log(`\n${pending.length} migration хүлээгдэж байна.`);
  } else if (pending.length === 0) {
    console.log('Шинэ migration алга.');
  } else {
    for (const file of pending) {
      process.stdout.write(`→ ${file} ... `);
      const sql = await readFile(path.join(dir, file), 'utf8');
      try {
        await client.query(sql);
      } catch (error) {
        // Файл дотор нээгдсэн transaction-ыг хаана
        await client.query('ROLLBACK').catch(() => {});
        console.log('АЛДАА');
        console.error(error.message);
        process.exitCode = 1;
        break;
      }
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
      console.log('OK');
    }
  }
} finally {
  await client.end();
}
