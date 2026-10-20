import { describe, expect, it } from 'vitest';
import { cellToString, guessColumnMapping, parseCsv, validateImportRow } from '@/src/lib/customer-import';

describe('guessColumnMapping', () => {
  it('matches Mongolian and English headers', () => {
    expect(guessColumnMapping('individual', ['Овог', 'Нэр', 'Утасны дугаар', 'Email', 'Хүйс'])).toMatchObject({
      last_name: 0,
      first_name: 1,
      phone: 2,
      email: 3,
      male: 4,
      address: -1,
    });
  });

  it('maps a combined "Овог нэр" column to the first name', () => {
    expect(guessColumnMapping('individual', ['Овог нэр', 'Утас'])).toMatchObject({ first_name: 0, last_name: -1, phone: 1 });
  });

  it('does not assign one column to two fields', () => {
    const mapping = guessColumnMapping('company', ['Нэр', 'Регистр']);
    expect(mapping).toMatchObject({ name: 0, tax_number: 1 });
  });
});

describe('validateImportRow', () => {
  it('normalizes an individual row', () => {
    expect(
      validateImportRow('individual', { first_name: 'Дорж Сүхбат', phone: '99112233', email: 'A@B.MN', male: 'эр', birth_date: '1990.05.21' })
    ).toEqual({
      row: {
        first_name: 'Сүхбат',
        last_name: 'Дорж',
        phone: '99112233',
        email: 'a@b.mn',
        address: null,
        male: 'Эрэгтэй',
        birth_date: '1990-05-21',
      },
    });
  });

  it('rejects rows with missing names or invalid values', () => {
    expect(validateImportRow('individual', { phone: '99112233' })).toHaveProperty('error');
    expect(validateImportRow('individual', { first_name: 'Бат', email: 'bad' })).toHaveProperty('error');
    expect(validateImportRow('individual', { first_name: 'Бат', male: 'x' })).toHaveProperty('error');
    expect(validateImportRow('company', { name: 'ХХК' })).toHaveProperty('error');
  });

  it('accepts a company row', () => {
    expect(validateImportRow('company', { name: 'Жишээ ХХК', tax_number: ' 1234567 ' })).toEqual({
      row: { name: 'Жишээ ХХК', tax_number: '1234567', phone: null, email: null, address: null },
    });
  });
});

describe('parseCsv', () => {
  it('handles BOM, quotes, escaped quotes and CRLF', () => {
    expect(parseCsv('﻿Нэр,Тайлбар\r\n"Бат, Болд","Тэр ""сайн"" хүн"\r\n')).toEqual([
      ['Нэр', 'Тайлбар'],
      ['Бат, Болд', 'Тэр "сайн" хүн'],
    ]);
  });

  it('detects semicolon and tab delimiters and skips blank lines', () => {
    expect(parseCsv('a;b\n1;2\n\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
    expect(parseCsv('a\tb\n1\t2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });
});

describe('cellToString', () => {
  it('formats Excel cell values', () => {
    expect(cellToString(99112233)).toBe('99112233');
    expect(cellToString(new Date(Date.UTC(1990, 4, 21)))).toBe('1990-05-21');
    expect(cellToString(null)).toBe('');
    expect(cellToString('  x ')).toBe('x');
  });
});
