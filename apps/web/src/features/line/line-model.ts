import {
  applyAddChild,
  applyCancel,
  applyChanges,
  applyComplete,
  applyDelete,
  applyPause,
  applyReopen,
  applyRestore,
  applyResume,
  buildTree,
  canBeActive,
  isBranchLocked,
  kindAtDepth,
  progress,
  type Change,
  type CompleteOptions,
  type DraftKind,
  type QuestDraft,
  type Progress,
  type Tree,
} from '@life-rpg/domain';
import type { LineTreeResponse, MutationResponse } from '@life-rpg/shared';

export type TreeNode = LineTreeResponse['nodes'][number];
export type NodeAction = 'complete' | 'reopen' | 'pause' | 'resume' | 'cancel' | 'restore';

/** Выполненные элементы уровня сворачиваются в строку «Выполнено: N» внизу группы (docs/ux.md). */
export type Group<T> = { items: T[]; done: T[] };
export type StepView = { node: TreeNode; locked: boolean };
export type QuestView = {
  node: TreeNode;
  progress: Progress;
  isActive: boolean;
  locked: boolean;
  steps: Group<StepView>;
};
export type ChapterView = {
  node: TreeNode;
  progress: Progress;
  locked: boolean;
  /** Заблокирован предок: тогда и пауза, и отмена самой главы недоступны. */
  branchLocked: boolean;
  /** «3 / 8» в шапке главы: выполненные задания из неотменённых. */
  questCount: Progress;
  quests: Group<QuestView>;
};
/** Отрезок шкалы прогресса цели: глава или задания прямо в линии (id линии). */
export type ProgressSegment = { id: string; title: string; done: number; total: number; active: boolean };
export type LineView = {
  line: TreeNode;
  progress: Progress;
  chapters: Group<ChapterView>;
  quests: Group<QuestView>;
  segments: ProgressSegment[];
  defaultOpenChapterId: string | null;
};

/** `keepInPlace` — отмеченные в этой сессии: остаются на месте с галочкой, а не прячутся в «Выполнено». */
export function buildLineView(
  nodes: readonly TreeNode[],
  activeQuestId: string | null,
  keepInPlace: ReadonlySet<string> = new Set(),
): LineView | null {
  const line = nodes.find((node) => node.parentId === null);
  if (!line) return null;
  const tree = buildTree(nodes);
  // tree.nodes хранит узлы как QuestNode; полные TreeNode берём из исходного массива.
  const full = new Map(nodes.map((node) => [node.id, node]));
  const folded = (node: TreeNode) => node.status === 'done' && !keepInPlace.has(node.id);
  const group = <T extends { node: TreeNode }>(views: T[]): Group<T> => ({
    items: views.filter((view) => !folded(view.node)),
    done: views.filter((view) => folded(view.node)),
  });
  const childrenOf = (id: string) => (tree.children.get(id) ?? []).map((child) => full.get(child.id)!);
  // Заблокирован сам (пауза, отмена) или его ветка: отмечать такие элементы нельзя (правило 3).
  const locked = (node: TreeNode) =>
    node.status === 'paused' || node.status === 'cancelled' || isBranchLocked(tree, node.id);

  const questView = (node: TreeNode): QuestView => ({
    node,
    progress: progress(tree, node.id),
    isActive: node.id === activeQuestId,
    locked: locked(node),
    steps: group(childrenOf(node.id).map((step) => ({ node: step, locked: locked(step) }))),
  });
  const chapterView = (node: TreeNode): ChapterView => {
    const quests = childrenOf(node.id).filter((quest) => quest.status !== 'cancelled');
    return {
      node,
      progress: progress(tree, node.id),
      locked: locked(node),
      branchLocked: isBranchLocked(tree, node.id),
      questCount: { done: quests.filter((quest) => quest.status === 'done').length, total: quests.length },
      quests: group(childrenOf(node.id).map(questView)),
    };
  };

  const lineChildren = childrenOf(line.id);
  const chapters = group(lineChildren.filter((n) => n.kind === 'chapter').map(chapterView));
  const activeParent = activeQuestId ? full.get(activeQuestId)?.parentId : undefined;
  const defaultOpenChapterId =
    [...chapters.items, ...chapters.done].find((c) => c.node.id === activeParent)?.node.id ??
    chapters.items.find((c) => c.node.status === 'open')?.node.id ??
    null;

  // Отменённые главы выпадают из прогресса (правило 5), пустые ничего в него не вносят.
  const segment = (node: TreeNode): ProgressSegment => ({
    id: node.id,
    title: node.title,
    ...(node.kind === 'line' ? directQuestsProgress(tree, line.id) : progress(tree, node.id)),
    active: node.id === activeParent,
  });
  const segments = [
    ...lineChildren.filter((n) => n.kind === 'chapter' && n.status !== 'cancelled').map(segment),
    segment(line),
  ].filter((s) => s.total > 0);

  return {
    line,
    progress: progress(tree, line.id),
    chapters,
    quests: group(lineChildren.filter((n) => n.kind === 'quest').map(questView)),
    segments,
    defaultOpenChapterId,
  };
}

function directQuestsProgress(tree: Tree, lineId: string): Progress {
  return (tree.children.get(lineId) ?? [])
    .filter((child) => child.kind === 'quest' && child.status !== 'cancelled')
    .map((quest) => progress(tree, quest.id))
    .reduce((sum, p) => ({ done: sum.done + p.done, total: sum.total + p.total }), { done: 0, total: 0 });
}

const actions: Record<NodeAction, (tree: Tree, id: string, now: string, options: CompleteOptions) => Change[]> = {
  complete: applyComplete,
  reopen: applyReopen,
  pause: applyPause,
  resume: applyResume,
  cancel: applyCancel,
  restore: applyRestore,
};

/**
 * Оптимистичный шаг: те же правила домена, что и на сервере (tech-spec, «Данные и кэш»).
 * Ошибку домена бросает наружу — интерфейс спрашивает пользователя до запроса.
 */
export function applyStatusLocally(
  data: LineTreeResponse,
  id: string,
  action: NodeAction,
  now: string,
  options: CompleteOptions = {},
): LineTreeResponse {
  const changes = actions[action](buildTree(data.nodes), id, now, options);
  return withActiveChecked({ ...data, nodes: applyChanges(data.nodes, changes) });
}

export type Draft = { id: string; parentId: string; kind: DraftKind; title: string };

let pendingSeq = 0;

/** Новый узел встаёт последним среди «братьев», пока сервер не выдаст настоящий ключ порядка. */
export function insertLocally(data: LineTreeResponse, draft: Draft, now: string): LineTreeResponse {
  const node = pendingNode(draft);
  const changes = applyAddChild(buildTree(data.nodes), node, now);
  return { ...data, nodes: applyChanges([...data.nodes, node], changes) };
}

function pendingNode(draft: Draft): TreeNode {
  return {
    ...draft,
    status: 'open',
    // Ключи fractional-indexing начинаются с буквы, а '~' больше любой из них: временные узлы
    // идут после настоящих и между собой — по порядку создания, даже когда сосед уже сохранён.
    position: `~${String((pendingSeq += 1)).padStart(8, '0')}`,
    description: null,
    deadline: null,
    completedAt: null,
    progress: { done: 0, total: 0 },
  };
}

/** Черновик с временными id: те же id заменит ответ сервера (`mergeResponse`). */
export type TempDraft = { id: string; title: string; children: TempDraft[] };

export function withTempIds(drafts: readonly QuestDraft[]): TempDraft[] {
  return drafts.map((draft) => ({
    id: `temp-${crypto.randomUUID()}`,
    title: draft.title,
    children: withTempIds(draft.children),
  }));
}

export function tempIdsOf(drafts: readonly TempDraft[]): string[] {
  return drafts.flatMap((draft) => [draft.id, ...tempIdsOf(draft.children)]);
}

/** Вставленный список целиком появляется сразу — родители раньше детей, как в запросе. */
export function insertDraftsLocally(
  data: LineTreeResponse,
  parentId: string,
  top: DraftKind,
  drafts: readonly TempDraft[],
  now: string,
): LineTreeResponse {
  const added: TreeNode[] = [];
  const place = (list: readonly TempDraft[], parent: string, depth: number) => {
    const kind = kindAtDepth(top, depth);
    if (!kind) return;
    for (const draft of list) {
      added.push(pendingNode({ id: draft.id, parentId: parent, kind, title: draft.title }));
      place(draft.children, draft.id, depth + 1);
    }
  };
  place(drafts, parentId, 0);
  if (added.length === 0) return data;
  // Как на сервере: предков переоткрывает один новый ребёнок, остальные узлы — под ним.
  const changes = applyAddChild(buildTree(data.nodes), added[0]!, now);
  return { ...data, nodes: applyChanges([...data.nodes, ...added], changes) };
}

/** Ответ сервера — источник истины: он заменяет локальный расчёт и временные узлы. */
export function mergeResponse(
  data: LineTreeResponse,
  response: MutationResponse,
  removeIds: readonly string[] = [],
): LineTreeResponse {
  const changed = new Map(response.changed.map((node) => [node.id, node]));
  const removed = new Set(removeIds);
  const kept = data.nodes
    .filter((node) => !removed.has(node.id))
    .map((node) => {
      const update = changed.get(node.id);
      return update ? { ...node, ...update } : node;
    });
  const known = new Set(kept.map((node) => node.id));
  const added = response.changed
    .filter((node) => !known.has(node.id))
    .map((node) => ({ ...node, progress: { done: 0, total: 0 } }));
  return { nodes: [...kept, ...added], activeQuestId: response.activeQuestId };
}

export function removeLocally(data: LineTreeResponse, id: string, now: string): LineTreeResponse {
  const tree = buildTree(data.nodes);
  const changes = applyDelete(tree, id, now);
  const removed = new Set([id, ...descendantIds(tree, id)]);
  const nodes = applyChanges(
    data.nodes.filter((node) => !removed.has(node.id)),
    changes,
  );
  return withActiveChecked({ nodes, activeQuestId: removed.has(data.activeQuestId ?? '') ? null : data.activeQuestId });
}

export function descendantCount(nodes: readonly TreeNode[], id: string): number {
  return descendantIds(buildTree(nodes), id).length;
}

function descendantIds(tree: Tree, id: string): string[] {
  return (tree.children.get(id) ?? []).flatMap((child) => [child.id, ...descendantIds(tree, child.id)]);
}

function withActiveChecked(data: LineTreeResponse): LineTreeResponse {
  const { activeQuestId } = data;
  if (activeQuestId === null || !data.nodes.some((node) => node.id === activeQuestId)) return data;
  return canBeActive(buildTree(data.nodes), activeQuestId) ? data : { ...data, activeQuestId: null };
}
