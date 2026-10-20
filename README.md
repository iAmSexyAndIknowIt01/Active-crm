# Active CRM

Жижиг, дунд бизнесүүдэд (авто засвар, үсчин, үйлчилгээ, худалдаа) зориулсан харилцагчийн бүртгэл,
цаг захиалга, ажлын урсгалын систем. Next.js (App Router) + PostgreSQL (Supabase).

Гол боломжууд:

- **QR анкет** — үйлчлүүлэгч утсаараа анкет бөглөхөд утас/имэйлээр нь тулгаж харилцагчийн бүртгэлд автоматаар нэмнэ
- **Файлаас оруулах** — Excel (.xlsx) / CSV-ээс харилцагчдыг бөөнөөр оруулна (Өгөгдөл → Файлаас оруулах)
- **Автомат сануулга** — маргаашийн цаг захиалга болон удаан ирээгүй харилцагчдад SMS / имэйл (Тохиргоо → Сануулга)
- Харилцагч, цаг захиалга, ажил, үйлчилгээ, ажилчид, тайлан шинжилгээ, CSV экспорт

## Локалд ажиллуулах

```bash
npm install
cp .env.example .env.local   # утгуудыг бөглөнө (доорх хүснэгтийг үзнэ үү)
npm run db:migrate           # мэдээллийн сангийн хүснэгтүүдийг үүсгэнэ / шинэчилнэ
npm run dev                  # http://localhost:3000
```

Локал PostgreSQL ашиглах бол: `DATABASE_URL=postgres://postgres:postgres@localhost:5432/activecrm`, `DATABASE_SSL=false`.

## Мэдээллийн сан (migration)

`db/migrations/` доторх SQL файлууд нэрийн дарааллаар ажиллана. `npm run db:migrate` нь ажилласан файлуудыг
`schema_migrations` хүснэгтэд тэмдэглэж, зөвхөн шинийг нь ажиллуулна (`npm run db:migrate -- --list` — төлөв харах).

- `00000000_baseline_schema.sql` — анх Supabase UI-аар үүсгэсэн үндсэн хүснэгтүүд. Аппын кодонд ашиглагдаж буй
  баганаас сэргээн бичсэн тул production-той зөрүү байж болзошгүй; шалгах бол
  `pg_dump --schema-only --no-owner "$DATABASE_URL"`-ийн гаралттай харьцуулна.
- Бүх migration дахин ажиллуулахад аюулгүй (`IF NOT EXISTS`) тул өмнө нь гараар ажиллуулсан production DB дээр
  `npm run db:migrate`-ийг анх удаа ажиллуулахад өөрчлөгдсөн зүйлгүй файлууд зүгээр л тэмдэглэгдэнэ.
- Шинэ кодыг deploy хийхээс **өмнө** migration-аа ажиллуулна.
- `db/scripts/` — нэг удаагийн өгөгдөл цэвэрлэх скриптүүд (migration биш, гараар ажиллуулна).

## Орчны хувьсагч (.env.local)

| Хувьсагч | Тайлбар |
|---|---|
| `DATABASE_URL` | PostgreSQL (Supabase) холболт |
| `DATABASE_SSL` | Локал / CI-ийн SSL-гүй PostgreSQL-д `false`. Бусад үед (Supabase) SSL-ээр холбогдоно |
| `DB_POOL_MAX` | Нэг процессын DB холболтын дээд тоо (анхдагч 5) |
| `SESSION_SECRET` | Session JWT болон нууц үг сэргээх кодын HMAC түлхүүр (32+ тэмдэгт санамсаргүй) |
| `GMAIL_USER`, `GMAIL_APP_PASSWORD` | Имэйл илгээх (Gmail SMTP, nodemailer). `GMAIL_APP_PASSWORD` нь Google бүртгэлийн App Password. Тохируулаагүй бол dev-д console-д хэвлэнэ |
| `CRON_SECRET` | Өдөр бүрийн сануулгын cron (`/api/cron/reminders`, `vercel.json`)-ийг хамгаалах нууц түлхүүр. Vercel нь `Authorization: Bearer <CRON_SECRET>` толгойгоор дууддаг |
| `SMS_API_URL`, `SMS_API_TOKEN`, `SMS_SENDER` | Сануулгыг SMS-ээр илгээх gateway (заавал биш). `SMS_API_URL` руу `{"to","text","from"}` JSON POST хийнэ, токеныг `Authorization: Bearer`-ээр илгээнэ. Gateway өөр формат шаарддаг бол `src/lib/sms.ts`-ийг тохируулна. Тохируулаагүй бол зөвхөн имэйлээр илгээнэ |
| `TRUSTED_PROXY_HOPS` | Апп хэдэн итгэмжлэгдсэн proxy / load balancer-ийн ард ажиллаж байгаа (анхдагч 1). Rate limit-д клиентийн IP-г `X-Forwarded-For`-ийн баруун талаас энэ тоогоор авна, ингэснээр IP-г хуурах боломжгүй. Proxy-гүй бол `0`. Vercel дээр хамаарахгүй |

## Deploy (Vercel)

- Орчны хувьсагчдыг Vercel төслийн тохиргоонд оруулна. `DATABASE_URL` нь Supabase-ийн transaction pooler (порт 6543).
- `vercel.json` дахь cron өдөр бүр 01:00 UTC (Улаанбаатарын 09:00)-д `/api/cron/reminders`-ийг дуудна; `CRON_SECRET` заавал.
