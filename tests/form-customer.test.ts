import { describe, expect, it } from 'vitest';
import {
  extractCustomerFields,
  inferCustomerField,
  normalizePhone,
  resolveCustomerField,
  splitFullName,
} from '@/src/lib/form-customer';

describe('inferCustomerField', () => {
  it.each([
    ['Утасны дугаар', 'phone'],
    ['Имэйл хаяг', 'email'],
    ['И-мэйл', 'email'],
    ['Овог, Нэр', 'full_name'],
    ['Таны нэр', 'full_name'],
    ['Овог', 'last_name'],
    ['Гэрийн хаяг', 'address'],
    ['Төрсөн огноо', 'birth_date'],
    ['Хүйс', 'gender'],
  ])('%s → %s', (label, field) => {
    expect(inferCustomerField(label)).toBe(field);
  });

  it('does not treat service or company names as the customer name', () => {
    expect(inferCustomerField('Үйлчилгээний нэр')).toBeNull();
    expect(inferCustomerField('Машины нэр')).toBeNull();
    expect(inferCustomerField('Үйлчилгээний төрөл')).toBeNull();
  });
});

describe('resolveCustomerField', () => {
  it('prefers an explicit mapping, including an explicit "none"', () => {
    expect(resolveCustomerField({ id: 1, label: 'Утас', maps_to: 'email' })).toBe('email');
    expect(resolveCustomerField({ id: 1, label: 'Утас', maps_to: '' })).toBeNull();
  });

  it('falls back to the label when no mapping was saved', () => {
    expect(resolveCustomerField({ id: 1, label: 'Утас' })).toBe('phone');
  });

  it('ignores unknown mapping values', () => {
    expect(resolveCustomerField({ id: 1, label: 'Утас', maps_to: 'password' })).toBeNull();
  });
});

describe('normalizePhone', () => {
  it('keeps only digits and drops the +976 country code', () => {
    expect(normalizePhone('+976 9911-2233')).toBe('99112233');
    expect(normalizePhone('97699112233')).toBe('99112233');
    expect(normalizePhone('9911 2233')).toBe('99112233');
    expect(normalizePhone(null)).toBe('');
  });
});

describe('splitFullName', () => {
  it('splits "Овог Нэр" with the family name first', () => {
    expect(splitFullName('Дорж Сүхбат')).toEqual({ last_name: 'Дорж', first_name: 'Сүхбат' });
    expect(splitFullName('Дорж, Сүхбат Бат')).toEqual({ last_name: 'Дорж', first_name: 'Сүхбат Бат' });
  });

  it('uses a single word as the first name', () => {
    expect(splitFullName('Сүхбат')).toEqual({ first_name: 'Сүхбат', last_name: null });
  });
});

describe('extractCustomerFields', () => {
  const questions = [
    { id: '1', label: 'Овог, Нэр', maps_to: 'full_name' },
    { id: '2', label: 'Утас', maps_to: 'phone' },
    { id: '3', label: 'Имэйл' },
    { id: '4', label: 'Хүйс', maps_to: 'gender' },
    { id: '5', label: 'Төрсөн огноо', maps_to: 'birth_date' },
    { id: '6', label: 'Үйлчилгээ', maps_to: '' },
  ];

  it('maps answers onto customer fields', () => {
    expect(
      extractCustomerFields(questions, {
        '1': ' Дорж Сүхбат ',
        '2': '99112233',
        '3': 'Suhee@Mail.MN',
        '4': 'Эрэгтэй',
        '5': '1990-05-21',
        '6': 'Тос солих',
      })
    ).toEqual({
      first_name: 'Сүхбат',
      last_name: 'Дорж',
      phone: '99112233',
      email: 'suhee@mail.mn',
      address: null,
      birth_date: '1990-05-21',
      male: 'Эрэгтэй',
    });
  });

  it('drops invalid email, gender and birth date instead of failing', () => {
    const result = extractCustomerFields(questions, { '1': 'Сүхбат', '3': 'not-an-email', '4': 'эр', '5': '2999-01-01' });
    expect(result.email).toBeNull();
    expect(result.male).toBeNull();
    expect(result.birth_date).toBeNull();
    expect(result.first_name).toBe('Сүхбат');
  });
});
