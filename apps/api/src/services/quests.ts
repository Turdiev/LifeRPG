import {
  applyAddChild,
  applyCancel,
  applyChanges,
  applyComplete,
  applyDelete,
  applyFinishContract,
  applyPause,
  applyReopen,
  applyRestore,
  applyResume,
  DomainError,
  isBranchLocked,
  isContract,
  isContractDay,
  kindAtDepth,
  type CancelOptions,
  type Change,
  type CompleteOptions,
  type Tree,
} from '@life-rpg/domain';
import type {
  CreateBatchRequest,
  CreateQuestRequest,
  MoveQuestRequest,
  MutationResponse,
  UpdateQuestRequest,
} from '@life-rpg/shared';
import { generateKeyBetween, generateNKeysBetween } from 'fractional-indexing';
import type { Db, Tx } from '../db/client';
import {
  deleteQuest as deleteQuestRow,
  findLineNodes,
  insertQuest,
  insertQuests,
  toQuest,
  touchQuest,
  updateFields,
  updatePosition,
  updateStatuses,
  type QuestRecord,
} from '../db/quests-repository';
import { getActiveQuestId } from '../db/settings-repository';
import { ValidationError } from '../errors';
import { reconcileActiveQuest } from './active-quest';
import { lockLineOf } from './line-lock';

export type StatusAction = 'complete' | 'reopen' | 'pause' | 'resume' | 'cancel' | 'restore' | 'finish';
type StatusOptions = CompleteOptions & CancelOptions;

const statusActions: Record<StatusAction, (tree: Tree, id: string, now: string, options: StatusOptions) => Change[]> = {
  complete: applyComplete,
  reopen: applyReopen,
  pause: applyPause,
  resume: applyResume,
  cancel: applyCancel,
  restore: applyRestore,
  finish: applyFinishContract,
};

export async function changeStatus(
  db: Db,
  userId: string,
  questId: string,
  action: StatusAction,
  options: StatusOptions = {},
): Promise<MutationResponse> {
  return db.transaction(async (tx) => {
    const { quest, nodes, tree } = await lockLineOf(tx, userId, questId);
    // Старый закешированный клиент не присылает `today` и не должен отметить день вслепую (tech-spec, правило 9).
    if ((action === 'complete' || action === 'cancel') && isContractDay(quest) && options.today === undefined) {
      throw new ValidationError('A contract day needs today');
    }
    const changes = statusActions[action](tree, questId, new Date().toISOString(), options);
    await updateStatuses(tx, userId, changes);
    return respond(tx, userId, applyChanges(nodes, changes), ids(changes));
  });
}

export async function createQuest(db: Db, userId: string, body: CreateQuestRequest): Promise<MutationResponse> {
  return db.transaction(async (tx) => {
    const { quest: parent, nodes, tree } = await lockLineOf(tx, userId, body.parentId);
    // Дни контракта создаёт только расписание (tech-spec, правило 9): здесь и ниже — ручные эндпоинты.
    if (isContract(parent)) throw new DomainError('invalid_parent');
    const lastSibling = tree.children.get(parent.id)?.at(-1);
    const now = new Date().toISOString();
    const record: QuestRecord = {
      id: crypto.randomUUID(),
      lineId: parent.lineId,
      parentId: parent.id,
      kind: body.kind,
      status: 'open',
      position: generateKeyBetween(lastSibling?.position ?? null, null),
      title: body.title,
      description: body.description ?? null,
      deadline: body.deadline ?? null,
      schedule: null,
      scheduledOn: null,
      completedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    // Домен проверяет вложенность и блокировку ветки до записи в базу.
    const changes = applyAddChild(tree, record, now);
    await insertQuest(tx, userId, record);
    await updateStatuses(tx, userId, changes);
    return respond(tx, userId, applyChanges([...nodes, record], changes), [record.id, ...ids(changes)]);
  });
}

type BatchDraft = { title: string; children: readonly BatchDraft[] };

/** Вставленный список (tech-spec, правило 8): всё поддерево одной транзакцией и одной вставкой. */
export async function createBatch(db: Db, userId: string, body: CreateBatchRequest): Promise<MutationResponse> {
  return db.transaction(async (tx) => {
    const { quest: parent, nodes, tree } = await lockLineOf(tx, userId, body.parentId);
    if (isContract(parent)) throw new DomainError('invalid_parent');
    const records: QuestRecord[] = [];
    const updatedAt = new Date().toISOString();

    const place = (drafts: readonly BatchDraft[], parentId: string, depth: number, after: string | null) => {
      const kind = kindAtDepth(body.kind, depth);
      if (!kind) throw new DomainError('invalid_parent');
      const keys = generateNKeysBetween(after, null, drafts.length);
      drafts.forEach((draft, index) => {
        const record: QuestRecord = {
          id: crypto.randomUUID(),
          lineId: parent.lineId,
          parentId,
          kind,
          status: 'open',
          position: keys[index]!,
          title: draft.title,
          description: null,
          deadline: null,
          schedule: null,
          scheduledOn: null,
          completedAt: null,
          createdAt: updatedAt,
          updatedAt,
        };
        records.push(record);
        if (draft.children.length > 0) place(draft.children, record.id, depth + 1, null);
      });
    };
    place(body.items, parent.id, 0, tree.children.get(parent.id)?.at(-1)?.position ?? null);

    // Вложенность и блокировку ветки домен проверяет на первом узле: остальные виды выведены
    // из него, а открытый ребёнок открывает выполненных предков один раз.
    const changes = applyAddChild(tree, records[0]!, updatedAt);
    await insertQuests(tx, userId, records);
    await updateStatuses(tx, userId, changes);
    return respond(tx, userId, applyChanges([...nodes, ...records], changes), [
      ...records.map((record) => record.id),
      ...ids(changes),
    ]);
  });
}

export async function updateQuest(
  db: Db,
  userId: string,
  questId: string,
  body: UpdateQuestRequest,
): Promise<MutationResponse> {
  return db.transaction(async (tx) => {
    const { quest, tree } = await lockLineOf(tx, userId, questId);
    if (isBranchLocked(tree, questId)) throw new DomainError('branch_locked');
    // Название дня — его дата, а срок контракта заменяет дедлайн; описание менять можно.
    const touchesDate = body.deadline !== undefined || (isContractDay(quest) && body.title !== undefined);
    if (touchesDate && (isContract(quest) || isContractDay(quest))) throw new DomainError('invalid_transition');
    const updated = await updateFields(tx, userId, questId, body);
    return { changed: [toQuest(updated)], activeQuestId: await getActiveQuestId(tx, userId) };
  });
}

export async function moveQuest(
  db: Db,
  userId: string,
  questId: string,
  { afterId }: MoveQuestRequest,
): Promise<MutationResponse> {
  return db.transaction(async (tx) => {
    const { quest, tree } = await lockLineOf(tx, userId, questId);
    // Порядок линий в журнале — отдельная задача; здесь только «братья» внутри родителя (F-05).
    // Порядок дней контракта — порядок дат.
    if (quest.parentId === null || isContractDay(quest)) throw new DomainError('invalid_transition');
    if (isBranchLocked(tree, questId)) throw new DomainError('branch_locked');

    const siblings = (tree.children.get(quest.parentId) ?? []).filter((node) => node.id !== questId);
    const afterIndex = afterId === null ? -1 : siblings.findIndex((node) => node.id === afterId);
    // Соседа нет среди «братьев» — это перенос в другого родителя (F-06), он не поддерживается.
    if (afterId !== null && afterIndex === -1) throw new DomainError('invalid_parent');

    const position = generateKeyBetween(
      siblings[afterIndex]?.position ?? null,
      siblings[afterIndex + 1]?.position ?? null,
    );
    const moved = await updatePosition(tx, userId, questId, position);
    return { changed: [toQuest(moved)], activeQuestId: await getActiveQuestId(tx, userId) };
  });
}

export async function deleteQuest(db: Db, userId: string, questId: string): Promise<MutationResponse> {
  return db.transaction(async (tx) => {
    const { quest, tree } = await lockLineOf(tx, userId, questId);
    if (isContractDay(quest)) throw new DomainError('invalid_transition');
    const changes = applyDelete(tree, questId, new Date().toISOString());
    await deleteQuestRow(tx, userId, questId);
    if (questId !== quest.lineId) await touchQuest(tx, userId, quest.lineId);
    await updateStatuses(tx, userId, changes);
    // Удалённое активное задание уже сбросил `ON DELETE SET NULL`, и предложения нет; но если
    // удаление закрыло активное задание (ушёл его последний открытый этап), предложение будет.
    const remaining = await findLineNodes(tx, userId, quest.lineId);
    return respond(tx, userId, remaining, ids(changes));
  });
}

export function ids(changes: readonly Change[]): string[] {
  return changes.map((change) => change.id);
}

export async function respond(
  tx: Tx,
  userId: string,
  lineNodes: readonly QuestRecord[],
  changedIds: readonly string[],
): Promise<MutationResponse> {
  // Вставка списка возвращает сотни узлов: поиск по Map, а не перебором всей линии.
  const byId = new Map(lineNodes.map((node) => [node.id, node]));
  const changed = changedIds.map((id) => toQuest(byId.get(id)!));
  return { changed, ...(await reconcileActiveQuest(tx, userId, lineNodes)) };
}
