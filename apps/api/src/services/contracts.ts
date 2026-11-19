import { applyChanges, applyRemoveSchedule, applySchedule, planSchedule, type QuestNode } from '@life-rpg/domain';
import type { PutScheduleRequest, ScheduleResponse } from '@life-rpg/shared';
import { generateNKeysBetween } from 'fractional-indexing';
import type { Db } from '../db/client';
import { deleteQuests, insertQuests, setSchedule, updateStatuses, type QuestRecord } from '../db/quests-repository';
import { lockLineOf } from './line-lock';
import { ids, respond } from './quests';

/** Включение и изменение расписания (PRD, «Контракты», правила 1 и 6): все дни — одной транзакцией. */
export async function putSchedule(
  db: Db,
  userId: string,
  questId: string,
  { today, ...schedule }: PutScheduleRequest,
): Promise<ScheduleResponse> {
  return db.transaction(async (tx) => {
    const { quest, nodes, tree } = await lockLineOf(tx, userId, questId);
    const plan = planSchedule(tree, questId, schedule, today);
    const removed = new Set(plan.remove);
    const kept = (tree.children.get(questId) ?? []).filter((day) => !removed.has(day.id));
    const now = new Date().toISOString();
    const newDays = dayRecords(quest, kept, plan.add, now);

    const changes = applySchedule(tree, questId, plan, newDays, now);
    await deleteQuests(tx, userId, plan.remove);
    await insertQuests(tx, userId, newDays);
    await updateStatuses(tx, userId, changes);
    const contract = await setSchedule(tx, userId, questId, schedule);

    const lineNodes = [...nodes.filter((node) => node.id !== questId && !removed.has(node.id)), contract, ...newDays];
    const changedIds = new Set([questId, ...newDays.map((day) => day.id), ...ids(changes)]);
    return { ...(await respond(tx, userId, applyChanges(lineNodes, changes), [...changedIds])), removed: plan.remove };
  });
}

/** Снятие расписания (правило 7): дни удаляются, задание снова обычное. */
export async function removeSchedule(db: Db, userId: string, questId: string): Promise<ScheduleResponse> {
  return db.transaction(async (tx) => {
    const { nodes, tree } = await lockLineOf(tx, userId, questId);
    const changes = applyRemoveSchedule(tree, questId);
    const removed = (tree.children.get(questId) ?? []).map((day) => day.id);
    await deleteQuests(tx, userId, removed);
    await updateStatuses(tx, userId, changes);
    const contract = await setSchedule(tx, userId, questId, null);

    const removedSet = new Set(removed);
    const lineNodes = [...nodes.filter((node) => node.id !== questId && !removedSet.has(node.id)), contract];
    const changedIds = new Set([questId, ...ids(changes)]);
    return { ...(await respond(tx, userId, applyChanges(lineNodes, changes), [...changedIds])), removed };
  });
}

/**
 * Записи новых дней. Ключ порядка — между соседними оставшимися днями по дате, поэтому порядок дней
 * совпадает с датами, а старые строки не переписываются. `kept` отсортированы по ключу, а значит, и по дате:
 * дни создаёт только расписание, а перемещать их нельзя; `dates` идут по возрастанию (`planSchedule`).
 */
function dayRecords(
  contract: QuestRecord,
  kept: readonly QuestNode[],
  dates: readonly string[],
  now: string,
): QuestRecord[] {
  const records: QuestRecord[] = [];
  let next = 0;
  let group: string[] = [];
  const flush = () => {
    const keys = generateNKeysBetween(kept[next - 1]?.position ?? null, kept[next]?.position ?? null, group.length);
    group.forEach((date, index) => {
      records.push({
        id: crypto.randomUUID(),
        lineId: contract.lineId,
        parentId: contract.id,
        kind: 'step',
        status: 'open',
        position: keys[index]!,
        // `title` обязателен в базе, а интерфейс всё равно пишет дату словами из `scheduledOn`.
        title: date,
        description: null,
        deadline: null,
        schedule: null,
        scheduledOn: date,
        completedAt: null,
        createdAt: now,
        updatedAt: now,
      });
    });
    group = [];
  };

  for (const date of dates) {
    while (next < kept.length && kept[next]!.scheduledOn! < date) {
      flush();
      next += 1;
    }
    group.push(date);
  }
  flush();
  return records;
}
