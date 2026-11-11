// Форматирование и даты, общие для журнала и экрана линии.
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
  return localDate(new Date());
}

/** День в часовом поясе пользователя: закрытая после полуночи цель не должна показать вчерашнюю дату. */
export function localDate(moment: Date | string): string {
  const date = new Date(moment);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}
