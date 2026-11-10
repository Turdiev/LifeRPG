import { buildTree, progress, type QuestNode, type QuestStatus } from '@life-rpg/domain';
import type { CreateLineRequest, LineTreeResponse, LinesResponse, MutationResponse } from '@life-rpg/shared';
import { generateKeyBetween } from 'fractional-indexing';
import type { Db } from '../db/client';
import {
  countLinesByStatus,
  findLineNodes,
  findLines,
  findNodesOfLines,
  insertQuest,
  lastLinePosition,
  toQuest,
  type QuestRecord,
} from '../db/quests-repository';
import { getActiveQuestId } from '../db/settings-repository';
import { NotFoundError } from '../errors';

export async function listLines(db: Db, userId: string, status: QuestStatus): Promise<LinesResponse> {
  const lines = await findLines(db, userId, status);
  const nodes = await findNodesOfLines(
    db,
    userId,
    lines.map((line) => line.id),
  );
  const activeQuestId = await getActiveQuestId(db, userId);

  const byLine = new Map<string, QuestRecord[]>();
  for (const node of nodes) {
    const group = byLine.get(node.lineId);
    if (group) group.push(node);
    else byLine.set(node.lineId, [node]);
  }
  const summaries = lines.map((line) => {
    const lineNodes = byLine.get(line.id) ?? [];
    const tree = buildTree(lineNodes);
    const summary = {
      id: line.id,
      title: line.title,
      description: line.description,
      deadline: line.deadline,
      status: line.status,
      progress: progress(tree, line.id),
      chapters: chapterPosition(tree.children.get(line.id) ?? []),
      hasActiveQuest: lineNodes.some((node) => node.id === activeQuestId),
    };
    const lastChangedAt = lineNodes.reduce((latest, node) => (node.updatedAt > latest ? node.updatedAt : latest), '');
    return { summary, lastChangedAt, position: line.position };
  });

  // docs/ux.md, журнал: первой — линия с активным квестом, остальные — по последнему изменению.
  summaries.sort(
    (a, b) =>
      Number(b.summary.hasActiveQuest) - Number(a.summary.hasActiveQuest) ||
      compare(b.lastChangedAt, a.lastChangedAt) ||
      compare(a.position, b.position),
  );
  return { lines: summaries.map(({ summary }) => summary), counts: await countLinesByStatus(db, userId) };
}

function chapterPosition(lineChildren: readonly QuestNode[]): { current: number; total: number } | null {
  const chapters = lineChildren.filter((child) => child.kind === 'chapter' && child.status !== 'cancelled');
  if (chapters.length === 0) return null;
  const unfinished = chapters.findIndex((chapter) => chapter.status !== 'done');
  return { current: unfinished === -1 ? chapters.length : unfinished + 1, total: chapters.length };
}

function compare(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

export async function createLine(db: Db, userId: string, body: CreateLineRequest): Promise<MutationResponse> {
  const id = crypto.randomUUID();
  const line: QuestRecord = {
    id,
    lineId: id,
    parentId: null,
    kind: 'line',
    status: 'open',
    position: generateKeyBetween(await lastLinePosition(db, userId), null),
    title: body.title,
    description: body.description ?? null,
    deadline: body.deadline ?? null,
    completedAt: null,
    updatedAt: new Date().toISOString(),
  };
  await insertQuest(db, userId, line);
  return { changed: [toQuest(line)], activeQuestId: await getActiveQuestId(db, userId) };
}

export async function getLineTree(db: Db, userId: string, lineId: string): Promise<LineTreeResponse> {
  const nodes = await findLineNodes(db, userId, lineId);
  // Для id задания или главы `line_id = id` ничего не найдёт — тоже 404.
  if (!nodes.some((node) => node.id === lineId)) throw new NotFoundError();

  const tree = buildTree(nodes);
  return {
    nodes: nodes.map((node) => ({ ...toQuest(node), progress: progress(tree, node.id) })),
    activeQuestId: await getActiveQuestId(db, userId),
  };
}
