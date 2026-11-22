import type { LineTreeResponse, Quest } from '@life-rpg/shared';
import { describe, expect, it } from 'vitest';
import type { TreeNode } from '@/features/line/line-model';
import { completionView } from './completion-model';

type Row = [id: string, parentId: string | null, kind: TreeNode['kind'], status?: TreeNode['status']];

const CREATED = '2026-10-01T12:00:00.000Z';
const DONE = '2026-10-23T12:00:00.000Z';

function tree(rows: Row[]): LineTreeResponse {
  const nodes: TreeNode[] = rows.map(([id, parentId, kind, status = 'open'], index) => ({
    id,
    parentId,
    kind,
    status,
    position: `a${String(index).padStart(3, '0')}`,
    title: `title ${id}`,
    description: null,
    deadline: null,
    schedule: null,
    scheduledOn: null,
    completedAt: status === 'done' ? DONE : null,
    createdAt: CREATED,
    progress: { done: 0, total: 0 },
  }));
  return { nodes, activeQuestId: null };
}

const changed = (data: LineTreeResponse, ...ids: string[]): Quest[] =>
  data.nodes.filter((node) => ids.includes(node.id));

describe('completionView', () => {
  it('returns null when the response closed no chapter and no line', () => {
    const data = tree([
      ['L', null, 'line'],
      ['C', 'L', 'chapter'],
      ['Q1', 'C', 'quest', 'done'],
      ['Q2', 'C', 'quest'],
    ]);

    expect(completionView(data, changed(data, 'Q1'))).toBeNull();
  });

  it('describes a closed chapter: its title, days from creation and its done quests only', () => {
    const data = tree([
      ['L', null, 'line'],
      ['C1', 'L', 'chapter', 'done'],
      ['Q1', 'C1', 'quest', 'done'],
      ['S1', 'Q1', 'step', 'done'],
      ['Q2', 'C1', 'quest', 'done'],
      ['Q3', 'C1', 'quest', 'cancelled'],
      ['C2', 'L', 'chapter'],
      ['Q4', 'C2', 'quest', 'done'],
      ['Q5', 'C2', 'quest'],
    ]);

    expect(completionView(data, changed(data, 'S1', 'Q1', 'C1'))).toMatchObject({
      kind: 'chapter',
      id: 'C1',
      title: 'title C1',
      // С 1 по 23 октября включительно.
      days: 23,
      questsDone: 2,
    });
  });

  it('prefers the line when one tap closed both the chapter and the line', () => {
    const data = tree([
      ['L', null, 'line', 'done'],
      ['C', 'L', 'chapter', 'done'],
      ['Q', 'C', 'quest', 'done'],
    ]);

    expect(completionView(data, changed(data, 'Q', 'C', 'L'))).toMatchObject({ kind: 'line', id: 'L', questsDone: 1 });
  });

  it('does not count done quests of a cancelled chapter in a closed line', () => {
    const data = tree([
      ['L', null, 'line', 'done'],
      ['C1', 'L', 'chapter', 'done'],
      ['Q1', 'C1', 'quest', 'done'],
      ['C2', 'L', 'chapter', 'cancelled'],
      ['Q2', 'C2', 'quest', 'done'],
      ['Q3', 'C2', 'quest', 'done'],
    ]);

    expect(completionView(data, changed(data, 'Q1', 'C1', 'L'))).toMatchObject({ kind: 'line', questsDone: 1 });
  });

  it('counts a chapter closed on the day it was created as one day', () => {
    const closedLater = tree([
      ['L', null, 'line'],
      ['C', 'L', 'chapter', 'done'],
      ['Q', 'C', 'quest', 'done'],
    ]);
    const data = {
      ...closedLater,
      nodes: closedLater.nodes.map((node) => (node.completedAt ? { ...node, completedAt: CREATED } : node)),
    };

    expect(completionView(data, changed(data, 'Q', 'C'))).toMatchObject({ days: 1 });
  });

  it('names the goal under a closed chapter', () => {
    const data = tree([
      ['L', null, 'line'],
      ['C1', 'L', 'chapter', 'done'],
      ['Q1', 'C1', 'quest', 'done'],
      ['C2', 'L', 'chapter'],
      ['Q2', 'C2', 'quest'],
    ]);

    expect(completionView(data, changed(data, 'Q1', 'C1'))?.lineTitle).toBe('title L');
  });

  it('has no goal line when the goal itself is closed', () => {
    const data = tree([
      ['L', null, 'line', 'done'],
      ['C1', 'L', 'chapter', 'done'],
      ['Q1', 'C1', 'quest', 'done'],
    ]);

    expect(completionView(data, changed(data, 'Q1', 'C1', 'L'))?.lineTitle).toBeNull();
  });
});
