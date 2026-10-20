import { describe, expect, it } from 'vitest';
import { DEFAULT_RESERVATION_TEMPLATE, renderReminderTemplate } from '@/src/lib/reminder-template';

describe('renderReminderTemplate', () => {
  it('fills placeholders', () => {
    expect(renderReminderTemplate('{name}, {date} {time}', { name: 'Бат', date: '2026-10-21', time: '10:30' })).toBe(
      'Бат, 2026-10-21 10:30'
    );
  });

  it('removes empty values and tidies spacing before punctuation', () => {
    expect(renderReminderTemplate('Холбогдох: {phone}.', { phone: '' })).toBe('Холбогдох:.');
    expect(renderReminderTemplate('Сайн уу {name} !', { name: null })).toBe('Сайн уу!');
  });

  it('leaves unknown placeholders untouched', () => {
    expect(renderReminderTemplate('{unknown} {name}', { name: 'Бат' })).toBe('{unknown} Бат');
  });

  it('renders the default reservation template', () => {
    const text = renderReminderTemplate(DEFAULT_RESERVATION_TEMPLATE, {
      name: 'Бат',
      company: 'Active',
      phone: '77000000',
      date: '2026-10-21',
      time: '10:30',
      service: 'Тос солих',
    });
    expect(text).toContain('Бат');
    expect(text).toContain('2026-10-21 10:30');
    expect(text).not.toMatch(/\{\w+\}/);
  });
});
