import type { TreeNode } from './line-model';

/**
 * Паз недели раскрытого контракта: `day` — день расписания на эту дату, `null` — дата вне расписания или
 * срока. Будущий ромб пустой и неактивный (docs/ux.md, «Контракт в дереве»).
 */
export type WeekSlot = { date: string; day: TreeNode | null; future: boolean };

/**
 * Раскрытый контракт вместо десятков строк дней: неделя ромбами и свёрнутые группы — дни до этой
 * недели по статусам и число живых дней после неё.
 */
export type ContractView = {
  /** Всегда семь пазов с понедельника: ритм недели виден, даже когда в ней один день расписания. */
  week: WeekSlot[];
  /** Открытые дни до этой недели — отметка задним числом. */
  unmarked: TreeNode[];
  doneBefore: TreeNode[];
  /** Отменённые дни до этой недели: после завершения их десятки, поэтому они свёрнуты отдельно. */
  notCounted: TreeNode[];
  ahead: number;
  marked: number;
  /** Срок вышел, а контракт не завершён. */
  expired: boolean;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function contractView(contract: TreeNode, days: readonly TreeNode[], today: string): ContractView {
  const weekStart = addDays(today, -weekdayIndex(today));
  const weekEnd = addDays(weekStart, 6);
  const dated = [...days].sort((a, b) => compare(a.scheduledOn!, b.scheduledOn!));
  const before = dated.filter((day) => day.scheduledOn! < weekStart);

  return {
    week: Array.from({ length: 7 }, (_, index) => {
      const date = addDays(weekStart, index);
      return { date, day: dated.find((day) => day.scheduledOn === date) ?? null, future: date > today };
    }),
    unmarked: before.filter((day) => day.status === 'open'),
    doneBefore: before.filter((day) => day.status === 'done'),
    notCounted: before.filter((day) => day.status === 'cancelled'),
    ahead: dated.filter((day) => day.scheduledOn! > weekEnd && day.status !== 'cancelled').length,
    marked: dated.filter((day) => day.status === 'done').length,
    expired: contract.status === 'open' && contract.schedule !== null && contract.schedule.end < today,
  };
}

/** 0 — понедельник: неделя и маска расписания начинаются с него. Даты в UTC, как в домене. */
export function weekdayIndex(date: string): number {
  return (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7;
}

export function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
