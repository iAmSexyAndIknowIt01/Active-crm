import { describe, expect, it } from 'vitest';
import { buildWorkFilter } from '@/src/lib/work-filters';

const COMPANY = '11111111-1111-1111-1111-111111111111';

describe('buildWorkFilter', () => {
  it('only scopes by company when no filters are given', () => {
    const f = buildWorkFilter(COMPANY, {});
    expect(f.where).toBe('w.company_id = $1');
    expect(f.values).toEqual([COMPANY]);
    expect(f.orderBy).toMatch(/^w\.create_date DESC/);
  });

  it('passes every value as a parameter and escapes LIKE wildcards', () => {
    const f = buildWorkFilter(COMPANY, { q: "100%_ x'y", status: 'pending', priceMin: '1000', sort: 'price_asc' });
    expect(f.values).toEqual([COMPANY, '%100\\%\\_%', "%x'y%", 'pending', 1000]);
    expect(f.where).not.toContain("x'y");
    expect(f.orderBy).toMatch(/^COALESCE\(w\.price, 0\) ASC/);
  });

  it('ignores unknown or malformed values', () => {
    const f = buildWorkFilter(COMPANY, {
      status: "x'; drop table",
      priority: 'urgent',
      employee: 'abc',
      customer: 'i:not-a-uuid',
      service: '1;drop',
      dueFrom: '2026-13',
      sort: '1; drop',
    });
    expect(f.where).toBe('w.company_id = $1');
    expect(f.values).toEqual([COMPANY]);
  });

  it('builds employee, customer and due conditions', () => {
    const id = '22222222-2222-2222-2222-222222222222';
    expect(buildWorkFilter(COMPANY, { employee: 'none' }).where).toContain('w.assigned_employee IS NULL');
    expect(buildWorkFilter(COMPANY, { customer: `c:${id}` }).values).toEqual([COMPANY, id]);
    expect(buildWorkFilter(COMPANY, { due: 'overdue' }).where).toContain("NOT IN ('completed', 'cancelled')");
    const custom = buildWorkFilter(COMPANY, { due: 'custom', dueFrom: '2026-01-01', dueTo: '2026-01-31' });
    expect(custom.values).toEqual([COMPANY, '2026-01-01', '2026-01-31']);
  });
});
