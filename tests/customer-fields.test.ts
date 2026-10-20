import { describe, expect, it, vi, afterEach } from 'vitest';
import { calcAge, isGender, parseBirthDate } from '@/src/lib/customer-fields';

describe('isGender', () => {
  it('accepts only the two allowed values', () => {
    expect(isGender('Эрэгтэй')).toBe(true);
    expect(isGender('Эмэгтэй')).toBe(true);
    expect(isGender('Э')).toBe(false);
    expect(isGender(null)).toBe(false);
  });
});

describe('parseBirthDate', () => {
  it('treats empty values as no birth date', () => {
    expect(parseBirthDate('')).toEqual({ value: null });
    expect(parseBirthDate(null)).toEqual({ value: null });
    expect(parseBirthDate(undefined)).toEqual({ value: null });
  });

  it('accepts a valid past date', () => {
    expect(parseBirthDate('1990-05-21')).toEqual({ value: '1990-05-21' });
  });

  it('rejects malformed, impossible, too old and future dates', () => {
    expect(parseBirthDate('21/05/1990')).toHaveProperty('error');
    expect(parseBirthDate('2023-02-30')).toHaveProperty('error');
    expect(parseBirthDate('1899-12-31')).toHaveProperty('error');
    expect(parseBirthDate('2999-01-01')).toHaveProperty('error');
  });
});

describe('calcAge', () => {
  afterEach(() => vi.useRealTimers());

  it('counts a birthday that has not happened yet this year', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-20T12:00:00'));
    expect(calcAge('1990-05-21')).toBe(35);
    expect(calcAge('1990-05-20')).toBe(36);
  });

  it('returns null for missing input', () => {
    expect(calcAge(null)).toBeNull();
    expect(calcAge('')).toBeNull();
  });
});
