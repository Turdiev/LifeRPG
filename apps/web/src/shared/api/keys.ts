import type { LinesResponse } from '@life-rpg/shared';

type QuestStatus = LinesResponse['lines'][number]['status'];

/** Все ключи TanStack Query в одном месте (tech-spec, «Данные и кэш»). */
export const queryKeys = {
  allLines: ['lines'] as const,
  lines: (status: QuestStatus) => ['lines', status] as const,
  tree: (lineId: string) => ['tree', lineId] as const,
  today: ['today'] as const,
  session: ['session'] as const,
};
