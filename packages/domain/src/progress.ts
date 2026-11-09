import { childrenOf, getNode, isLeaf } from './tree';
import type { QuestNode, Tree } from './types';

export type Progress = { done: number; total: number };

/**
 * Отменённые потомки исключаются вместе с веткой, ветки на паузе учитываются.
 * Статус самого узла не важен: так показывается прогресс и отменённой ветки в архиве.
 */
export function progress(tree: Tree, id: string): Progress {
  const result: Progress = { done: 0, total: 0 };

  const visit = (node: QuestNode) => {
    if (isLeaf(tree, node)) {
      result.total += 1;
      if (node.status === 'done') result.done += 1;
      return;
    }
    for (const child of childrenOf(tree, node.id)) {
      if (child.status !== 'cancelled') visit(child);
    }
  };

  visit(getNode(tree, id));
  return result;
}
