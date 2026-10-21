import 'server-only';
import { unstable_cache } from 'next/cache';
import { pool } from './db';
import { PLAN_INFO } from './plans';

// Нүүр хуудас болон багцын тохиргоо (mt_site_content). Платформын админ засна.
export interface SiteContent {
  testimonial: { enabled: boolean; quote: string; author: string; role: string };
  contact: { phone: string; email: string; address: string; website: string };
  plan_prices: { standard: number; pro: number };
  bank: { bank_name: string; account_number: string; account_holder: string; note: string };
}

export const SITE_CONTENT_DEFAULTS: SiteContent = {
  // Бодит сэтгэгдэл оруулах хүртэл нүүр хуудсанд харагдахгүй
  testimonial: { enabled: false, quote: '', author: '', role: '' },
  contact: { phone: '', email: '', address: '', website: '' },
  plan_prices: { standard: PLAN_INFO.standard.defaultPrice, pro: PLAN_INFO.pro.defaultPrice },
  bank: { bank_name: '', account_number: '', account_holder: '', note: '' },
};

export type SiteContentKey = keyof SiteContent;
export const SITE_CONTENT_KEYS = Object.keys(SITE_CONTENT_DEFAULTS) as SiteContentKey[];

// Бүх контентыг анхдагч утгатай нийлүүлж буцаана. DB алдаатай үед анхдагч утга (нүүр хуудас унахгүй).
export async function getSiteContent(): Promise<SiteContent> {
  const content = structuredClone(SITE_CONTENT_DEFAULTS);
  try {
    const { rows } = await pool.query('SELECT key, value FROM mt_site_content');
    for (const row of rows) {
      if (row.key in content) {
        const key = row.key as SiteContentKey;
        content[key] = { ...content[key], ...row.value } as never;
      }
    }
  } catch (error) {
    console.error('Site content load failed:', error);
  }
  return content;
}

// Нүүр хуудас, footer-т: 5 минут кэшлэнэ; хадгалахад 'site-content' tag-аар шууд шинэчлэгдэнэ
export const SITE_CONTENT_TAG = 'site-content';
export const getCachedSiteContent = unstable_cache(getSiteContent, ['site-content'], { tags: [SITE_CONTENT_TAG], revalidate: 300 });

export async function saveSiteContent<K extends SiteContentKey>(key: K, value: SiteContent[K], updatedBy: string) {
  await pool.query(
    `INSERT INTO mt_site_content (key, value, updated_by, updated_at) VALUES ($1, $2, $3, now())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = now()`,
    [key, JSON.stringify(value), updatedBy]
  );
}

// Оролтыг тухайн түлхүүрийн бүтцэд оруулж, текстийг тайрна
export function sanitizeSiteContent<K extends SiteContentKey>(key: K, input: unknown): SiteContent[K] | null {
  if (!input || typeof input !== 'object') return null;
  const raw = input as Record<string, unknown>;
  const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
  const price = (v: unknown) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 && n <= 100_000_000 ? Math.round(n) : null;
  };

  switch (key) {
    case 'testimonial':
      return { enabled: raw.enabled === true, quote: text(raw.quote, 600), author: text(raw.author, 100), role: text(raw.role, 150) } as SiteContent[K];
    case 'contact':
      return { phone: text(raw.phone, 50), email: text(raw.email, 150), address: text(raw.address, 300), website: text(raw.website, 150) } as SiteContent[K];
    case 'plan_prices': {
      const standard = price(raw.standard);
      const pro = price(raw.pro);
      return standard === null || pro === null ? null : ({ standard, pro } as SiteContent[K]);
    }
    case 'bank':
      return {
        bank_name: text(raw.bank_name, 100),
        account_number: text(raw.account_number, 50),
        account_holder: text(raw.account_holder, 150),
        note: text(raw.note, 300),
      } as SiteContent[K];
  }
  return null;
}
