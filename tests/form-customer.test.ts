import { describe, expect, it } from 'vitest';
import { normalizePhone } from '@/src/lib/form-customer';

describe('normalizePhone', () => {
  it('keeps only digits and drops the +976 country code', () => {
    expect(normalizePhone('+976 9911-2233')).toBe('99112233');
    expect(normalizePhone('97699112233')).toBe('99112233');
    expect(normalizePhone('9911 2233')).toBe('99112233');
    expect(normalizePhone(null)).toBe('');
  });
});
