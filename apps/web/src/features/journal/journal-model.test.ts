import type { LinesResponse } from '@life-rpg/shared';
import { describe, expect, it } from 'vitest';
import { withoutLine } from './journal-model';

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
