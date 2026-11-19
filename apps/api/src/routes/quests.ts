import {
  cancelQuestRequestSchema,
  completeQuestRequestSchema,
  createBatchRequestSchema,
  createQuestRequestSchema,
  moveQuestRequestSchema,
  putScheduleRequestSchema,
  updateQuestRequestSchema,
} from '@life-rpg/shared';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import type { AppEnv } from '../app-env';
import { putSchedule, removeSchedule } from '../services/contracts';
import { changeStatus, createBatch, createQuest, deleteQuest, moveQuest, updateQuest, type StatusAction } from '../services/quests';
import { errorBody } from '../errors';
import { idParamSchema, validate } from '../validation';

// 200 названий по 120 символов кириллицы — около 60 КБ JSON; больше настоящая вставка не бывает.
const BATCH_BODY_LIMIT = 128 * 1024;

export const questsRoutes = new Hono<AppEnv>()
  .post('/', validate('json', createQuestRequestSchema), async (c) => {
    return c.json(await createQuest(c.var.db, c.var.userId, c.req.valid('json')), 201);
  })
  .post(
    '/batch',
    bodyLimit({
      maxSize: BATCH_BODY_LIMIT,
      onError: (c) => c.json(errorBody('payload_too_large', 'Request body is too large'), 413),
    }),
    validate('json', createBatchRequestSchema),
    async (c) => {
      return c.json(await createBatch(c.var.db, c.var.userId, c.req.valid('json')), 201);
    },
  )
  .patch('/:id', validate('param', idParamSchema), validate('json', updateQuestRequestSchema), async (c) => {
    return c.json(await updateQuest(c.var.db, c.var.userId, c.req.valid('param').id, c.req.valid('json')));
  })
  .post('/:id/move', validate('param', idParamSchema), validate('json', moveQuestRequestSchema), async (c) => {
    return c.json(await moveQuest(c.var.db, c.var.userId, c.req.valid('param').id, c.req.valid('json')));
  })
  .post('/:id/complete', validate('param', idParamSchema), validate('json', completeQuestRequestSchema), async (c) => {
    const { id } = c.req.valid('param');
    return c.json(await changeStatus(c.var.db, c.var.userId, id, 'complete', c.req.valid('json')));
  })
  .post('/:id/cancel', validate('param', idParamSchema), validate('json', cancelQuestRequestSchema), async (c) => {
    const { id } = c.req.valid('param');
    return c.json(await changeStatus(c.var.db, c.var.userId, id, 'cancel', c.req.valid('json')));
  })
  .put('/:id/schedule', validate('param', idParamSchema), validate('json', putScheduleRequestSchema), async (c) => {
    return c.json(await putSchedule(c.var.db, c.var.userId, c.req.valid('param').id, c.req.valid('json')));
  })
  .delete('/:id/schedule', validate('param', idParamSchema), async (c) => {
    return c.json(await removeSchedule(c.var.db, c.var.userId, c.req.valid('param').id));
  })
  .delete('/:id', validate('param', idParamSchema), async (c) => {
    return c.json(await deleteQuest(c.var.db, c.var.userId, c.req.valid('param').id));
  });

const actionsWithoutBody: StatusAction[] = ['reopen', 'pause', 'resume', 'restore', 'finish'];
for (const action of actionsWithoutBody) {
  questsRoutes.post(`/:id/${action}`, validate('param', idParamSchema), async (c) => {
    return c.json(await changeStatus(c.var.db, c.var.userId, c.req.valid('param').id, action));
  });
}
