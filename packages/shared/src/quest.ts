import { z } from 'zod';

export const questKindSchema = z.enum(['line', 'chapter', 'quest', 'step']);
export const questStatusSchema = z.enum(['open', 'done', 'paused', 'cancelled']);

const title = z.string().trim().min(1).max(120);
const description = z.string().trim().max(10_000);
const deadline = z.iso.date();

const DAY_MS = 24 * 60 * 60 * 1000;
/** Как CHECK `quests_contract_schedule`: 365 дней между началом и концом — это 366 дней-этапов. */
const MAX_TERM_DAYS = 365;

const scheduleFields = {
  /** Маска дней недели: пн = 1, вт = 2, ср = 4 … вс = 64. */
  weekdays: z.number().int().min(1).max(127),
  start: deadline,
  /** Включительно. */
  end: deadline,
};
export const scheduleSchema = z.object(scheduleFields);

/**
 * Дата устройства «сегодня» (tech-spec, «Контракты»). Отклоняется только дата позже завтрашней по UTC:
 * ни один часовой пояс не опережает UTC на сутки. Нижней границы нет — отметка из очереди без сети
 * может прийти через несколько дней со своей датой.
 */
export const todaySchema = deadline.refine(
  (date) => date <= new Date(Date.now() + DAY_MS).toISOString().slice(0, 10),
  { message: 'The date is later than tomorrow' },
);

export const questSchema = z.object({
  id: z.uuid(),
  parentId: z.uuid().nullable(),
  kind: questKindSchema,
  status: questStatusSchema,
  position: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  deadline: deadline.nullable(),
  /** Есть только у задания-контракта (v2). */
  schedule: scheduleSchema.nullable(),
  /** Дата дня контракта; есть только у его этапов. */
  scheduledOn: deadline.nullable(),
  completedAt: z.iso.datetime().nullable(),
  /** Для экрана завершения: «за N дней» от создания до закрытия главы или цели (F-16). */
  createdAt: z.iso.datetime(),
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

/** `today` обязателен для дня контракта; проверяет сервер — он знает вид узла. */
export const completeQuestRequestSchema = z.strictObject({
  withChildren: z.boolean().optional(),
  today: todaySchema.optional(),
});

export const cancelQuestRequestSchema = z.strictObject({
  today: todaySchema.optional(),
});

export const putScheduleRequestSchema = z
  .strictObject({ ...scheduleFields, today: todaySchema })
  .refine(({ start, end }) => end >= start && (Date.parse(end) - Date.parse(start)) / DAY_MS <= MAX_TERM_DAYS, {
    message: `The term must not end before it starts or last more than ${MAX_TERM_DAYS + 1} days`,
    path: ['end'],
  });
export type PutScheduleRequest = z.infer<typeof putScheduleRequestSchema>;

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

/** Изменение и снятие расписания удаляют дни: клиент убирает их из кеша по `removed`. */
export const scheduleResponseSchema = mutationResponseSchema.extend({ removed: z.array(z.uuid()) });
export type ScheduleResponse = z.infer<typeof scheduleResponseSchema>;

/** Предложение «Выбери квест»: путь к линии нужен карточке, чтобы было понятно, из какой цели задание. */
export const suggestionSchema = questRefSchema.extend({ lineId: z.uuid(), lineTitle: z.string() });

export const todayQuerySchema = z.strictObject({ date: todaySchema.optional() });

/** Строка блока «На сегодня» (v2, F-23). */
export const todayContractSchema = z.object({
  questId: z.uuid(),
  title: z.string(),
  /** День на эту дату; `null` у контракта с вышедшим сроком. */
  dayId: z.uuid().nullable(),
  lineId: z.uuid(),
  /** «Линия › Глава»: предки контракта начиная с линии. */
  path: z.array(questRefSchema),
  progress: progressSchema,
  expired: z.boolean(),
});

/**
 * Экран «Сегодня» одним запросом. `active.nodes` — всё дерево линии активного квеста в форме
 * `GET /lines/:id/tree`: клиент засевает им кеш дерева и отмечает этапы теми же мутациями,
 * что и на экране линии. Предложения — только когда активного квеста нет, не больше трёх.
 */
export const todayResponseSchema = z.object({
  active: z
    .object({
      questId: z.uuid(),
      lineId: z.uuid(),
      nodes: lineTreeResponseSchema.shape.nodes,
    })
    .nullable(),
  /** Остальные линии в работе, в порядке журнала. */
  otherLines: z.array(lineSummarySchema),
  suggestions: z.array(suggestionSchema),
  /** Отличают «целей нет» от «все цели на паузе» и «в работе ничего нет». */
  counts: linesResponseSchema.shape.counts,
  /**
   * Только с `?date=`. Контракты в порядке журнала, внутри линии — по дереву, с вышедшим сроком — в конце;
   * `lines` — деревья их линий в форме `active.nodes`, чтобы клиент отмечал дни оптимистично.
   */
  contracts: z
    .object({
      items: z.array(todayContractSchema),
      lines: z.array(z.object({ lineId: z.uuid(), nodes: lineTreeResponseSchema.shape.nodes })),
    })
    .optional(),
});
export type TodayResponse = z.infer<typeof todayResponseSchema>;
