import { buildTree, type Tree } from '@life-rpg/domain';
import type { Tx } from '../db/client';
import { findLineNodes, findQuest, lockLine, type QuestRecord } from '../db/quests-repository';
import { NotFoundError } from '../errors';

export type LockedLine = { quest: QuestRecord; nodes: QuestRecord[]; tree: Tree };

/**
 * Находит узел, блокирует корень его линии (`SELECT … FOR UPDATE`) и читает дерево уже
 * под блокировкой: так две мутации одной линии не видят устаревшее дерево.
 */
export async function lockLineOf(tx: Tx, userId: string, questId: string): Promise<LockedLine> {
  const found = await findQuest(tx, userId, questId);
  if (!found) throw new NotFoundError();
  await lockLine(tx, userId, found.lineId);

  const nodes = await findLineNodes(tx, userId, found.lineId);
  // Узел могли удалить, пока мы ждали блокировку.
  const quest = nodes.find((node) => node.id === questId);
  if (!quest) throw new NotFoundError();
  return { quest, nodes, tree: buildTree(nodes) };
}
