This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Орчны хувьсагч (.env.local)

| Хувьсагч | Тайлбар |
|---|---|
| `DATABASE_URL` | PostgreSQL (Supabase) холболт |
| `DB_POOL_MAX` | Нэг процессын DB холболтын дээд тоо (анхдагч 5) |
| `SESSION_SECRET` | Session JWT болон нууц үг сэргээх кодын HMAC түлхүүр (32+ тэмдэгт санамсаргүй) |
| `GMAIL_USER`, `GMAIL_APP_PASSWORD` | Имэйл илгээх (Gmail SMTP, nodemailer). `GMAIL_APP_PASSWORD` нь Google бүртгэлийн App Password. Тохируулаагүй бол dev-д console-д хэвлэнэ |
| `CRON_SECRET` | Өдөр бүрийн сануулгын cron (`/api/cron/reminders`, `vercel.json`)-ийг хамгаалах нууц түлхүүр. Vercel нь `Authorization: Bearer <CRON_SECRET>` толгойгоор дууддаг |
| `SMS_API_URL`, `SMS_API_TOKEN`, `SMS_SENDER` | Сануулгыг SMS-ээр илгээх gateway (заавал биш). `SMS_API_URL` руу `{"to","text","from"}` JSON POST хийнэ, токеныг `Authorization: Bearer`-ээр илгээнэ. Gateway өөр формат шаарддаг бол `src/lib/sms.ts`-ийг тохируулна. Тохируулаагүй бол зөвхөн имэйлээр илгээнэ |
| `TRUSTED_PROXY_HOPS` | Апп хэдэн итгэмжлэгдсэн proxy / load balancer-ийн ард ажиллаж байгаа (анхдагч 1). Rate limit-д клиентийн IP-г `X-Forwarded-For`-ийн баруун талаас энэ тоогоор авна, ингэснээр IP-г хуурах боломжгүй. Proxy-гүй бол `0`. Vercel дээр хамаарахгүй |

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
