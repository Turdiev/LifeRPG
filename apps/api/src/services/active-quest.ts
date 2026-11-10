import { buildTree, canBeActive, DomainError, isBranchLocked, nextQuest } from '@life-rpg/domain';
import type { MutationResponse } from '@life-rpg/shared';
import type { Db, Tx } from '../db/client';
import type { QuestRecord } from '../db/quests-repository';
import { clearActiveQuestIf, getActiveQuestId, setActiveQuestId } from '../db/settings-repository';
import { lockLineOf } from './line-lock';

type ActiveQuestState = Pick<MutationResponse, 'activeQuestId' | 'suggestion'>;

/**
 * Правило 6 «Доменной логики»: если после мутации активное задание больше не может быть
 * активным, ссылка очищается, а в ответ идёт предложение следующего задания.
 */
export async function reconcileActiveQuest(
  tx: Tx,
  userId: string,
  lineNodes: readonly QuestRecord[],
): Promise<ActiveQuestState> {
  const activeQuestId = await getActiveQuestId(tx, userId);
  // Активное задание из другой линии мутация этой линии не затрагивает.
  if (activeQuestId === null || !lineNodes.some((node) => node.id === activeQuestId)) return { activeQuestId };

  const tree = buildTree(lineNodes);
  if (canBeActive(tree, activeQuestId)) return { activeQuestId };

  await clearActiveQuestIf(tx, userId, activeQuestId);
  const nextId = nextQuest(tree, activeQuestId);
  const next = nextId === null ? undefined : tree.nodes.get(nextId);
  return next ? { activeQuestId: null, suggestion: { id: next.id, title: next.title } } : { activeQuestId: null };
}

export async function setActiveQuest(db: Db, userId: string, questId: string | null): Promise<MutationResponse> {
  if (questId === null) {
    await setActiveQuestId(db, userId, null);
    return { changed: [], activeQuestId: null };
  }
  return db.transaction(async (tx) => {
    const { tree } = await lockLineOf(tx, userId, questId);
    if (isBranchLocked(tree, questId)) throw new DomainError('branch_locked');
    if (!canBeActive(tree, questId)) throw new DomainError('invalid_transition');
    await setActiveQuestId(tx, userId, questId);
    return { changed: [], activeQuestId: questId };
  });
}
