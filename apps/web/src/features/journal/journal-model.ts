import type { LinesResponse } from '@life-rpg/shared';

type QuestStatus = LinesResponse['lines'][number]['status'];

export function percent({ done, total }: { done: number; total: number }): number {
  return total === 0 ? 0 : Math.round((done / total) * 100);
}

/** Даты в формате `YYYY-MM-DD` сравниваются как строки. */
export function isOverdue(deadline: string | null, today: string): boolean {
  return deadline !== null && deadline < today;
}

export function formatDeadline(deadline: string, today: string): string {
  const sameYear = deadline.slice(0, 4) === today.slice(0, 4);
  // Дата без времени: форматируем в UTC, чтобы часовой пояс не сдвинул день.
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: sameYear ? undefined : 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${deadline}T00:00:00Z`));
}

export function localToday(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

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
