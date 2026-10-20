import { beforeAll, describe, expect, it } from 'vitest';
import { MAX_AGE_MS, MIN_FILL_MS, checkFormToken, issueFormToken } from '@/src/lib/form-token';

const TEMPLATE = '11111111-1111-1111-1111-111111111111';

describe('form token', () => {
  beforeAll(() => {
    process.env.SESSION_SECRET ??= 'test-secret-for-form-token-0123456789';
  });

  it('accepts a token after the minimum fill time', () => {
    const token = issueFormToken(TEMPLATE, 1_000_000);
    expect(checkFormToken(token, TEMPLATE, 1_000_000 + MIN_FILL_MS)).toBe('ok');
  });

  it('rejects submissions that are too fast or too old', () => {
    const token = issueFormToken(TEMPLATE, 1_000_000);
    expect(checkFormToken(token, TEMPLATE, 1_000_000 + 500)).toBe('too_fast');
    expect(checkFormToken(token, TEMPLATE, 1_000_000 + MAX_AGE_MS + 1)).toBe('expired');
  });

  it('rejects missing, forged and other-template tokens', () => {
    const token = issueFormToken(TEMPLATE, 1_000_000);
    expect(checkFormToken(undefined, TEMPLATE)).toBe('invalid');
    expect(checkFormToken('1000000.forged', TEMPLATE)).toBe('invalid');
    expect(checkFormToken(token.replace(/^\d+/, '999'), TEMPLATE)).toBe('invalid');
    expect(checkFormToken(token, '22222222-2222-2222-2222-222222222222', 1_000_000 + MIN_FILL_MS)).toBe('invalid');
  });
});
