import { createLineRequestSchema, listLinesQuerySchema } from '@life-rpg/shared';
import { Hono } from 'hono';
import type { AppEnv } from '../app-env';
import { createLine, getLineTree, listLines } from '../services/lines';
import { idParamSchema, validate } from '../validation';

export const linesRoutes = new Hono<AppEnv>()
  .get('/', validate('query', listLinesQuerySchema), async (c) => {
    return c.json(await listLines(c.var.db, c.var.userId, c.req.valid('query').status));
  })
  .post('/', validate('json', createLineRequestSchema), async (c) => {
    return c.json(await createLine(c.var.db, c.var.userId, c.req.valid('json')), 201);
  })
  .get('/:id/tree', validate('param', idParamSchema), async (c) => {
    return c.json(await getLineTree(c.var.db, c.var.userId, c.req.valid('param').id));
  });
