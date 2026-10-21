import { describe, expect, it } from 'vitest';
import { computeSubscription } from '@/src/lib/plans';
import { canAccessPath, homePathFor, normalizeRole } from '@/src/lib/roles';

const NOW = Date.parse('2026-10-21T00:00:00Z');
const days = (n: number) => new Date(NOW + n * 86_400_000).toISOString();

describe('computeSubscription', () => {
  it('uses the paid plan while it lasts, then the trial, then expires', () => {
    expect(computeSubscription({ plan: 'standard', trial_ends_at: days(-30), paid_until: days(10) }, NOW)).toMatchObject({
      plan: 'standard',
      status: 'active',
      daysLeft: 10,
      limits: { users: 3, customers: 1000, sms: false },
    });
    expect(computeSubscription({ plan: 'trial', trial_ends_at: days(3), paid_until: null }, NOW)).toMatchObject({
      plan: 'trial',
      status: 'trial',
      daysLeft: 3,
      limits: { users: null, sms: true },
    });
    expect(computeSubscription({ plan: 'pro', trial_ends_at: days(-20), paid_until: days(-1) }, NOW)).toMatchObject({
      status: 'expired',
      daysLeft: 0,
    });
  });
});

describe('roles', () => {
  it('normalizes unknown roles to employee', () => {
    expect(normalizeRole('Manager ')).toBe('manager');
    expect(normalizeRole('owner')).toBe('employee');
  });

  it('limits dashboard pages per role', () => {
    expect(canAccessPath('admin', '/dashboard/audit')).toBe(true);
    expect(canAccessPath('manager', '/dashboard/customers/123')).toBe(true);
    expect(canAccessPath('manager', '/dashboard/employees')).toBe(false);
    expect(canAccessPath('manager', '/dashboard/customersX')).toBe(false);
    expect(canAccessPath('employee', '/dashboard')).toBe(false);
    expect(canAccessPath('employee', '/dashboard/workshop/1')).toBe(true);
    expect(homePathFor('employee')).toBe('/dashboard/workshop');
  });
});
