import { setActiveQuestRequestSchema } from '@life-rpg/shared';
import { Hono } from 'hono';
import type { AppEnv } from '../app-env';
import { setActiveQuest } from '../services/active-quest';
import { validate } from '../validation';

export const meRoutes = new Hono<AppEnv>().put(
  '/active-quest',
  validate('json', setActiveQuestRequestSchema),
  async (c) => {
    return c.json(await setActiveQuest(c.var.db, c.var.userId, c.req.valid('json').questId));
  },
);
