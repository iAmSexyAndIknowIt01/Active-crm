import { describe, expect, it } from 'vitest';
import { validatePassword } from '@/src/lib/password';

describe('validatePassword', () => {
  it('accepts letters plus digits, 8+ characters', () => {
    expect(validatePassword('nuuts123')).toBeNull();
    expect(validatePassword('Нууцүг12')).toBeNull();
  });

  it('rejects short, letter-only, digit-only and over-72-byte passwords', () => {
    expect(validatePassword('ab12')).not.toBeNull();
    expect(validatePassword('abcdefgh')).not.toBeNull();
    expect(validatePassword('12345678')).not.toBeNull();
    expect(validatePassword('я1'.repeat(30))).not.toBeNull(); // 90 байт
    expect(validatePassword(undefined)).not.toBeNull();
  });
});
