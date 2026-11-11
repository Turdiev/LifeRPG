import { z } from 'zod';

export const questKindSchema = z.enum(['line', 'chapter', 'quest', 'step']);
export const questStatusSchema = z.enum(['open', 'done', 'paused', 'cancelled']);

const title = z.string().trim().min(1).max(120);
const description = z.string().trim().max(10_000);
const deadline = z.iso.date();

export const questSchema = z.object({
  id: z.uuid(),
  parentId: z.uuid().nullable(),
  kind: questKindSchema,
  status: questStatusSchema,
  position: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  deadline: deadline.nullable(),
  completedAt: z.iso.datetime().nullable(),
});
export type Quest = z.infer<typeof questSchema>;

export const progressSchema = z.object({ done: z.number().int(), total: z.number().int() });

export const listLinesQuerySchema = z.strictObject({
  status: questStatusSchema.default('open'),
});

export const createLineRequestSchema = z.strictObject({
  title,
  description: description.optional(),
  deadline: deadline.optional(),
});
export type CreateLineRequest = z.infer<typeof createLineRequestSchema>;

export const createQuestRequestSchema = z.strictObject({
  parentId: z.uuid(),
  kind: z.enum(['chapter', 'quest', 'step']),
  title,
  description: description.optional(),
  deadline: deadline.optional(),
});
export type CreateQuestRequest = z.infer<typeof createQuestRequestSchema>;

/** Защита от случайной вставки целой книги; большой план целиком проходит. */
export const BATCH_MAX = 200;

// Глубже трёх уровней (глава → задание → этап) черновик не бывает, поэтому схема без рекурсии:
// рекурсивный разбор тысячи вложенных уровней переполняет стек, и вместо 400 был бы 500.
const stepDraftSchema = z.strictObject({ title, children: z.array(z.never()).max(0) });
const questDraftSchema = z.strictObject({ title, children: z.array(stepDraftSchema).max(BATCH_MAX) });
/** Дерево черновика из вставленного списка; в v2 его же заполнит ИИ-разбиение (tech-spec). */
export const draftSchema = z.strictObject({ title, children: z.array(questDraftSchema).max(BATCH_MAX) });

type DraftNode = { children: readonly DraftNode[] };
const draftTotal = (drafts: readonly DraftNode[]): number =>
  drafts.reduce((sum, draft) => sum + 1 + draftTotal(draft.children), 0);

/** `kind` — вид верхнего уровня (строка «+ Добавить …»); вложенные выводятся из него. */
export const createBatchRequestSchema = z
  .strictObject({
    parentId: z.uuid(),
    kind: z.enum(['chapter', 'quest', 'step']),
    items: z.array(draftSchema).min(1).max(BATCH_MAX),
  })
  .refine((body) => draftTotal(body.items) <= BATCH_MAX, { message: `At most ${BATCH_MAX} elements at once` });
export type CreateBatchRequest = z.infer<typeof createBatchRequestSchema>;

export const updateQuestRequestSchema = z
  .strictObject({
    title: title.optional(),
    description: description.nullable().optional(),
    deadline: deadline.nullable().optional(),
  })
  .refine((body) => Object.keys(body).length > 0, { message: 'Nothing to update' });
export type UpdateQuestRequest = z.infer<typeof updateQuestRequestSchema>;

/** `afterId: null` — поставить первым среди «братьев». */
export const moveQuestRequestSchema = z.strictObject({
  afterId: z.uuid().nullable(),
});
export type MoveQuestRequest = z.infer<typeof moveQuestRequestSchema>;

export const completeQuestRequestSchema = z.strictObject({
  withChildren: z.boolean().optional(),
});

export const setActiveQuestRequestSchema = z.strictObject({
  questId: z.uuid().nullable(),
});

export const lineTreeResponseSchema = z.object({
  nodes: z.array(questSchema.extend({ progress: progressSchema })),
  activeQuestId: z.uuid().nullable(),
});
export type LineTreeResponse = z.infer<typeof lineTreeResponseSchema>;

export const lineSummarySchema = z.object({
  id: z.uuid(),
  title: z.string(),
  description: z.string().nullable(),
  deadline: deadline.nullable(),
  status: questStatusSchema,
  progress: progressSchema,
  /** «Глава 2 из 4»: первая невыполненная среди неотменённых; `null`, если глав нет. */
  chapters: z.object({ current: z.number().int(), total: z.number().int() }).nullable(),
  hasActiveQuest: z.boolean(),
});

/**
 * Линии отсортированы: первой — с активным квестом, остальные — по последнему изменению
 * в любом узле линии. `counts` — счётчики фильтров журнала по всем статусам сразу.
 */
export const linesResponseSchema = z.object({
  lines: z.array(lineSummarySchema),
  counts: z.object({
    open: z.number().int(),
    paused: z.number().int(),
    done: z.number().int(),
    cancelled: z.number().int(),
  }),
});
export type LinesResponse = z.infer<typeof linesResponseSchema>;

export const questRefSchema = z.object({ id: z.uuid(), title: z.string() });

/** Любая мутация отдаёт изменённые узлы целиком, чтобы клиент обновил кеш без перезагрузки дерева. */
export const mutationResponseSchema = z.object({
  changed: z.array(questSchema),
  activeQuestId: z.uuid().nullable(),
  suggestion: questRefSchema.optional(),
});
export type MutationResponse = z.infer<typeof mutationResponseSchema>;
