import { isGender, parseBirthDate } from './customer-fields';

// Харилцагч гараар нэмэх / засах үеийн оролтын шалгалт (API болон клиент хоёуланд ашиглана).
// Бүх текстийг trim хийж, хоосон бол null болгоно. Уртын хязгаар нь DB-ийн баганатай тохирно.

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// +976, зай, зураас, хаалт зөвшөөрнө; 6-15 цифр
const PHONE_RE = /^\+?[\d\s()-]+$/;

export interface IndividualInput {
  first_name: string;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  male: string;
  birth_date: string | null;
}

export interface CompanyInput {
  name: string;
  tax_number: string;
  email: string | null;
  phone: string | null;
  address: string | null;
}

type Result<T> = { value: T } | { error: string };

function clean(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text === '' ? null : text;
}

function checkLength(label: string, value: string | null, max: number): string | null {
  return value && value.length > max ? `${label} хэт урт байна (${max} тэмдэгтээс ихгүй).` : null;
}

function checkContact(email: string | null, phone: string | null): string | null {
  if (email && (!EMAIL_RE.test(email) || email.length > 255)) return 'Имэйл хаяг буруу байна.';
  if (phone) {
    const digits = phone.replace(/\D/g, '').length;
    if (!PHONE_RE.test(phone) || digits < 6 || digits > 15) return 'Утасны дугаар буруу байна.';
  }
  return null;
}

export function validateIndividualInput(body: Record<string, unknown>): Result<IndividualInput> {
  const first_name = clean(body.first_name);
  const last_name = clean(body.last_name);
  const email = clean(body.email)?.toLowerCase() ?? null;
  const phone = clean(body.phone);
  const address = clean(body.address);

  if (!first_name) return { error: 'Хувь хүний нэрийг оруулна уу.' };
  const lengthError =
    checkLength('Нэр', first_name, 100) ?? checkLength('Овог', last_name, 100) ?? checkLength('Хаяг', address, 1000);
  if (lengthError) return { error: lengthError };
  const contactError = checkContact(email, phone);
  if (contactError) return { error: contactError };

  // Хүйсийг заавал сонгоно (өмнө нь хоосон бол 'Эрэгтэй' гэж хадгалдаг байсан нь буруу өгөгдөл үүсгэж байв)
  if (!isGender(body.male)) return { error: 'Хүйсээ сонгоно уу (Эрэгтэй эсвэл Эмэгтэй).' };
  const birthDate = parseBirthDate(body.birth_date);
  if ('error' in birthDate) return { error: birthDate.error };

  return { value: { first_name, last_name, email, phone, address, male: body.male, birth_date: birthDate.value } };
}

export function validateCompanyInput(body: Record<string, unknown>): Result<CompanyInput> {
  const name = clean(body.name);
  const tax_number = clean(body.tax_number);
  const email = clean(body.email)?.toLowerCase() ?? null;
  const phone = clean(body.phone);
  const address = clean(body.address);

  if (!name || !tax_number) return { error: 'Компанийн нэр болон регистр / татварын дугаарыг оруулна уу.' };
  const lengthError =
    checkLength('Компанийн нэр', name, 255) ??
    checkLength('Регистр / татварын дугаар', tax_number, 50) ??
    checkLength('Хаяг', address, 1000);
  if (lengthError) return { error: lengthError };
  const contactError = checkContact(email, phone);
  if (contactError) return { error: contactError };

  return { value: { name, tax_number, email, phone, address } };
}
