import type { Change, QuestNode } from './types';

/** Обобщённая, чтобы узлы с дополнительными полями (описание, прогресс) их не теряли. */
export function applyChanges<T extends QuestNode>(nodes: readonly T[], changes: readonly Change[]): T[] {
  const byId = new Map(changes.map((change) => [change.id, change]));
  return nodes.map((node) => {
    const change = byId.get(node.id);
    return change ? { ...node, status: change.status, completedAt: change.completedAt } : node;
  });
}
