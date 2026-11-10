import { ancestorsOf, childrenOf, getNode, isLocked } from './tree';
import type { Tree } from './types';

/** Неизвестный id (например, удалённое задание) активным быть не может. */
export function canBeActive(tree: Tree, questId: string): boolean {
  const node = tree.nodes.get(questId);
  if (!node || node.kind !== 'quest' || node.status !== 'open') return false;
  return !ancestorsOf(tree, questId).some(isLocked);
}

/** Предок на паузе или отменён: правило 3 «Доменной логики» блокирует действия с узлом. */
export function isBranchLocked(tree: Tree, id: string): boolean {
  return ancestorsOf(tree, id).some(isLocked);
}

export function nextOpenChild(tree: Tree, parentId: string): string | null {
  return childrenOf(tree, parentId).find((child) => child.status === 'open')?.id ?? null;
}

/**
 * Порядок предложений: та же глава → следующие главы → задания прямо в линии,
 * затем по кругу с начала линии, чтобы пропущенное открытое задание не потерялось.
 */
export function nextQuest(tree: Tree, afterQuestId: string): string | null {
  if (!tree.nodes.has(afterQuestId)) return null;
  const lineId = ancestorsOf(tree, afterQuestId).at(-1)?.id ?? getNode(tree, afterQuestId).id;
  const lineChildren = childrenOf(tree, lineId);
  const order = [
    ...lineChildren.filter((child) => child.kind === 'chapter').flatMap((chapter) => childrenOf(tree, chapter.id)),
    ...lineChildren.filter((child) => child.kind === 'quest'),
  ];

  const index = order.findIndex((quest) => quest.id === afterQuestId);
  const candidates = [...order.slice(index + 1), ...order.slice(0, index)];
  return candidates.find((quest) => canBeActive(tree, quest.id))?.id ?? null;
}
