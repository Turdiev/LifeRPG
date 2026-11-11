import { describe, expect, it } from 'vitest';
import { countDrafts, kindAtDepth, parseQuestList, type QuestDraft } from './quest-list';

/** Дерево черновика компактно: `['A', ['a1', 'a2']]` — элемент и его дети. */
function shape(drafts: QuestDraft[]): unknown[] {
  return drafts.map((d) => (d.children.length ? [d.title, shape(d.children)] : d.title));
}

describe('parseQuestList', () => {
  it('turns every non-empty line into an element of the level it was pasted into', () => {
    const result = parseQuestList('Глава 1\n\nГлава 2\n   \nГлава 3', 'chapter');

    expect(shape(result.drafts)).toEqual(['Глава 1', 'Глава 2', 'Глава 3']);
    expect(result).toMatchObject({ flattened: false, truncated: false });
  });

  it('nests an indented line under the previous one: Tab, two spaces or an indented dash', () => {
    const text = ['Задание A', '\tЭтап 1', '  Этап 2', 'Задание B', '  - Этап 3'].join('\n');

    expect(shape(parseQuestList(text, 'quest').drafts)).toEqual([
      ['Задание A', ['Этап 1', 'Этап 2']],
      ['Задание B', ['Этап 3']],
    ]);
  });

  it('strips list markers: dashes, asterisks, bullets and numbers', () => {
    const text = ['- первый', '* второй', '• третий', '1. четвёртый', '2) пятый', '— шестой'].join('\n');

    expect(shape(parseQuestList(text, 'step').drafts)).toEqual([
      'первый',
      'второй',
      'третий',
      'четвёртый',
      'пятый',
      'шестой',
    ]);
  });

  it('builds chapter → quest → step when pasted into chapters', () => {
    const text = ['Глава', '  Задание', '    Этап'].join('\n');

    expect(shape(parseQuestList(text, 'chapter').drafts)).toEqual([['Глава', [['Задание', ['Этап']]]]]);
  });

  it('presses lines deeper than a step up to the step level and reports it', () => {
    const text = ['Задание', '  Этап 1', '    Слишком глубоко', '  Этап 2'].join('\n');
    const result = parseQuestList(text, 'quest');

    expect(shape(result.drafts)).toEqual([['Задание', ['Этап 1', 'Слишком глубоко', 'Этап 2']]]);
    expect(result.flattened).toBe(true);
  });

  it('keeps every line flat when pasted into steps', () => {
    const result = parseQuestList('Этап 1\n  Этап 2', 'step');

    expect(shape(result.drafts)).toEqual(['Этап 1', 'Этап 2']);
    expect(result.flattened).toBe(true);
  });

  it('measures indentation relative to the first line', () => {
    const text = ['    Задание', '      Этап'].join('\n');

    expect(shape(parseQuestList(text, 'quest').drafts)).toEqual([['Задание', ['Этап']]]);
  });

  it('cuts titles longer than 120 characters and reports it', () => {
    const long = 'я'.repeat(130);
    const result = parseQuestList(`${long}\nкороткий`, 'step');

    expect(result.drafts[0]!.title).toHaveLength(120);
    expect(result.truncated).toBe(true);
  });

  it('skips empty list items like a bare dash or number', () => {
    const text = ['- первый', '- ', '1.', 'второй'].join('\n');

    expect(shape(parseQuestList(text, 'step').drafts)).toEqual(['первый', 'второй']);
  });

  it('treats a Tab as two spaces when they are mixed in one list', () => {
    const text = ['Задание', '\tЭтап 1', '  Этап 2', 'Задание 2'].join('\n');

    expect(shape(parseQuestList(text, 'quest').drafts)).toEqual([['Задание', ['Этап 1', 'Этап 2']], 'Задание 2']);
  });

  it('reads four-space indentation as one level per step', () => {
    const text = ['A', '    B', '        C', '    D'].join('\n');

    expect(shape(parseQuestList(text, 'chapter').drafts)).toEqual([['A', [['B', ['C']], 'D']]]);
  });

  it('accepts Windows line endings', () => {
    expect(shape(parseQuestList('A\r\n  B', 'quest').drafts)).toEqual([['A', ['B']]]);
  });
});

describe('kindAtDepth', () => {
  it('follows chapter → quest → step from the level of the pasted line', () => {
    expect([0, 1, 2, 3].map((depth) => kindAtDepth('chapter', depth))).toEqual(['chapter', 'quest', 'step', null]);
    expect([0, 1, 2].map((depth) => kindAtDepth('quest', depth))).toEqual(['quest', 'step', null]);
    expect(kindAtDepth('step', 1)).toBeNull();
  });
});

describe('countDrafts', () => {
  it('counts the elements of every kind and the total', () => {
    const { drafts } = parseQuestList(['Глава', '  З1', '    Э1', '    Э2', '  З2', 'Глава 2'].join('\n'), 'chapter');

    expect(countDrafts(drafts, 'chapter')).toEqual({ chapter: 2, quest: 2, step: 2, total: 6 });
  });
});
