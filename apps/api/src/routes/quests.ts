import {
  completeQuestRequestSchema,
  createQuestRequestSchema,
  moveQuestRequestSchema,
  updateQuestRequestSchema,
} from '@life-rpg/shared';
import { Hono } from 'hono';
import type { AppEnv } from '../app-env';
import { changeStatus, createQuest, deleteQuest, moveQuest, updateQuest, type StatusAction } from '../services/quests';
import { idParamSchema, validate } from '../validation';

export const questsRoutes = new Hono<AppEnv>()
  .post('/', validate('json', createQuestRequestSchema), async (c) => {
    return c.json(await createQuest(c.var.db, c.var.userId, c.req.valid('json')), 201);
  })
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
  .delete('/:id', validate('param', idParamSchema), async (c) => {
    return c.json(await deleteQuest(c.var.db, c.var.userId, c.req.valid('param').id));
  });

const actionsWithoutBody: StatusAction[] = ['reopen', 'pause', 'resume', 'cancel', 'restore'];
for (const action of actionsWithoutBody) {
  questsRoutes.post(`/:id/${action}`, validate('param', idParamSchema), async (c) => {
    return c.json(await changeStatus(c.var.db, c.var.userId, c.req.valid('param').id, action));
  });
}
