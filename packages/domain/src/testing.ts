// Помощники для тестов: линия описывается вложенными вызовами, а не плоскими строками.
// Из index.ts не экспортируются.
import { DomainError } from './errors';
import { buildTree } from './tree';
import type { Change, QuestKind, QuestNode, QuestStatus, Schedule, Tree } from './types';

export const NOW = '2026-11-09T10:00:00.000Z';
export const EARLIER = '2026-11-01T10:00:00.000Z';

type NodeSpec = {
  id: string;
  kind: QuestKind;
  status: QuestStatus;
  children: NodeSpec[];
  schedule?: Schedule;
  scheduledOn?: string;
};

const container =
  (kind: QuestKind) =>
  (id: string, children: NodeSpec[] = [], status: QuestStatus = 'open'): NodeSpec => ({
    id,
    kind,
    status,
    children,
  });

export const line = container('line');
export const chapter = container('chapter');
export const quest = container('quest');
export const step = (id: string, status: QuestStatus = 'open'): NodeSpec => ({
  id,
  kind: 'step',
  status,
  children: [],
});

/** Задание-контракт; дни перечисляются по порядку дат. */
export const contract = (
  id: string,
  schedule: Schedule,
  days: NodeSpec[],
  status: QuestStatus = 'open',
): NodeSpec => ({ id, kind: 'quest', status, children: days, schedule });

/** День контракта; id — сама дата, чтобы в проверках было видно, о каком дне речь. */
export const day = (date: string, status: QuestStatus = 'open'): NodeSpec => ({
  id: date,
  kind: 'step',
  status,
  children: [],
  scheduledOn: date,
});

/** Узлы новых дней, которые сервис создаёт по `SchedulePlan.add`. */
export function newDays(questId: string, dates: readonly string[]): QuestNode[] {
  return dates.map((date) =>
    makeNode({ id: date, parentId: questId, kind: 'step', scheduledOn: date, position: `d${date}` }),
  );
}

/** Позиции «братьев» растут в порядке перечисления. */
export function makeNodes(root: NodeSpec): QuestNode[] {
  const nodes: QuestNode[] = [];
  const visit = (spec: NodeSpec, parentId: string | null, index: number) => {
    nodes.push(
      makeNode({
        id: spec.id,
        parentId,
        kind: spec.kind,
        status: spec.status,
        position: positionAt(index),
        schedule: spec.schedule ?? null,
        scheduledOn: spec.scheduledOn ?? null,
      }),
    );
    spec.children.forEach((child, i) => visit(child, spec.id, i));
  };
  visit(root, null, 0);
  return nodes;
}

export function makeTree(root: NodeSpec): Tree {
  return buildTree(makeNodes(root));
}

export function makeNode(fields: Pick<QuestNode, 'id' | 'parentId' | 'kind'> & Partial<QuestNode>): QuestNode {
  const status = fields.status ?? 'open';
  return {
    status,
    position: 'a0',
    title: fields.id,
    deadline: null,
    completedAt: status === 'done' ? EARLIER : null,
    schedule: null,
    scheduledOn: null,
    ...fields,
  };
}

export function positionAt(index: number): string {
  return `a${String(index).padStart(3, '0')}`;
}

/** Порядок `Change[]` — деталь реализации, поэтому проверки сравнивают объекты по id. */
export function statuses(changes: readonly Change[]): Record<string, QuestStatus> {
  return Object.fromEntries(changes.map((c) => [c.id, c.status]));
}

export function byId(changes: readonly Change[]): Record<string, Change> {
  return Object.fromEntries(changes.map((c) => [c.id, c]));
}

export function catchDomainError(fn: () => unknown): DomainError {
  try {
    fn();
  } catch (error) {
    if (error instanceof DomainError) return error;
    throw error;
  }
  throw new Error('Expected a DomainError, but nothing was thrown');
}
