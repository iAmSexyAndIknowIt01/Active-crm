import { beforeAll, describe, expect, it } from 'vitest';
import { checkVerificationToken, issueVerificationToken, parseVerificationToken } from '@/src/lib/email-verification';

const USER = '11111111-1111-1111-1111-111111111111';

describe('email verification token', () => {
  beforeAll(() => {
    process.env.SESSION_SECRET ??= 'test-secret-for-verification-0123456789';
  });

  it('accepts a fresh token for the same email', () => {
    const parsed = parseVerificationToken(issueVerificationToken(USER, 'a@b.mn', 1_000))!;
    expect(checkVerificationToken(parsed, 'A@B.mn', 2_000)).toBe('ok');
  });

  it('rejects other emails, tampering and expired tokens', () => {
    const token = issueVerificationToken(USER, 'a@b.mn', 1_000);
    const parsed = parseVerificationToken(token)!;
    expect(checkVerificationToken(parsed, 'other@b.mn', 2_000)).toBe('invalid');
    expect(checkVerificationToken({ ...parsed, expires: parsed.expires + 1 }, 'a@b.mn', 2_000)).toBe('invalid');
    expect(checkVerificationToken(parsed, 'a@b.mn', parsed.expires + 1)).toBe('expired');
    expect(parseVerificationToken('garbage')).toBeNull();
  });
});
