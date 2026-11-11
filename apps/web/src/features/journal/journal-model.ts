import type { LinesResponse } from '@life-rpg/shared';

type QuestStatus = LinesResponse['lines'][number]['status'];

/**
 * Оптимистично убирает линию из списка фильтра и переносит её между счётчиками.
 * `to: null` — новый статус заранее неизвестен (возобновление, восстановление) или
 * линию удалили; точные счётчики придут с перезапросом.
 */
export function withoutLine(
  response: LinesResponse,
  lineId: string,
  from: QuestStatus,
  to: QuestStatus | null,
): LinesResponse {
  const counts = { ...response.counts, [from]: Math.max(0, response.counts[from] - 1) };
  if (to !== null) counts[to] += 1;
  return { lines: response.lines.filter((line) => line.id !== lineId), counts };
}
