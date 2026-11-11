import { DomainError } from '@life-rpg/domain';
import type { LineTreeResponse, MutationResponse, Quest } from '@life-rpg/shared';
import { describe, expect, it } from 'vitest';
import {
  applyStatusLocally,
  buildLineView,
  descendantCount,
  insertLocally,
  mergeResponse,
  removeLocally,
  type TreeNode,
} from './line-model';

const NOW = '2026-11-12T10:00:00.000Z';

// Компактное дерево: [id, parentId, kind, status?]; позиции растут в порядке перечисления.
function tree(rows: [string, string | null, Quest['kind'], Quest['status']?][], activeQuestId: string | null = null) {
  const nodes: TreeNode[] = rows.map(([id, parentId, kind, status = 'open'], index) => ({
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
  return { nodes, activeQuestId } satisfies LineTreeResponse;
}

const statusOf = (data: LineTreeResponse, id: string) => data.nodes.find((n) => n.id === id)?.status;

describe('buildLineView', () => {
  const data = tree(
    [
      ['L', null, 'line'],
      ['C1', 'L', 'chapter', 'done'],
      ['Q1', 'C1', 'quest', 'done'],
      ['C2', 'L', 'chapter'],
      ['Q2', 'C2', 'quest'],
      ['S1', 'Q2', 'step', 'done'],
      ['S2', 'Q2', 'step'],
      ['S3', 'Q2', 'step', 'cancelled'],
      ['Q3', 'C2', 'quest', 'done'],
      ['C3', 'L', 'chapter', 'paused'],
      ['Q4', 'C3', 'quest'],
      ['QL', 'L', 'quest'],
    ],
    'QL',
  );
  const view = buildLineView(data.nodes, data.activeQuestId)!;

  it('folds done items of every level into a separate group at the bottom', () => {
    expect(view.chapters.items.map((c) => c.node.id)).toEqual(['C2', 'C3']);
    expect(view.chapters.done.map((c) => c.node.id)).toEqual(['C1']);
    const c2 = view.chapters.items[0]!;
    expect(c2.quests.items.map((q) => q.node.id)).toEqual(['Q2']);
    expect(c2.quests.done.map((q) => q.node.id)).toEqual(['Q3']);
    expect(c2.quests.items[0]!.steps.items.map((s) => s.node.id)).toEqual(['S2', 'S3']);
    expect(c2.quests.items[0]!.steps.done.map((s) => s.node.id)).toEqual(['S1']);
  });

  it('keeps items completed just now in place, so the checkmark stays visible', () => {
    const kept = buildLineView(data.nodes, data.activeQuestId, new Set(['S1', 'Q3']))!;
    const c2 = kept.chapters.items[0]!;

    expect(c2.quests.items.map((q) => q.node.id)).toEqual(['Q2', 'Q3']);
    expect(c2.quests.items[0]!.steps.items.map((s) => s.node.id)).toEqual(['S1', 'S2', 'S3']);
    expect(c2.quests.done).toEqual([]);
  });

  it('puts quests placed directly in the line into their own group', () => {
    expect(view.quests.items.map((q) => q.node.id)).toEqual(['QL']);
  });

  it('computes progress with the domain rules', () => {
    expect(view.progress).toEqual({ done: 3, total: 6 });
    expect(view.chapters.items[0]!.progress).toEqual({ done: 2, total: 3 });
  });

  it('marks the active quest and locks items inside a paused chapter', () => {
    expect(view.quests.items[0]!.isActive).toBe(true);
    expect(view.chapters.items[1]!.quests.items[0]!.locked).toBe(true);
    expect(view.chapters.items[0]!.quests.items[0]!.locked).toBe(false);
    expect(view.chapters.items[1]!).toMatchObject({ locked: true, branchLocked: false });
  });

  it('locks a cancelled step', () => {
    expect(view.chapters.items[0]!.quests.items[0]!.steps.items[1]!.locked).toBe(true);
  });

  it('opens the chapter with the active quest, otherwise the first chapter in progress', () => {
    const withActive = buildLineView(data.nodes, 'Q4')!;

    expect(withActive.defaultOpenChapterId).toBe('C3');
    expect(view.defaultOpenChapterId).toBe('C2');
  });

  it('opens no chapter when none is in progress and the active quest is elsewhere', () => {
    const allPaused = tree([
      ['L', null, 'line'],
      ['C1', 'L', 'chapter', 'done'],
      ['C2', 'L', 'chapter', 'paused'],
      ['Q', 'C2', 'quest'],
    ]);

    expect(buildLineView(allPaused.nodes, null)!.defaultOpenChapterId).toBeNull();
  });

  it('counts the quests of a chapter: done over not cancelled', () => {
    const withCancelled = tree([
      ['L', null, 'line'],
      ['C', 'L', 'chapter'],
      ['Q1', 'C', 'quest', 'done'],
      ['Q2', 'C', 'quest'],
      ['Q3', 'C', 'quest', 'cancelled'],
    ]);

    expect(buildLineView(withCancelled.nodes, null)!.chapters.items[0]!.questCount).toEqual({ done: 1, total: 2 });
  });

  it('splits the line progress into segments by chapter in their order, then quests placed in the line', () => {
    expect(view.segments).toEqual([
      { id: 'C1', title: 'C1', done: 1, total: 1, active: false },
      { id: 'C2', title: 'C2', done: 2, total: 3, active: false },
      { id: 'C3', title: 'C3', done: 0, total: 1, active: false },
      { id: 'L', title: 'L', done: 0, total: 1, active: true },
    ]);
  });

  it('marks the segment with the active quest and skips cancelled or empty chapters', () => {
    const data2 = tree(
      [
        ['L', null, 'line'],
        ['C1', 'L', 'chapter'],
        ['Q1', 'C1', 'quest'],
        ['C2', 'L', 'chapter', 'cancelled'],
        ['Q2', 'C2', 'quest'],
        ['C3', 'L', 'chapter'],
      ],
      'Q1',
    );

    expect(buildLineView(data2.nodes, data2.activeQuestId)!.segments).toEqual([
      { id: 'C1', title: 'C1', done: 0, total: 1, active: true },
    ]);
  });

  it('returns null when the line is not among the nodes', () => {
    expect(buildLineView([], null)).toBeNull();
  });
});

describe('applyStatusLocally', () => {
  it('completes the last step and its ancestors through the domain', () => {
    const data = tree([
      ['L', null, 'line'],
      ['Q', 'L', 'quest'],
      ['S1', 'Q', 'step', 'done'],
      ['S2', 'Q', 'step'],
    ]);

    const next = applyStatusLocally(data, 'S2', 'complete', NOW);

    expect(['S2', 'Q', 'L'].map((id) => statusOf(next, id))).toEqual(['done', 'done', 'done']);
  });

  it('clears the active quest when it can no longer be active', () => {
    const data = tree(
      [
        ['L', null, 'line'],
        ['Q', 'L', 'quest'],
        ['Q2', 'L', 'quest'],
      ],
      'Q',
    );

    expect(applyStatusLocally(data, 'Q', 'complete', NOW).activeQuestId).toBeNull();
    expect(applyStatusLocally(data, 'Q2', 'complete', NOW).activeQuestId).toBe('Q');
  });

  it('throws the domain error, so the UI can ask before sending anything', () => {
    const data = tree([
      ['L', null, 'line'],
      ['Q', 'L', 'quest'],
      ['S', 'Q', 'step'],
    ]);

    expect(() => applyStatusLocally(data, 'Q', 'complete', NOW)).toThrow(DomainError);
    expect(statusOf(applyStatusLocally(data, 'Q', 'complete', NOW, { withChildren: true }), 'S')).toBe('done');
  });
});

describe('insertLocally', () => {
  it('appends a pending node after its siblings and reopens the done parent', () => {
    const data = tree([
      ['L', null, 'line', 'done'],
      ['Q', 'L', 'quest', 'done'],
      ['S1', 'Q', 'step', 'done'],
    ]);

    const next = insertLocally(data, { id: 'temp-1', parentId: 'Q', kind: 'step', title: 'Новый' }, NOW);
    const view = buildLineView(next.nodes, null)!;

    expect(view.quests.items[0]!.steps.items.map((s) => s.node.id)).toEqual(['temp-1']);
    expect([statusOf(next, 'Q'), statusOf(next, 'L')]).toEqual(['open', 'open']);
  });
});

describe('mergeResponse', () => {
  it('replaces pending nodes with the server ones and takes activeQuestId from the server', () => {
    const data = insertLocally(tree([['L', null, 'line']]), { id: 'temp-1', parentId: 'L', kind: 'quest', title: 'x' }, NOW);
    const created: Quest = {
      id: 'Q',
      parentId: 'L',
      kind: 'quest',
      status: 'open',
      position: 'a1',
      title: 'x',
      description: null,
      deadline: null,
      completedAt: null,
    };
    const response: MutationResponse = { changed: [created], activeQuestId: 'Q' };

    const next = mergeResponse(data, response, ['temp-1']);

    expect(next.nodes.map((n) => n.id)).toEqual(['L', 'Q']);
    expect(next.activeQuestId).toBe('Q');
  });

  it('updates the fields of existing nodes', () => {
    const data = tree([
      ['L', null, 'line'],
      ['Q', 'L', 'quest'],
    ]);
    const renamed = { ...data.nodes[1]!, title: 'Новое' };

    const next = mergeResponse(data, { changed: [renamed], activeQuestId: null });

    expect(next.nodes[1]).toMatchObject({ id: 'Q', title: 'Новое' });
  });
});

describe('removeLocally', () => {
  it('drops the node with its descendants and recomputes the parent', () => {
    const data = tree([
      ['L', null, 'line'],
      ['Q', 'L', 'quest'],
      ['S1', 'Q', 'step', 'done'],
      ['S2', 'Q', 'step'],
      ['C', 'L', 'chapter'],
      ['QC', 'C', 'quest'],
    ]);

    const next = removeLocally(removeLocally(data, 'S2', NOW), 'C', NOW);

    expect(next.nodes.map((n) => n.id)).toEqual(['L', 'Q', 'S1']);
    expect([statusOf(next, 'Q'), statusOf(next, 'L')]).toEqual(['done', 'done']);
  });
});

describe('removeLocally and the active quest', () => {
  it('clears the active quest when deleting its last open step completes it', () => {
    const data = tree(
      [
        ['L', null, 'line'],
        ['Q', 'L', 'quest'],
        ['S1', 'Q', 'step', 'done'],
        ['S2', 'Q', 'step'],
        ['Q2', 'L', 'quest'],
      ],
      'Q',
    );

    expect(removeLocally(data, 'S2', NOW).activeQuestId).toBeNull();
  });
});

describe('insertLocally ordering', () => {
  it('keeps several pending nodes in creation order even after the first one gets a server key', () => {
    const base = tree([
      ['L', null, 'line'],
      ['Q', 'L', 'quest'],
      ['S1', 'Q', 'step'],
    ]);
    const first = insertLocally(base, { id: 'temp-1', parentId: 'Q', kind: 'step', title: 'first' }, NOW);
    const second = insertLocally(first, { id: 'temp-2', parentId: 'Q', kind: 'step', title: 'second' }, NOW);
    // Сервер выдал первому узлу обычный ключ, второй ещё ждёт ответа.
    const created = { ...second.nodes.find((n) => n.id === 'temp-1')!, id: 'S2', position: 'a003' };
    const merged = mergeResponse(second, { changed: [created], activeQuestId: null }, ['temp-1']);

    const steps = buildLineView(merged.nodes, null)!.quests.items[0]!.steps.items.map((s) => s.node.title);
    expect(steps).toEqual(['S1', 'first', 'second']);
  });
});

describe('descendantCount', () => {
  it('counts every node below the given one', () => {
    const data = tree([
      ['L', null, 'line'],
      ['C', 'L', 'chapter'],
      ['Q', 'C', 'quest'],
      ['S', 'Q', 'step'],
    ]);

    expect(descendantCount(data.nodes, 'C')).toBe(2);
    expect(descendantCount(data.nodes, 'S')).toBe(0);
  });
});
