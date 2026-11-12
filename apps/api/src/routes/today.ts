import { Hono } from 'hono';
import type { AppEnv } from '../app-env';
import { getToday } from '../services/today';

export const todayRoutes = new Hono<AppEnv>().get('/', async (c) => {
  return c.json(await getToday(c.var.db, c.var.userId));
});
