import { buildTree, nextOpenChild, nextQuest, progress, type Progress } from '@life-rpg/domain';
import type { LineTreeResponse, TodayResponse } from '@life-rpg/shared';
import { applyStatusLocally, type TreeNode } from '@/features/line/line-model';

/** docs/ux.md, «Сегодня»: следующий этап и до трёх открытых этапов после него. */
const OPEN_STEPS_SHOWN = 4;

export type TodayQuestView = {
  quest: TreeNode;
  line: TreeNode;
  /** Путь «Линия › Глава»; у задания прямо в линии главы нет. */
  chapter: TreeNode | null;
  /** «3 из 5 этапов»; `null` — задание-лист, у него кнопка «Квест выполнен». */
  steps: Progress | null;
  lineProgress: Progress;
  /** Открытые этапы по порядку; отмеченные на этом экране остаются на месте с галочкой. */
  shown: TreeNode[];
  nextStepId: string | null;
  /** Открытые этапы, которые не поместились, — строка «ещё N». */
  moreCount: number;
};

export function buildTodayView(
  nodes: readonly TreeNode[],
  questId: string,
  keepInPlace: ReadonlySet<string> = new Set(),
): TodayQuestView | null {
  const quest = nodes.find((node) => node.id === questId);
  const line = nodes.find((node) => node.parentId === null);
  if (!quest || !line) return null;
  const tree = buildTree(nodes);
  const full = new Map(nodes.map((node) => [node.id, node]));
  const parent = quest.parentId === null ? undefined : full.get(quest.parentId);

  // Отменённые этапы не в счёт (PRD, «Прогресс»): задание из одних отменённых — лист.
  const steps = (tree.children.get(questId) ?? [])
    .filter((step) => step.status !== 'cancelled')
    .map((step) => full.get(step.id)!);
  const shown: TreeNode[] = [];
  let openShown = 0;
  let moreCount = 0;
  for (const step of steps) {
    const visible = step.status === 'open' || keepInPlace.has(step.id);
    if (!visible) continue;
    if (openShown < OPEN_STEPS_SHOWN) shown.push(step);
    else if (step.status === 'open') moreCount += 1;
    if (step.status === 'open') openShown += 1;
  }

  return {
    quest,
    line,
    chapter: parent?.kind === 'chapter' ? parent : null,
    steps: steps.length > 0 ? progress(tree, questId) : null,
    lineProgress: progress(tree, line.id),
    shown,
    nextStepId: nextOpenChild(tree, questId),
    moreCount,
  };
}

/**
 * Узлы, которые отметка закроет, — тем же расчётом домена, что сделает оптимистичная мутация:
 * они остаются на месте с галочкой, а по id квеста экран заранее знает, что квест пройден.
 */
export function closedByComplete(data: LineTreeResponse, id: string, now: string): string[] {
  const before = new Map(data.nodes.map((node) => [node.id, node.status]));
  return applyStatusLocally(data, id, 'complete', now)
    .nodes.filter((node) => node.status === 'done' && before.get(node.id) !== 'done')
    .map((node) => node.id);
}

export type NextQuestView = { quest: TreeNode; chapter: TreeNode | null };

/**
 * «Следующий квест: …» после закрытия активного (F-13). Считается из кеша дерева тем же
 * `nextQuest`, что и `suggestion` в ответе сервера: карточке не нужен ответ конкретной мутации.
 */
export function nextQuestView(nodes: readonly TreeNode[], afterQuestId: string): NextQuestView | null {
  const nextId = nextQuest(buildTree(nodes), afterQuestId);
  const quest = nextId === null ? undefined : nodes.find((node) => node.id === nextId);
  if (!quest) return null;
  const parent = nodes.find((node) => node.id === quest.parentId);
  return { quest, chapter: parent?.kind === 'chapter' ? parent : null };
}

/** Что показать, когда активного квеста нет (docs/ux.md, «Сегодня», «Состояния»). */
export type TodayState = 'first' | 'allPaused' | 'nothingOpen' | 'pick' | 'noQuests';

export function todayState({ counts, suggestions }: TodayResponse): TodayState {
  if (Object.values(counts).every((count) => count === 0)) return 'first';
  if (counts.open === 0) return counts.paused > 0 ? 'allPaused' : 'nothingOpen';
  return suggestions.length > 0 ? 'pick' : 'noQuests';
}

export type Greeting = 'morning' | 'day' | 'evening' | 'night';

export function greeting(hour: number): Greeting {
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'day';
  if (hour >= 17 && hour < 23) return 'evening';
  return 'night';
}
