import { suggestQuests } from '@life-rpg/domain';
import type { TodayResponse } from '@life-rpg/shared';
import type { Db } from '../db/client';
import { countLinesByStatus } from '../db/quests-repository';
import { loadLines, withProgress } from './lines';

/** docs/ux.md, «Сегодня»: карточка «Выбери квест» показывает три предложения. */
const SUGGESTIONS = 3;

export async function getToday(db: Db, userId: string): Promise<TodayResponse> {
  // Активное задание может быть только в линии в работе (правило 6 «Доменной логики»), поэтому хватает открытых линий.
  const { lines, activeQuestId } = await loadLines(db, userId, 'open');
  const activeLine = lines.find((line) => line.summary.hasActiveQuest);
  const counts = await countLinesByStatus(db, userId);

  const otherLines = lines.filter((line) => line !== activeLine).map((line) => line.summary);
  if (activeLine && activeQuestId) {
    return {
      active: { questId: activeQuestId, lineId: activeLine.summary.id, nodes: withProgress(activeLine.nodes, activeLine.tree) },
      otherLines,
      suggestions: [],
      counts,
    };
  }

  const suggestions = suggestQuests(
    lines.map((line) => line.tree),
    SUGGESTIONS,
  ).map((id) => {
    const line = lines.find(({ tree }) => tree.nodes.has(id))!;
    return { id, title: line.tree.nodes.get(id)!.title, lineId: line.summary.id, lineTitle: line.summary.title };
  });
  return { active: null, otherLines, suggestions, counts };
}
