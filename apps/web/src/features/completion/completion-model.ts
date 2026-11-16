import type { LineTreeResponse, Quest } from '@life-rpg/shared';
import { buildLineView, type ProgressSegment, type TreeNode } from '@/features/line/line-model';
import { localDate } from '@/shared/lib/format';

export type CompletionView = {
  kind: 'chapter' | 'line';
  id: string;
  /** Цель, к которой относится шкала: у её отрезка «задания без главы» своя подсказка. */
  lineId: string;
  title: string;
  /** Календарные дни от создания до закрытия включительно: закрытое в день создания — «за 1 день». */
  days: number;
  /** Выполненные задания внутри; отменённые не в счёт, как и в счётчике главы (docs/ux.md). */
  questsDone: number;
  /** Шкала всей цели — та же, что на экране линии. */
  segments: ProgressSegment[];
  /** Отрезки, которые на экране заливаются с нуля: закрытая глава или, у цели, все. */
  filling: string[];
};

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Что показать на экране завершения (F-16) по ответу сервера: `changed` — узлы, которые изменила
 * отметка, `data` — дерево линии, в которое ответ уже влит. Одно касание может закрыть и главу,
 * и цель — тогда показываем цель, старший уровень.
 */
export function completionView(data: LineTreeResponse, changed: readonly Quest[]): CompletionView | null {
  const closed = changed.filter((node) => node.status === 'done');
  const target = closed.find((node) => node.kind === 'line') ?? closed.find((node) => node.kind === 'chapter');
  const node = target && data.nodes.find((n) => n.id === target.id);
  if (!node || node.status !== 'done' || !node.completedAt) return null;

  const lineView = buildLineView(data.nodes, null);
  const segments = (lineView?.segments ?? []).map((s) => ({ ...s, active: false }));
  return {
    kind: node.kind === 'line' ? 'line' : 'chapter',
    id: node.id,
    lineId: lineView?.line.id ?? node.id,
    title: node.title,
    days: calendarDays(node.createdAt, node.completedAt),
    questsDone: descendants(data.nodes, node.id).filter((n) => n.kind === 'quest' && n.status === 'done').length,
    segments,
    filling: node.kind === 'line' ? segments.map((s) => s.id) : segments.filter((s) => s.id === node.id).map((s) => s.id),
  };
}

function calendarDays(from: string, to: string): number {
  const day = (moment: string) => Date.parse(`${localDate(moment)}T00:00:00Z`);
  return Math.round((day(to) - day(from)) / DAY_MS) + 1;
}

/** Отменённые ветки пропускаем целиком: отмена главы не меняет статусы её заданий (правило 5 PRD). */
function descendants(nodes: readonly TreeNode[], id: string): TreeNode[] {
  const result: TreeNode[] = [];
  const queue = [id];
  for (let current = queue.pop(); current !== undefined; current = queue.pop()) {
    for (const node of nodes) {
      if (node.parentId !== current || node.status === 'cancelled') continue;
      result.push(node);
      queue.push(node.id);
    }
  }
  return result;
}
