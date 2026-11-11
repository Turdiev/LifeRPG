import type { LinesResponse } from '@life-rpg/shared';
import { describe, expect, it } from 'vitest';
import { formatDeadline, isOverdue, percent, withoutLine } from './journal-model';

describe('percent', () => {
  it('rounds done ÷ total to whole percent', () => {
    expect(percent({ done: 1, total: 3 })).toBe(33);
    expect(percent({ done: 2, total: 3 })).toBe(67);
  });

  it('is 0 for an empty line', () => {
    expect(percent({ done: 0, total: 0 })).toBe(0);
  });
});

describe('isOverdue', () => {
  it('is true only for a deadline before today', () => {
    expect(isOverdue('2026-11-10', '2026-11-11')).toBe(true);
    expect(isOverdue('2026-11-11', '2026-11-11')).toBe(false);
    expect(isOverdue('2026-12-01', '2026-11-11')).toBe(false);
    expect(isOverdue(null, '2026-11-11')).toBe(false);
  });
});

describe('formatDeadline', () => {
  it('shows day and month, and the year only when it is not the current one', () => {
    expect(formatDeadline('2026-05-01', '2026-11-11')).toBe('1 мая');
    expect(formatDeadline('2027-05-01', '2026-11-11')).toBe('1 мая 2027 г.');
  });
});

describe('withoutLine', () => {
  const response: LinesResponse = {
    lines: [
      line('a'),
      line('b'),
    ],
    counts: { open: 2, paused: 1, done: 0, cancelled: 0 },
  };

  it('removes the line from the list and moves it between the counters', () => {
    expect(withoutLine(response, 'a', 'open', 'paused')).toEqual({
      lines: [line('b')],
      counts: { open: 1, paused: 2, done: 0, cancelled: 0 },
    });
  });

  it('only decrements the source counter when the target status is unknown or the line is deleted', () => {
    expect(withoutLine(response, 'a', 'open', null).counts).toEqual({ open: 1, paused: 1, done: 0, cancelled: 0 });
  });

  it('does not mutate the cached response', () => {
    withoutLine(response, 'a', 'open', 'paused');

    expect(response.lines).toHaveLength(2);
    expect(response.counts.open).toBe(2);
  });
});

function line(id: string): LinesResponse['lines'][number] {
  return {
    id,
    title: id,
    description: null,
    deadline: null,
    status: 'open',
    progress: { done: 0, total: 0 },
    chapters: null,
    hasActiveQuest: false,
  };
}
