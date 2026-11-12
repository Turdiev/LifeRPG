import { healthResponseSchema, type HealthResponse } from '@life-rpg/shared';
import { sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { secureHeaders } from 'hono/secure-headers';
import type { AppEnv } from './app-env';
import type { DbConnection } from './db/client';
import { errorBody, handleError } from './errors';
import { linesRoutes } from './routes/lines';
import { meRoutes } from './routes/me';
import { questsRoutes } from './routes/quests';
import { todayRoutes } from './routes/today';

export type AppDeps = {
  connectDb: (env: Env) => Promise<DbConnection>;
  /** До этапа 6 пользователь фиксированный; тесты подставляют своего. */
  devUserId: string;
};

export function createApp({ connectDb, devUserId }: AppDeps) {
  const app = new Hono<AppEnv>().basePath('/api');

  app.use(secureHeaders());
  app.onError(handleError);
  app.notFound((c) => c.json(errorBody('not_found', 'Not found'), 404));

  app.get('/health', async (c) => {
    try {
      const { db, close } = await connectDb(c.env);
      try {
        await db.execute(sql`select 1`);
      } finally {
        await close();
      }
      const body: HealthResponse = { status: 'ok', db: 'up' };
      return c.json(healthResponseSchema.parse(body));
    } catch (error) {
      console.error(JSON.stringify({ message: 'health check failed', error: String(error) }));
      const body: HealthResponse = { status: 'error', db: 'down' };
      return c.json(healthResponseSchema.parse(body), 503);
    }
  });

  app.use('/v1/*', async (c, next) => {
    const { db, close } = await connectDb(c.env);
    c.set('db', db);
    c.set('userId', devUserId);
    try {
      await next();
    } finally {
      await close();
    }
  });

  app.route('/v1/lines', linesRoutes);
  app.route('/v1/quests', questsRoutes);
  app.route('/v1/me', meRoutes);
  app.route('/v1/today', todayRoutes);

  return app;
}
