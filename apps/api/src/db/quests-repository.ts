import type { Change, QuestStatus } from '@life-rpg/domain';
import type { Quest } from '@life-rpg/shared';
import { and, asc, count, desc, eq, inArray, sql } from 'drizzle-orm';
import type { Executor } from './client';
import { quests } from './schema';

export type QuestRecord = Quest & { lineId: string; updatedAt: string };

function toRecord(row: typeof quests.$inferSelect): QuestRecord {
  return {
    id: row.id,
    lineId: row.lineId,
    parentId: row.parentId,
    kind: row.kind,
    status: row.status,
    position: row.position,
    title: row.title,
    description: row.description,
    deadline: row.deadline,
    completedAt: row.completedAt?.toISOString() ?? null,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toQuest(record: QuestRecord): Quest {
  return {
    id: record.id,
    parentId: record.parentId,
    kind: record.kind,
    status: record.status,
    position: record.position,
    title: record.title,
    description: record.description,
    deadline: record.deadline,
    completedAt: record.completedAt,
  };
}

const ownedBy = (userId: string, id: string) => and(eq(quests.id, id), eq(quests.userId, userId));

export async function findQuest(ex: Executor, userId: string, id: string): Promise<QuestRecord | null> {
  const [row] = await ex.select().from(quests).where(ownedBy(userId, id));
  return row ? toRecord(row) : null;
}

/** Блокирует корень линии до конца транзакции: мутации одной линии идут по очереди. */
export async function lockLine(ex: Executor, userId: string, lineId: string): Promise<void> {
  await ex.select({ id: quests.id }).from(quests).where(ownedBy(userId, lineId)).for('update');
}

export async function findLineNodes(ex: Executor, userId: string, lineId: string): Promise<QuestRecord[]> {
  const rows = await ex
    .select()
    .from(quests)
    .where(and(eq(quests.lineId, lineId), eq(quests.userId, userId)));
  return rows.map(toRecord);
}

export async function findLines(ex: Executor, userId: string, status: QuestStatus): Promise<QuestRecord[]> {
  const rows = await ex
    .select()
    .from(quests)
    .where(and(eq(quests.userId, userId), eq(quests.kind, 'line'), eq(quests.status, status)))
    .orderBy(asc(quests.position));
  return rows.map(toRecord);
}

export async function findNodesOfLines(ex: Executor, userId: string, lineIds: string[]): Promise<QuestRecord[]> {
  if (lineIds.length === 0) return [];
  const rows = await ex
    .select()
    .from(quests)
    .where(and(inArray(quests.lineId, lineIds), eq(quests.userId, userId)));
  return rows.map(toRecord);
}

export async function countLinesByStatus(ex: Executor, userId: string): Promise<Record<QuestStatus, number>> {
  const rows = await ex
    .select({ status: quests.status, count: count() })
    .from(quests)
    .where(and(eq(quests.userId, userId), eq(quests.kind, 'line')))
    .groupBy(quests.status);
  const counts: Record<QuestStatus, number> = { open: 0, paused: 0, done: 0, cancelled: 0 };
  for (const row of rows) counts[row.status] = row.count;
  return counts;
}

/** Удаление не оставляет строки с новым `updated_at`, а порядок журнала на нём держится. */
export async function touchQuest(ex: Executor, userId: string, id: string): Promise<void> {
  await ex.update(quests).set({ updatedAt: new Date() }).where(ownedBy(userId, id));
}

export async function lastLinePosition(ex: Executor, userId: string): Promise<string | null> {
  const [row] = await ex
    .select({ position: quests.position })
    .from(quests)
    .where(and(eq(quests.userId, userId), eq(quests.kind, 'line')))
    .orderBy(desc(quests.position))
    .limit(1);
  return row?.position ?? null;
}

export async function insertQuest(ex: Executor, userId: string, record: QuestRecord): Promise<void> {
  await ex.insert(quests).values({
    id: record.id,
    userId,
    lineId: record.lineId,
    parentId: record.parentId,
    kind: record.kind,
    status: record.status,
    position: record.position,
    title: record.title,
    description: record.description,
    deadline: record.deadline,
  });
}

/** Все изменения каскада — одним запросом. */
export async function updateStatuses(ex: Executor, userId: string, changes: readonly Change[]): Promise<void> {
  if (changes.length === 0) return;
  const values = sql.join(
    changes.map((c) => sql`(${c.id}::uuid, ${c.status}::quest_status, ${c.completedAt}::timestamptz)`),
    sql`, `,
  );
  await ex.execute(sql`
    UPDATE quests AS q
    SET status = v.status, completed_at = v.completed_at, updated_at = now()
    FROM (VALUES ${values}) AS v(id, status, completed_at)
    WHERE q.id = v.id AND q.user_id = ${userId}
  `);
}

export type QuestFields = { title?: string; description?: string | null; deadline?: string | null };

export async function updateFields(ex: Executor, userId: string, id: string, fields: QuestFields): Promise<QuestRecord> {
  const [row] = await ex
    .update(quests)
    .set({ ...fields, updatedAt: new Date() })
    .where(ownedBy(userId, id))
    .returning();
  return toRecord(row!);
}

export async function updatePosition(ex: Executor, userId: string, id: string, position: string): Promise<QuestRecord> {
  const [row] = await ex
    .update(quests)
    .set({ position, updatedAt: new Date() })
    .where(ownedBy(userId, id))
    .returning();
  return toRecord(row!);
}

/** Потомков удаляет `ON DELETE CASCADE` по `parent_id`. */
export async function deleteQuest(ex: Executor, userId: string, id: string): Promise<void> {
  await ex.delete(quests).where(ownedBy(userId, id));
}
