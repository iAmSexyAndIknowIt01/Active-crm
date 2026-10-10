// Хувь хүн харилцагчийн (mt_customer) хүйс, төрсөн огнооны шалгалт.
// Клиент (форм) болон API хоёуланд ашиглагдана.

export const GENDERS = ['Эрэгтэй', 'Эмэгтэй'] as const;
export type Gender = (typeof GENDERS)[number];

export const BIRTH_DATE_MIN = '1900-01-01';

export function isGender(value: unknown): value is Gender {
  return typeof value === 'string' && (GENDERS as readonly string[]).includes(value);
}

// Өнөөдрийн огноо "YYYY-MM-DD" хэлбэрээр (серверт Улаанбаатарын цагаар, клиентэд хөтчийн цагаар)
export function todayIsoDate(timeZone?: string) {
  return new Date().toLocaleDateString('sv-SE', timeZone ? { timeZone } : undefined);
}

// Хоосон бол null (төрсөн огноо заавал биш). Алдаатай бол { error } буцаана.
export function parseBirthDate(value: unknown): { value: string | null } | { error: string } {
  if (value === null || value === undefined || value === '') return { value: null };

  const text = typeof value === 'string' ? value.trim() : '';
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) return { error: 'Төрсөн огноо буруу байна (ЖЖЖЖ-СС-ӨӨ).' };

  // 2023-02-30 гэх мэт байхгүй огноог хүлээн авахгүй
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return { error: 'Төрсөн огноо буруу байна.' };
  }

  if (text < BIRTH_DATE_MIN) return { error: `Төрсөн огноо ${BIRTH_DATE_MIN}-ээс хойш байх ёстой.` };
  if (text > todayIsoDate('Asia/Ulaanbaatar')) return { error: 'Төрсөн огноо ирээдүйн огноо байж болохгүй.' };

  return { value: text };
}

// "YYYY-MM-DD" төрсөн огнооноос өнөөдрийн байдлаарх нас
export function calcAge(birthDate: string | null | undefined): number | null {
  if (!birthDate) return null;
  const [year, month, day] = birthDate.split('-').map(Number);
  if (!year || !month || !day) return null;

  const [ty, tm, td] = todayIsoDate().split('-').map(Number);
  let age = ty - year;
  if (tm < month || (tm === month && td < day)) age--;
  return age >= 0 ? age : null;
}
