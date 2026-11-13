import { healthResponseSchema } from '@life-rpg/shared';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from './app';
import { createTestApp, createTestServer, testEnv } from './test/test-app';

describe('GET /api/health', () => {
  it('returns 200 and db "up" when the database answers', async () => {
    const res = await createTestServer().request('/api/health', {}, testEnv);

    expect(res.status).toBe(200);
    expect(healthResponseSchema.parse(await res.json())).toEqual({ status: 'ok', db: 'up' });
  });

  it('returns 503 and db "down" when the database is unreachable', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const app = createApp({
      connectDb: async () => {
        throw new Error('connection refused');
      },
      createAuth: () => {
        throw new Error('unused');
      },
    });

    const res = await app.request('/api/health', {}, testEnv);

    expect(res.status).toBe(503);
    expect(healthResponseSchema.parse(await res.json())).toEqual({ status: 'error', db: 'down' });
  });
});

describe('unknown routes', () => {
  it('answer 404 in the error format', async () => {
    const t = await createTestApp();

    const res = await t.request('/nothing', {});

    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ error: { code: 'not_found' } });
  });
});
