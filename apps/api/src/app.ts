import { healthResponseSchema, type HealthResponse } from '@life-rpg/shared';
import { sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { csrf } from 'hono/csrf';
import { secureHeaders } from 'hono/secure-headers';
import type { AppEnv } from './app-env';
import type { AuthService } from './auth/auth';
import type { Db, DbConnection } from './db/client';
import { errorBody, handleError } from './errors';
import { linesRoutes } from './routes/lines';
import { meRoutes } from './routes/me';
import { questsRoutes } from './routes/quests';
import { todayRoutes } from './routes/today';

export type AppDeps = {
  connectDb: (env: Env) => Promise<DbConnection>;
  /** Better Auth на запрос; тесты подставляют экземпляр с плагином `testUtils` и своими секретами. */
  createAuth: (env: Env, db: Db) => AuthService;
};

export function createApp({ connectDb, createAuth }: AppDeps) {
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

  // Вход через Google, callback, сессия и выход — обработчики Better Auth (tech-spec, «API»).
  app.on(['GET', 'POST'], '/auth/*', async (c) => {
    const { db, close } = await connectDb(c.env);
    try {
      return await createAuth(c.env, db).handler(c.req.raw);
    } finally {
      await close();
    }
  });

  // Любой запрос к данным — только с сессией; userId берётся из неё и больше ниоткуда.
  app.use('/v1/*', async (c, next) => {
    const { db, close } = await connectDb(c.env);
    try {
      const { userId, setCookie } = await createAuth(c.env, db).checkSession(c.req.raw.headers);
      if (userId === null) {
        const res = c.json(errorBody('unauthorized', 'Sign in required'), 401);
        for (const cookie of setCookie) res.headers.append('set-cookie', cookie);
        return res;
      }
      c.set('db', db);
      c.set('userId', userId);
      await next();
      // Продлённая сессия: новая cookie уходит с ответом на запрос к данным.
      for (const cookie of setCookie) c.res.headers.append('set-cookie', cookie);
    } finally {
      await close();
    }
  });

  // tech-spec, «Безопасность»: запросы с других origin отклоняются. Основная защита — cookie
  // SameSite=Lax; это второй рубеж для запросов без тела (complete, pause, DELETE), которые чужой
  // сайт отправит обычной формой. После проверки сессии: без входа ответ — 401, как и раньше.
  app.use(
    '/v1/*',
    csrf({ origin: (origin, c) => origin === new URL((c.env as Env).BETTER_AUTH_URL).origin }),
  );

  app.route('/v1/lines', linesRoutes);
  app.route('/v1/quests', questsRoutes);
  app.route('/v1/me', meRoutes);
  app.route('/v1/today', todayRoutes);

  return app;
}
