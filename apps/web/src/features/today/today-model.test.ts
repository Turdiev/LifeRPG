import type { Quest, TodayResponse } from '@life-rpg/shared';
import { describe, expect, it } from 'vitest';
import type { TreeNode } from '@/features/line/line-model';
import { buildTodayView, closedByComplete, greeting, todayState } from './today-model';

// Компактное дерево: [id, parentId, kind, status?]; позиции растут в порядке перечисления.
function nodes(rows: [string, string | null, Quest['kind'], Quest['status']?][]): TreeNode[] {
  return rows.map(([id, parentId, kind, status = 'open'], index) => ({
    id,
    parentId,
    kind,
    status,
    position: `a${String(index).padStart(3, '0')}`,
    title: id,
    description: null,
    deadline: null,
    completedAt: status === 'done' ? '2026-11-01T00:00:00.000Z' : null,
    progress: { done: 0, total: 0 },
  }));
}

const ids = (list: readonly TreeNode[]) => list.map((node) => node.id);

describe('buildTodayView', () => {
  it('gives the path, quest progress by steps, the next step and line progress', () => {
    const data = nodes([
      ['L', null, 'line'],
      ['C', 'L', 'chapter'],
      ['Q', 'C', 'quest'],
      ['S1', 'Q', 'step', 'done'],
      ['S2', 'Q', 'step', 'cancelled'],
      ['S3', 'Q', 'step'],
      ['S4', 'Q', 'step'],
      ['Other', 'L', 'quest'],
    ]);

    const view = buildTodayView(data, 'Q')!;

    expect(view.line.id).toBe('L');
    expect(view.chapter?.id).toBe('C');
    expect(view.steps).toEqual({ done: 1, total: 3 });
    expect(view.nextStepId).toBe('S3');
    expect(ids(view.shown)).toEqual(['S3', 'S4']);
    expect(view.moreCount).toBe(0);
    expect(view.lineProgress).toEqual({ done: 1, total: 4 });
  });

  it('has no chapter for a quest placed directly in the line', () => {
    const view = buildTodayView(
      nodes([
        ['L', null, 'line'],
        ['Q', 'L', 'quest'],
      ]),
      'Q',
    )!;

    expect(view.chapter).toBeNull();
  });

  it('shows the next step and up to three more open steps, the rest as «ещё N»', () => {
    const data = nodes([
      ['L', null, 'line'],
      ['Q', 'L', 'quest'],
      ...[1, 2, 3, 4, 5, 6].map((n): [string, string, 'step'] => [`S${n}`, 'Q', 'step']),
    ]);

    const view = buildTodayView(data, 'Q')!;

    expect(ids(view.shown)).toEqual(['S1', 'S2', 'S3', 'S4']);
    expect(view.moreCount).toBe(2);
  });

  it('keeps steps completed on this screen in place with their check, without counting them', () => {
    const data = nodes([
      ['L', null, 'line'],
      ['Q', 'L', 'quest'],
      ['S1', 'Q', 'step', 'done'],
      ['S2', 'Q', 'step', 'done'],
      ['S3', 'Q', 'step'],
      ['S4', 'Q', 'step'],
      ['S5', 'Q', 'step'],
      ['S6', 'Q', 'step'],
      ['S7', 'Q', 'step'],
    ]);

    const view = buildTodayView(data, 'Q', new Set(['S2']))!;

    expect(ids(view.shown)).toEqual(['S2', 'S3', 'S4', 'S5', 'S6']);
    expect(view.nextStepId).toBe('S3');
    expect(view.moreCount).toBe(1);
  });

  it('treats a quest without steps, or with only cancelled ones, as a leaf: no steps, nothing next', () => {
    const data = nodes([
      ['L', null, 'line'],
      ['Empty', 'L', 'quest'],
      ['AllCancelled', 'L', 'quest'],
      ['S', 'AllCancelled', 'step', 'cancelled'],
    ]);

    for (const id of ['Empty', 'AllCancelled']) {
      const view = buildTodayView(data, id)!;
      expect(view.steps).toBeNull();
      expect(view.shown).toEqual([]);
      expect(view.nextStepId).toBeNull();
    }
  });

  it('returns null when the quest is not in the tree', () => {
    expect(buildTodayView(nodes([['L', null, 'line']]), 'missing')).toBeNull();
  });
});

describe('closedByComplete', () => {
  const data = (rows: Parameters<typeof nodes>[0]) => ({ nodes: nodes(rows), activeQuestId: 'Q' });
  const NOW = '2026-11-12T10:00:00.000Z';

  it('closes the quest and its ancestors with the last open step', () => {
    const tree = data([
      ['L', null, 'line'],
      ['Q', 'L', 'quest'],
      ['S1', 'Q', 'step', 'done'],
      ['S2', 'Q', 'step'],
    ]);

    expect(closedByComplete(tree, 'S2', NOW).sort()).toEqual(['L', 'Q', 'S2']);
  });

  it('closes only the step while other steps stay open', () => {
    const tree = data([
      ['L', null, 'line'],
      ['Q', 'L', 'quest'],
      ['S1', 'Q', 'step'],
      ['S2', 'Q', 'step'],
    ]);

    expect(closedByComplete(tree, 'S1', NOW)).toEqual(['S1']);
  });

  it('closes a quest without steps by itself, and cancelled steps do not keep it open', () => {
    const tree = data([
      ['L', null, 'line'],
      ['Leaf', 'L', 'quest'],
      ['Q', 'L', 'quest'],
      ['S1', 'Q', 'step', 'cancelled'],
      ['S2', 'Q', 'step'],
    ]);

    expect(closedByComplete(tree, 'Leaf', NOW)).toEqual(['Leaf']);
    expect(closedByComplete(tree, 'S2', NOW)).toContain('Q');
  });
});

describe('todayState', () => {
  const counts = (open: number, paused = 0, done = 0, cancelled = 0) => ({ open, paused, done, cancelled });
  const base: TodayResponse = { active: null, otherLines: [], suggestions: [], counts: counts(0) };
  const suggestion = { id: crypto.randomUUID(), title: 'Q', lineId: crypto.randomUUID(), lineTitle: 'L' };

  it('is «first» when the user has no lines at all', () => {
    expect(todayState(base)).toBe('first');
  });

  it('is «allPaused» when nothing is in progress and some lines are paused', () => {
    expect(todayState({ ...base, counts: counts(0, 2, 1) })).toBe('allPaused');
  });

  it('is «nothingOpen» when every line is done or cancelled', () => {
    expect(todayState({ ...base, counts: counts(0, 0, 1, 1) })).toBe('nothingOpen');
  });

  it('is «pick» when there are suggestions, and «noQuests» when open lines have nothing to take', () => {
    expect(todayState({ ...base, counts: counts(1), suggestions: [suggestion] })).toBe('pick');
    expect(todayState({ ...base, counts: counts(1) })).toBe('noQuests');
  });
});

describe('greeting', () => {
  it('depends on the time of day', () => {
    expect([4, 5, 11, 12, 16, 17, 22, 23].map(greeting)).toEqual([
      'night',
      'morning',
      'morning',
      'day',
      'day',
      'evening',
      'evening',
      'night',
    ]);
  });
});
