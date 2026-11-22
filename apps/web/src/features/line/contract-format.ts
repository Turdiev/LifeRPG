import type { Schedule } from '@life-rpg/domain';
import { formatDeadline } from '@/shared/lib/format';
import { ru } from '@/shared/strings/ru';
import { weekdayIndex } from './contract-model';

const EVERY_DAY = 127;

/** «пн, ср, пт до 31 января» под названием контракта (docs/ux.md, «Контракт в дереве»). */
export function scheduleText(schedule: Schedule, today: string): string {
  const days =
    schedule.weekdays === EVERY_DAY
      ? ru.contract.everyDay
      : ru.contract.weekdays.filter((_, index) => schedule.weekdays & (1 << index)).join(', ');
  return ru.contract.schedule(days, formatDeadline(schedule.end, today));
}

/** «пн, 1 декабря» — строка дня в свёрнутых группах и заголовок его деталей. */
export function dayLabel(date: string, today: string): string {
  return `${ru.contract.weekdays[weekdayIndex(date)]}, ${formatDeadline(date, today)}`;
}

/** «пн 1» — подпись ромба в неделе. */
export function weekLabel(date: string): string {
  return `${ru.contract.weekdays[weekdayIndex(date)]} ${Number(date.slice(8))}`;
}
