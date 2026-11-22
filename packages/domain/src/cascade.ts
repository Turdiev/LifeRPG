// Каскады статусов. Функции чистые: дерево не меняют, а возвращают изменения,
// которые вызывающий должен сохранить, или бросают DomainError.
import { DomainError } from './errors';
import { ancestorsOf, buildTree, childrenOf, getNode, isContract, isContractDay, isLocked } from './tree';
import type { Change, QuestKind, QuestNode, QuestStatus, Tree } from './types';

const ALLOWED_CHILDREN: Record<QuestKind, readonly QuestKind[]> = {
  line: ['chapter', 'quest'],
  chapter: ['quest'],
  quest: ['step'],
  step: [],
};

export type CompleteOptions = {
  /** Пользователь подтвердил диалог «Отметить все этапы выполненными?». */
  withChildren?: boolean;
  /** Дата устройства `YYYY-MM-DD`; нужна дню контракта, чтобы не отметить его вперёд. */
  today?: string;
};

export type CancelOptions = {
  /** Дата устройства `YYYY-MM-DD`; нужна дню контракта, чтобы не отменить его вперёд. */
  today?: string;
};

/**
 * Глава и линия отмечаются вручную, только пока в них нет неотменённых детей. Контракт целиком
 * не отмечается: вместо вопроса «Отметить все этапы?» его завершают (PRD, «Контракты», правило 5).
 */
export function applyComplete(tree: Tree, id: string, now: string, options: CompleteOptions = {}): Change[] {
  const node = getNode(tree, id);
  assertUnlocked(tree, node);
  if (isContract(node)) throw new DomainError('invalid_transition');
  if (node.status === 'done') return [];
  if (isContractDay(node) && node.scheduledOn > requireToday(options.today)) throw new DomainError('not_due');

  const draft = new Draft(tree);
  const children = draft.liveChildren(id);
  if (children.length > 0) {
    if (node.kind !== 'quest') throw new DomainError('invalid_transition');
    const open = children.filter((child) => draft.status(child.id) !== 'done');
    if (open.length > 0 && !options.withChildren) throw new DomainError('has_open_children');
    for (const child of open) draft.set(child.id, 'done');
  }
  draft.set(id, 'done');
  draft.recomputeAncestors(id);
  return draft.changes(now);
}

/**
 * Открывает и выполненных потомков: иначе подъём статуса сразу закрыл бы узел снова. У контракта это
 * стёрло бы все отметки дней разом, поэтому снимают отметку с дня (PRD, «Контракты», правило 5).
 */
export function applyReopen(tree: Tree, id: string, now: string): Change[] {
  const node = getNode(tree, id);
  assertUnlocked(tree, node);
  if (isContract(node)) throw new DomainError('invalid_transition');
  if (node.status !== 'done') return [];

  const draft = new Draft(tree);
  draft.set(id, 'open');
  const reopenDescendants = (parentId: string) => {
    for (const child of childrenOf(tree, parentId)) {
      if (child.status === 'done') draft.set(child.id, 'open');
      if (!isLocked(child)) reopenDescendants(child.id);
    }
  };
  reopenDescendants(id);
  draft.recomputeAncestors(id);
  return draft.changes(now);
}

/** Родитель берётся из `node.parentId`; новый ребёнок открывает выполненных предков. */
export function applyAddChild(tree: Tree, node: QuestNode, now: string): Change[] {
  if (node.parentId === null) throw new DomainError('invalid_parent');
  const parent = getNode(tree, node.parentId);
  if (!ALLOWED_CHILDREN[parent.kind].includes(node.kind)) throw new DomainError('invalid_parent');
  assertUnlocked(tree, parent);

  const draft = new Draft(buildTree([...tree.nodes.values(), node]));
  draft.recomputeAncestors(node.id);
  return draft.changes(now);
}

/** Статусы потомков не меняются (правило 4 PRD). */
export function applyPause(tree: Tree, id: string, now: string): Change[] {
  const node = getNode(tree, id);
  assertAncestorsUnlocked(tree, node);
  if (node.kind !== 'line' && node.kind !== 'chapter') throw new DomainError('invalid_transition');
  if (node.status === 'paused') return [];
  if (node.status === 'cancelled') throw new DomainError('invalid_transition');

  const draft = new Draft(tree);
  draft.set(id, 'paused');
  draft.recomputeAncestors(id);
  return draft.changes(now);
}

/** Узел возвращается в состояние по своим детям: «возобновление возвращает всё как было». */
export function applyResume(tree: Tree, id: string, now: string): Change[] {
  const node = getNode(tree, id);
  assertAncestorsUnlocked(tree, node);
  if (node.status === 'cancelled') throw new DomainError('invalid_transition');
  if (node.status !== 'paused') return [];

  const draft = new Draft(tree);
  draft.set(id, draft.derivedStatus(id));
  draft.recomputeAncestors(id);
  return draft.changes(now);
}

/**
 * Ветка выпадает из прогресса родителя; статусы потомков не меняются. Будущий день контракта
 * не отменяют — меняют расписание; последний неотменённый тоже: иначе контракт молча закрылся бы
 * без итога (PRD, «Контракты», правило 3).
 */
export function applyCancel(tree: Tree, id: string, now: string, options: CancelOptions = {}): Change[] {
  const node = getNode(tree, id);
  assertAncestorsUnlocked(tree, node);
  if (node.status === 'cancelled') return [];

  const draft = new Draft(tree);
  if (isContractDay(node)) {
    if (node.scheduledOn > requireToday(options.today)) throw new DomainError('invalid_transition');
    const otherLiveDays = draft.liveChildren(node.parentId!).filter((child) => child.id !== id);
    if (otherLiveDays.length === 0) throw new DomainError('invalid_transition');
  }
  draft.set(id, 'cancelled');
  draft.recomputeAncestors(id);
  return draft.changes(now);
}

/** Узел возвращается в состояние по своим детям; отменённый этап — открытым. */
export function applyRestore(tree: Tree, id: string, now: string): Change[] {
  const node = getNode(tree, id);
  assertAncestorsUnlocked(tree, node);
  if (node.status !== 'cancelled') return [];

  const draft = new Draft(tree);
  draft.set(id, draft.derivedStatus(id));
  draft.recomputeAncestors(id);
  return draft.changes(now);
}

/** Изменения только оставшихся узлов: удалённая ветка в результат не попадает. */
export function applyDelete(tree: Tree, id: string, now: string): Change[] {
  const draft = new Draft(tree);
  draft.remove(id);
  draft.recomputeAncestors(id);
  return draft.changes(now);
}

// Экспорт для contract.ts; из index.ts наружу не выходит.
export function assertUnlocked(tree: Tree, node: QuestNode): void {
  if (isLocked(node)) throw new DomainError('branch_locked');
  assertAncestorsUnlocked(tree, node);
}

function assertAncestorsUnlocked(tree: Tree, node: QuestNode): void {
  if (ancestorsOf(tree, node.id).some(isLocked)) throw new DomainError('branch_locked');
}

/** API проверяет `today` до домена (`400`), так что без него сюда доходит только ошибка в коде. */
function requireToday(today: string | undefined): string {
  if (today === undefined) throw new Error('A contract day needs today');
  return today;
}

/** Черновик статусов поверх неизменного дерева; `changes` отдаёт разницу с исходным. */
export class Draft {
  private readonly tree: Tree;
  private readonly statuses = new Map<string, QuestStatus>();
  private readonly removed = new Set<string>();

  constructor(tree: Tree) {
    this.tree = tree;
  }

  status(id: string): QuestStatus {
    return this.statuses.get(id) ?? getNode(this.tree, id).status;
  }

  set(id: string, status: QuestStatus): void {
    this.statuses.set(id, status);
  }

  remove(id: string): void {
    this.removed.add(id);
    for (const child of childrenOf(this.tree, id)) this.remove(child.id);
  }

  liveChildren(id: string): QuestNode[] {
    return childrenOf(this.tree, id).filter(
      (child) => !this.removed.has(child.id) && this.status(child.id) !== 'cancelled',
    );
  }

  derivedStatus(id: string): 'open' | 'done' {
    const children = this.liveChildren(id);
    return children.length > 0 && children.every((child) => this.status(child.id) === 'done') ? 'done' : 'open';
  }

  /** Статус предка на паузе или отменённого ручной, поэтому подъём на нём останавливается. */
  recomputeAncestors(id: string): void {
    for (const ancestor of ancestorsOf(this.tree, id)) {
      const status = this.status(ancestor.id);
      if (status === 'paused' || status === 'cancelled') break;
      this.set(ancestor.id, this.derivedStatus(ancestor.id));
    }
  }

  changes(now: string): Change[] {
    const changes: Change[] = [];
    for (const [id, status] of this.statuses) {
      if (status === getNode(this.tree, id).status) continue;
      changes.push({ id, status, completedAt: status === 'done' ? now : null });
    }
    return changes;
  }
}
