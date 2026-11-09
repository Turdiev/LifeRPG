export type QuestKind = 'line' | 'chapter' | 'quest' | 'step';

export type QuestStatus = 'open' | 'done' | 'paused' | 'cancelled';

export type QuestNode = {
  id: string;
  parentId: string | null;
  kind: QuestKind;
  status: QuestStatus;
  /** Ключ fractional-indexing; «братья» сортируются побайтово. */
  position: string;
  title: string;
  deadline: string | null;
  completedAt: string | null;
};

/** Узлы, которых нет в списке изменений, не изменились. */
export type Change = {
  id: string;
  status: QuestStatus;
  completedAt: string | null;
};

/** Одна сюжетная линия. Строится `buildTree` и не меняется. */
export type Tree = {
  readonly nodes: ReadonlyMap<string, QuestNode>;
  /** Отсортированы по `position`; у узлов без детей записи нет. */
  readonly children: ReadonlyMap<string, readonly QuestNode[]>;
};
