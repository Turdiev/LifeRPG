import { isContract, progress, suggestQuests } from '@life-rpg/domain';
import type { TodayResponse } from '@life-rpg/shared';
import type { Db } from '../db/client';
import { countLinesByStatus } from '../db/quests-repository';
import { loadLines, withProgress, type LoadedLine } from './lines';

/** docs/ux.md, «Сегодня»: карточка «Выбери квест» показывает три предложения. */
const SUGGESTIONS = 3;

export async function getToday(db: Db, userId: string, date?: string): Promise<TodayResponse> {
  // Активное задание может быть только в линии в работе (правило 6 «Доменной логики»), поэтому хватает открытых линий.
  // Контракты из целей на паузе, отменённых и выполненных в блок не попадают: последний отмеченный день,
  // закрывший цель, уводит на экран её завершения (F-16), а не остаётся строкой с галочкой.
  const { lines, activeQuestId } = await loadLines(db, userId, 'open');
  const activeLine = lines.find((line) => line.summary.hasActiveQuest);
  const counts = await countLinesByStatus(db, userId);
  const contracts = date === undefined ? undefined : contractsOn(lines, date);

  const otherLines = lines.filter((line) => line !== activeLine).map((line) => line.summary);
  if (activeLine && activeQuestId) {
    return {
      active: { questId: activeQuestId, lineId: activeLine.summary.id, nodes: withProgress(activeLine.nodes, activeLine.tree) },
      otherLines,
      suggestions: [],
      counts,
      contracts,
    };
  }

  const suggestions = suggestQuests(
    lines.map((line) => line.tree),
    SUGGESTIONS,
  ).map((id) => {
    const line = lines.find(({ tree }) => tree.nodes.has(id))!;
    return { id, title: line.tree.nodes.get(id)!.title, lineId: line.summary.id, lineTitle: line.summary.title };
  });
  return { active: null, otherLines, suggestions, counts, contracts };
}

type Contracts = NonNullable<TodayResponse['contracts']>;
type ContractItem = Contracts['items'][number];

/**
 * Блок «На сегодня» (docs/ux.md, F-23): контракты с неотменённым днём на `date` — и отмеченным тоже, он
 * остаётся в блоке с галочкой, — и открытые контракты с вышедшим сроком, в конце блока.
 */
function contractsOn(lines: readonly LoadedLine[], date: string): Contracts {
  const due: ContractItem[] = [];
  const expired: ContractItem[] = [];
  const lineIds = new Set<string>();

  for (const { summary, tree } of lines) {
    const visit = (parentId: string, path: ContractItem['path']) => {
      for (const node of tree.children.get(parentId) ?? []) {
        if (node.status === 'paused' || node.status === 'cancelled') continue;
        if (!isContract(node)) {
          visit(node.id, [...path, { id: node.id, title: node.title }]);
          continue;
        }
        const item = { questId: node.id, title: node.title, lineId: summary.id, path, progress: progress(tree, node.id) };
        const day = tree.children
          .get(node.id)
          ?.find((child) => child.scheduledOn === date && child.status !== 'cancelled');
        if (day) {
          due.push({ ...item, dayId: day.id, expired: false });
        } else if (node.status === 'open' && node.schedule!.end < date) {
          expired.push({ ...item, dayId: null, expired: true });
        } else {
          continue;
        }
        lineIds.add(summary.id);
      }
    };
    visit(summary.id, [{ id: summary.id, title: summary.title }]);
  }

  return {
    items: [...due, ...expired],
    lines: lines
      .filter(({ summary }) => lineIds.has(summary.id))
      .map(({ summary, nodes, tree }) => ({ lineId: summary.id, nodes: withProgress(nodes, tree) })),
  };
}
