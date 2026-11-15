import { describe, expect, it } from 'vitest';
import { DEFAULT_TEMPLATE, MAX_QUESTIONS, parseTemplateInput } from '@/src/lib/form-templates';

const question = (overrides: Record<string, unknown> = {}) => ({
  id: '1',
  label: 'Утасны дугаар',
  type: 'text',
  required: true,
  ...overrides,
});

describe('parseTemplateInput', () => {
  it('accepts the default template unchanged', () => {
    const result = parseTemplateInput(DEFAULT_TEMPLATE);
    expect(result).toEqual({ ok: true, value: DEFAULT_TEMPLATE });
  });

  it('trims text, drops empty description and any stored customer mapping', () => {
    const result = parseTemplateInput({
      title: '  Анкет  ',
      description: '   ',
      questions: [question({ id: 7, label: '  Нэр ', maps_to: 'phone', type: 'weird', required: 'yes' })],
    });
    expect(result).toEqual({
      ok: true,
      value: {
        title: 'Анкет',
        description: null,
        questions: [{ id: '7', label: 'Нэр', type: 'text', required: false }],
      },
    });
  });

  it('cleans select options and requires at least one', () => {
    const ok = parseTemplateInput({
      title: 'A',
      questions: [question({ type: 'select', options: [' Тос ', 'Тос', '', 5, 'Угаалга'] })],
    });
    expect(ok.ok && ok.value.questions[0].options).toEqual(['Тос', 'Угаалга']);

    const missing = parseTemplateInput({ title: 'A', questions: [question({ type: 'select', options: [] })] });
    expect(missing.ok).toBe(false);
  });

  it('accepts the long-answer, multi-select and rating types; option types need options', () => {
    const ok = parseTemplateInput({
      title: 'A',
      questions: [
        question({ id: '1', type: 'textarea' }),
        question({ id: '2', type: 'multiselect', options: ['Касс, банк', 'Цалин'] }),
        question({ id: '3', type: 'rating', options: ['1 - Муу', '2', '3 - Сайн', 'Хамаарахгүй'] }),
      ],
    });
    expect(ok.ok && ok.value.questions.map((q) => [q.type, q.options])).toEqual([
      ['textarea', undefined],
      ['multiselect', ['Касс, банк', 'Цалин']],
      ['rating', ['1 - Муу', '2', '3 - Сайн', 'Хамаарахгүй']],
    ]);
    expect(parseTemplateInput({ title: 'A', questions: [question({ type: 'multiselect' })] }).ok).toBe(false);
    expect(parseTemplateInput({ title: 'A', questions: [question({ type: 'rating' })] }).ok).toBe(false);
  });

  it.each([
    ['missing title', { title: ' ', questions: [question()] }],
    ['questions not an array', { title: 'A', questions: 'x' }],
    ['no questions', { title: 'A', questions: [] }],
    ['too many questions', { title: 'A', questions: Array.from({ length: MAX_QUESTIONS + 1 }, (_, i) => question({ id: String(i) })) }],
    ['duplicate question ids', { title: 'A', questions: [question(), question()] }],
    ['empty question label', { title: 'A', questions: [question({ label: '  ' })] }],
    ['body is not an object', null],
  ])('rejects %s', (_name, body) => {
    expect(parseTemplateInput(body).ok).toBe(false);
  });
});
