import { healthResponseSchema, type HealthResponse } from '@life-rpg/shared';
import { Hono } from 'hono';
import { secureHeaders } from 'hono/secure-headers';

export type AppDeps = {
  /** Выполняется, если база ответила на простой запрос; иначе отклоняется. */
  pingDb: (env: Env) => Promise<void>;
};

export function createApp({ pingDb }: AppDeps) {
  const app = new Hono<{ Bindings: Env }>().basePath('/api');

  app.use(secureHeaders());

  app.get('/health', async (c) => {
    try {
      await pingDb(c.env);
      const body: HealthResponse = { status: 'ok', db: 'up' };
      return c.json(healthResponseSchema.parse(body));
    } catch (error) {
      console.error(JSON.stringify({ message: 'health check failed', error: String(error) }));
      const body: HealthResponse = { status: 'error', db: 'down' };
      return c.json(healthResponseSchema.parse(body), 503);
    }
  });

  return app;
}
