import { todayQuerySchema } from '@life-rpg/shared';
import { Hono } from 'hono';
import type { AppEnv } from '../app-env';
import { getToday } from '../services/today';
import { validate } from '../validation';

export const todayRoutes = new Hono<AppEnv>().get('/', validate('query', todayQuerySchema), async (c) => {
  return c.json(await getToday(c.var.db, c.var.userId, c.req.valid('query').date));
});
