import { ancestorsOf, childrenOf, getNode, isLocked } from './tree';
import type { QuestNode, Tree } from './types';

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
  const order = questOrder(tree, lineId);

  const index = order.findIndex((quest) => quest.id === afterQuestId);
  const candidates = [...order.slice(index + 1), ...order.slice(0, index)];
  return candidates.find((quest) => canBeActive(tree, quest.id))?.id ?? null;
}

/**
 * Предложения «Выбери квест» на экране «Сегодня»: сначала первое открытое задание каждой
 * линии в переданном порядке (порядок журнала), затем следующие задания тех же линий по кругу —
 * чтобы и при одной цели было из чего выбрать. Порядок внутри линии — как у `nextQuest`.
 */
export function suggestQuests(lines: readonly Tree[], limit: number): string[] {
  const queues = lines.map((tree) => {
    const line = [...tree.nodes.values()].find((node) => node.parentId === null);
    return line ? questOrder(tree, line.id).filter((quest) => canBeActive(tree, quest.id)) : [];
  });
  const longest = Math.max(0, ...queues.map((queue) => queue.length));

  const suggested: string[] = [];
  for (let round = 0; round < longest; round += 1) {
    for (const queue of queues) {
      const quest = queue[round];
      if (quest) suggested.push(quest.id);
    }
  }
  return suggested.slice(0, limit);
}

/** Задания глав по порядку, затем задания прямо в линии. */
function questOrder(tree: Tree, lineId: string): QuestNode[] {
  const lineChildren = childrenOf(tree, lineId);
  return [
    ...lineChildren.filter((child) => child.kind === 'chapter').flatMap((chapter) => childrenOf(tree, chapter.id)),
    ...lineChildren.filter((child) => child.kind === 'quest'),
  ];
}
