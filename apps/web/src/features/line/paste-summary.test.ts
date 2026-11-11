import { describe, expect, it } from 'vitest';
import { pasteSummary } from './paste-summary';

describe('pasteSummary', () => {
  it('names every kind with the right Russian form and joins the last one with «и»', () => {
    expect(pasteSummary({ chapter: 0, quest: 3, step: 9, total: 12 })).toBe('Будет создано: 3 задания и 9 этапов');
    expect(pasteSummary({ chapter: 1, quest: 5, step: 21, total: 27 })).toBe(
      'Будет создано: 1 глава, 5 заданий и 21 этап',
    );
    expect(pasteSummary({ chapter: 0, quest: 0, step: 2, total: 2 })).toBe('Будет создано: 2 этапа');
  });
});
