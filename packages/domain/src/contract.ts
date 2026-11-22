// Контракты (PRD, «Контракты (v2)»): задание с расписанием, его этапы — дни. Прогресс и каскады
// работают с днями как с обычными этапами; здесь — только то, что делает расписание.
import { assertUnlocked, Draft } from './cascade';
import { DomainError } from './errors';
import { ancestorsOf, buildTree, childrenOf, getNode, isContract, isContractDay } from './tree';
import type { Change, QuestNode, Schedule, Tree } from './types';

/** Даты новых дней, id удаляемых дней и дней, которые возвращаются открытыми. */
export type SchedulePlan = {
  add: string[];
  remove: string[];
  restore: string[];
};

const DAY_MS = 24 * 60 * 60 * 1000;
const ALL_WEEKDAYS = 127;
/** Срок включительно: 365 дней между началом и концом — это 366 дней-этапов. */
export const MAX_TERM_DAYS = 365;

/**
 * Срок, который форма предлагает при включении (правило 1): с сегодня до дедлайна главы, а без неё —
 * цели. Прошедший или слишком далёкий дедлайн не заменяется дедлайном цели: подставленная чужая дата
 * удивила бы сильнее пустого поля, и конец (`null`) выбирает пользователь.
 */
export function defaultTerm(tree: Tree, questId: string, today: string): { start: string; end: string | null } {
  const parent = getNode(tree, getNode(tree, questId).parentId!);
  const deadline =
    parent.kind === 'chapter' && parent.deadline !== null
      ? parent.deadline
      : (ancestorsOf(tree, questId).at(-1)?.deadline ?? null);
  const fits = deadline !== null && deadline >= today && (toMs(deadline) - toMs(today)) / DAY_MS <= MAX_TERM_DAYS;
  return { start: today, end: fits ? deadline : null };
}

/** Даты расписания начиная с `from` (или с начала срока, если оно позже). */
export function contractDates(schedule: Schedule, from: string): string[] {
  const dates: string[] = [];
  const end = toMs(schedule.end);
  for (let ms = toMs(from > schedule.start ? from : schedule.start); ms <= end; ms += DAY_MS) {
    if (schedule.weekdays & weekdayBit(ms)) dates.push(toDate(ms));
  }
  return dates;
}

/**
 * Включение и изменение расписания (правила 1 и 6). Трогает только невыполненные дни с `today`
 * и позже. Возвращаются только дни позже `today`: их могло отменить лишь завершение, а сегодняшний
 * день пользователь мог отменить сам («болел»), и снова сохранённое расписание не должно это стирать.
 */
export function planSchedule(tree: Tree, questId: string, schedule: Schedule, today: string): SchedulePlan {
  const node = getNode(tree, questId);
  if (node.kind !== 'quest') throw new DomainError('invalid_transition');
  assertUnlocked(tree, node);
  assertValidTerm(schedule);

  if (node.schedule == null) {
    if (childrenOf(tree, questId).length > 0 || schedule.start < today) throw new DomainError('invalid_transition');
  } else if (schedule.start !== node.schedule.start && (node.schedule.start <= today || schedule.start < today)) {
    // Начало переносится, пока контракт не начался: ни один день не наступил, отмечать было нечего.
    throw new DomainError('invalid_transition');
  }

  const days = childrenOf(tree, questId).filter(isContractDay);
  const wanted = new Set(contractDates(schedule, today));
  const existing = new Set(days.map((day) => day.scheduledOn));
  const changeable = days.filter((day) => day.scheduledOn >= today && day.status !== 'done');
  const plan: SchedulePlan = {
    add: [...wanted].filter((date) => !existing.has(date)),
    remove: changeable.filter((day) => !wanted.has(day.scheduledOn)).map((day) => day.id),
    restore: changeable
      .filter((day) => day.status === 'cancelled' && day.scheduledOn > today && wanted.has(day.scheduledOn))
      .map((day) => day.id),
  };

  // Без живых дней задание стало бы листом, который нельзя ни отметить, ни завершить.
  const removed = new Set(plan.remove);
  const restored = new Set(plan.restore);
  const liveLeft = days.filter(
    (day) => !removed.has(day.id) && (day.status !== 'cancelled' || restored.has(day.id)),
  ).length;
  if (liveLeft + plan.add.length === 0) throw new DomainError('invalid_transition');
  return plan;
}

/**
 * Применяет план одним проходом: дерево собирается один раз, статус поднимается один раз — как у
 * вставки списка. Узлы новых дней с ключами порядка создаёт сервис: `fractional-indexing` живёт там.
 */
export function applySchedule(
  tree: Tree,
  questId: string,
  plan: SchedulePlan,
  newDays: readonly QuestNode[],
  now: string,
): Change[] {
  const draft = new Draft(buildTree([...tree.nodes.values(), ...newDays]));
  for (const id of plan.remove) draft.remove(id);
  for (const id of plan.restore) draft.set(id, 'open');
  draft.set(questId, draft.derivedStatus(questId));
  draft.recomputeAncestors(questId);
  return draft.changes(now);
}

/**
 * Снять расписание можно, пока ни один день не отмечен (правило 7); сервис удаляет дни и обнуляет
 * расписание. Статусы при этом не меняются: без отмеченных дней контракт и его предки и так открыты, —
 * поэтому функция только проверяет и возвращает `Change[]`, как остальные мутации.
 */
export function applyRemoveSchedule(tree: Tree, questId: string): Change[] {
  const node = getNode(tree, questId);
  if (!isContract(node)) throw new DomainError('invalid_transition');
  assertUnlocked(tree, node);
  if (childrenOf(tree, questId).some((day) => day.status === 'done')) throw new DomainError('invalid_transition');
  return [];
}

/** Неотмеченные дни, включая будущие, отменяются, и пропуски не тянут вниз прогресс цели (правило 5). */
export function applyFinishContract(tree: Tree, questId: string, now: string): Change[] {
  const node = getNode(tree, questId);
  if (!isContract(node)) throw new DomainError('invalid_transition');
  assertUnlocked(tree, node);
  if (node.status === 'done') return [];
  const days = childrenOf(tree, questId);
  if (!days.some((day) => day.status === 'done')) throw new DomainError('invalid_transition');

  const draft = new Draft(tree);
  for (const day of days) if (day.status === 'open') draft.set(day.id, 'cancelled');
  draft.set(questId, draft.derivedStatus(questId));
  draft.recomputeAncestors(questId);
  return draft.changes(now);
}

function assertValidTerm(schedule: Schedule): void {
  const valid =
    Number.isInteger(schedule.weekdays) &&
    schedule.weekdays >= 1 &&
    schedule.weekdays <= ALL_WEEKDAYS &&
    schedule.end >= schedule.start &&
    (toMs(schedule.end) - toMs(schedule.start)) / DAY_MS <= MAX_TERM_DAYS;
  if (!valid) throw new DomainError('invalid_transition');
}

// Даты считаются в UTC: день недели у `YYYY-MM-DD` не должен зависеть от часового пояса сервера.
function toMs(date: string): number {
  return Date.parse(`${date}T00:00:00Z`);
}

function toDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** `getUTCDay` начинает неделю с воскресенья, маска — с понедельника. */
function weekdayBit(ms: number): number {
  return 1 << ((new Date(ms).getUTCDay() + 6) % 7);
}
