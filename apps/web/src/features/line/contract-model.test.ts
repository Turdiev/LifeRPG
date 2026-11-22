import type { Quest } from '@life-rpg/shared';
import { describe, expect, it } from 'vitest';
import { contractView, weekdayIndex } from './contract-model';
import type { TreeNode } from './line-model';

// Среда: неделя с понедельника 30 ноября по воскресенье 6 декабря.
const TODAY = '2026-12-02';

function node(id: string, status: Quest['status'], extra: Partial<TreeNode> = {}): TreeNode {
  return {
    id,
    parentId: 'K',
    kind: 'step',
    status,
    position: `a${id}`,
    title: id,
    description: null,
    deadline: null,
    schedule: null,
    scheduledOn: null,
    completedAt: null,
    createdAt: '2026-11-01T00:00:00.000Z',
    progress: { done: 0, total: 0 },
    ...extra,
  };
}

const day = (date: string, status: Quest['status'] = 'open') => node(date, status, { scheduledOn: date });
const contract = (end: string, status: Quest['status'] = 'open') =>
  node('K', status, { parentId: 'C', kind: 'quest', schedule: { weekdays: 127, start: '2026-11-20', end } });

describe('contractView', () => {
  const days = [
    day('2026-11-23', 'done'),
    day('2026-11-25'),
    day('2026-11-27', 'cancelled'),
    day('2026-11-30', 'done'),
    day('2026-12-02'),
    day('2026-12-04'),
    day('2026-12-07'),
    day('2026-12-09', 'cancelled'),
    day('2026-12-11'),
  ];

  it('lays this week out as seven slots from Monday, with the contract’s days in theirs', () => {
    const view = contractView(contract('2026-12-11'), [...days].reverse(), TODAY);

    expect(view.week.map(({ date, day, future }) => [date, day?.id ?? null, future])).toEqual([
      ['2026-11-30', '2026-11-30', false],
      ['2026-12-01', null, false],
      ['2026-12-02', '2026-12-02', false],
      ['2026-12-03', null, true],
      ['2026-12-04', '2026-12-04', true],
      ['2026-12-05', null, true],
      ['2026-12-06', null, true],
    ]);
  });

  it('folds days before this week into unmarked, done and not counted, and counts live days after it', () => {
    const view = contractView(contract('2026-12-11'), days, TODAY);

    expect(view.unmarked.map(({ id }) => id)).toEqual(['2026-11-25']);
    expect(view.doneBefore.map(({ id }) => id)).toEqual(['2026-11-23']);
    expect(view.notCounted.map(({ id }) => id)).toEqual(['2026-11-27']);
    expect(view.ahead).toBe(2);
    expect(view.marked).toBe(2);
  });

  it('is expired only while open after the last day of the term', () => {
    expect(contractView(contract('2026-12-01'), [], TODAY).expired).toBe(true);
    expect(contractView(contract(TODAY), [], TODAY).expired).toBe(false);
    expect(contractView(contract('2026-12-01', 'done'), [], TODAY).expired).toBe(false);
  });
});

describe('weekdayIndex', () => {
  it('starts the week on Monday', () => {
    expect(['2026-11-30', '2026-12-02', '2026-12-06'].map(weekdayIndex)).toEqual([0, 2, 6]);
  });
});
