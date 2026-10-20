import { isGender, parseBirthDate } from './customer-fields';

// Excel / CSV файлаас харилцагч оруулах: талбарын тодорхойлолт, баганын нэрээр таних,
// мөр шалгах. Клиент (урьдчилан харах) болон API хоёуланд ашиглагдана.

export const IMPORT_MAX_ROWS = 2000;

export type ImportType = 'individual' | 'company';

export interface ImportField {
  key: string;
  label: string;
  required?: boolean;
  // Файлын баганын нэрийг таних түлхүүр үгс (жижиг үсгээр)
  aliases: string[];
}

export const IMPORT_FIELDS: Record<ImportType, ImportField[]> = {
  individual: [
    { key: 'last_name', label: 'Овог', aliases: ['овог', 'last name', 'lastname', 'surname'] },
    { key: 'first_name', label: 'Нэр', required: true, aliases: ['нэр', 'first name', 'firstname', 'name'] },
    { key: 'phone', label: 'Утас', aliases: ['утас', 'утасны дугаар', 'гар утас', 'phone', 'mobile', 'tel'] },
    { key: 'email', label: 'Имэйл', aliases: ['имэйл', 'и-мэйл', 'email', 'e-mail', 'mail'] },
    { key: 'address', label: 'Хаяг', aliases: ['хаяг', 'address'] },
    { key: 'male', label: 'Хүйс', aliases: ['хүйс', 'gender', 'sex'] },
    { key: 'birth_date', label: 'Төрсөн огноо', aliases: ['төрсөн огноо', 'төрсөн', 'birth date', 'birthday', 'dob'] },
  ],
  company: [
    { key: 'name', label: 'Байгууллагын нэр', required: true, aliases: ['байгууллагын нэр', 'компанийн нэр', 'нэр', 'company', 'name'] },
    { key: 'tax_number', label: 'Регистр / татварын дугаар', required: true, aliases: ['регистр', 'татварын дугаар', 'регистрийн дугаар', 'тд', 'tax number', 'tax', 'register'] },
    { key: 'phone', label: 'Утас', aliases: ['утас', 'утасны дугаар', 'phone', 'tel'] },
    { key: 'email', label: 'Имэйл', aliases: ['имэйл', 'и-мэйл', 'email', 'e-mail'] },
    { key: 'address', label: 'Хаяг', aliases: ['хаяг', 'address'] },
  ],
};

export function isImportType(value: unknown): value is ImportType {
  return value === 'individual' || value === 'company';
}

// Файлын толгой мөрөөс талбар бүрт тохирох баганын индексийг таамаглана (олдохгүй бол -1).
// Яг таарсныг эхэлж, дараа нь агуулсныг шалгана; нэг баганыг хоёр талбарт өгөхгүй.
export function guessColumnMapping(type: ImportType, headers: string[]): Record<string, number> {
  const normalized = headers.map((h) => h.trim().toLowerCase());
  const used = new Set<number>();
  const mapping: Record<string, number> = {};

  // "Овог нэр" гэх мэт нэг баганад бүтэн нэр байвал "Нэр" талбарт өгнө (мөр шалгахад салгана)
  if (type === 'individual') {
    const fullName = normalized.findIndex((h) => /овог.*нэр|нэр.*овог|бүтэн нэр|full name/.test(h));
    if (fullName >= 0) {
      mapping.first_name = fullName;
      used.add(fullName);
    }
  }

  for (const pass of ['exact', 'contains'] as const) {
    for (const field of IMPORT_FIELDS[type]) {
      if (mapping[field.key] !== undefined && mapping[field.key] >= 0) continue;
      const index = normalized.findIndex(
        (h, i) =>
          !used.has(i) &&
          field.aliases.some((alias) => (pass === 'exact' ? h === alias : h.includes(alias)))
      );
      mapping[field.key] = index;
      if (index >= 0) used.add(index);
    }
  }
  return mapping;
}

// Excel-ийн нүдний утгыг текст болгоно (огноо → YYYY-MM-DD, тоо → бүхэл тоо хэвээр)
export function cellToString(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return '';
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === 'number') return String(value);
  return String(value).trim();
}

const GENDER_ALIASES: Record<string, string> = {
  'эрэгтэй': 'Эрэгтэй',
  'эр': 'Эрэгтэй',
  'м': 'Эрэгтэй',
  male: 'Эрэгтэй',
  'эмэгтэй': 'Эмэгтэй',
  'эм': 'Эмэгтэй',
  'ж': 'Эмэгтэй',
  female: 'Эмэгтэй',
};

export interface IndividualImportRow {
  first_name: string;
  last_name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  male: string | null;
  birth_date: string | null;
}

export interface CompanyImportRow {
  name: string;
  tax_number: string;
  phone: string | null;
  email: string | null;
  address: string | null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function text(value: unknown, max: number): string | null {
  const s = typeof value === 'string' ? value.trim() : value == null ? '' : String(value).trim();
  return s ? s.slice(0, max) : null;
}

// Нэг мөрийг шалгаж, хадгалахад бэлэн хэлбэрт оруулна
export function validateImportRow(
  type: 'individual',
  raw: Record<string, unknown>
): { row: IndividualImportRow } | { error: string };
export function validateImportRow(
  type: 'company',
  raw: Record<string, unknown>
): { row: CompanyImportRow } | { error: string };
export function validateImportRow(
  type: ImportType,
  raw: Record<string, unknown>
): { row: IndividualImportRow | CompanyImportRow } | { error: string };
export function validateImportRow(type: ImportType, raw: Record<string, unknown>) {
  const email = text(raw.email, 255)?.toLowerCase() ?? null;
  if (email && !EMAIL_RE.test(email)) return { error: `Имэйл буруу байна: ${email}` };
  const phone = text(raw.phone, 50);
  const address = text(raw.address, 1000);

  if (type === 'company') {
    const name = text(raw.name, 255);
    const taxNumber = text(raw.tax_number, 50);
    if (!name) return { error: 'Байгууллагын нэр хоосон байна.' };
    if (!taxNumber) return { error: 'Регистр / татварын дугаар хоосон байна.' };
    return { row: { name, tax_number: taxNumber, phone, email, address } };
  }

  let firstName = text(raw.first_name, 100);
  let lastName = text(raw.last_name, 100);
  // "Овог Нэр" нэг баганад байвал салгана
  if (firstName && !lastName && /\s/.test(firstName)) {
    const parts = firstName.split(/\s+/);
    lastName = parts[0];
    firstName = parts.slice(1).join(' ');
  }
  if (!firstName) return { error: 'Нэр хоосон байна.' };

  let male: string | null = null;
  const genderText = text(raw.male, 20);
  if (genderText) {
    male = isGender(genderText) ? genderText : GENDER_ALIASES[genderText.toLowerCase()] ?? null;
    if (!male) return { error: `Хүйс буруу байна: ${genderText} (Эрэгтэй / Эмэгтэй)` };
  }

  let birthDate: string | null = null;
  const birthText = text(raw.birth_date, 30);
  if (birthText) {
    const parsed = parseBirthDate(birthText.replace(/[./]/g, '-'));
    if ('error' in parsed) return { error: `${parsed.error} (${birthText})` };
    birthDate = parsed.value;
  }

  return { row: { first_name: firstName, last_name: lastName, phone, email, address, male, birth_date: birthDate } };
}

// RFC 4180 маягийн CSV задлагч: хашилт доторх таслал, мөр шилжилт, "" escape-ийг дэмжинэ.
// Тусгаарлагчийг (таслал, цэг таслал, tab) эхний мөрөөс таамаглана.
export function parseCsv(input: string): string[][] {
  const textInput = input.replace(/^﻿/, '');
  const firstLine = textInput.split(/\r?\n/, 1)[0] ?? '';
  const delimiter = [',', ';', '\t'].reduce((best, d) =>
    firstLine.split(d).length > firstLine.split(best).length ? d : best
  );

  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < textInput.length; i++) {
    const ch = textInput[i];
    if (inQuotes) {
      if (ch === '"') {
        if (textInput[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && textInput[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  // Бүрэн хоосон мөрүүдийг хасна
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}
