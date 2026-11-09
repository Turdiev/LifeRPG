import { healthResponseSchema } from '@life-rpg/shared';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from './app';

const env = {} as Env;

describe('GET /api/health', () => {
  it('returns 200 and db "up" when the database answers', async () => {
    const app = createApp({ pingDb: async () => {} });

    const res = await app.request('/api/health', {}, env);

    expect(res.status).toBe(200);
    expect(healthResponseSchema.parse(await res.json())).toEqual({ status: 'ok', db: 'up' });
  });

  it('returns 503 and db "down" when the database is unreachable', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const app = createApp({
      pingDb: async () => {
        throw new Error('connection refused');
      },
    });

    const res = await app.request('/api/health', {}, env);

    expect(res.status).toBe(503);
    expect(healthResponseSchema.parse(await res.json())).toEqual({ status: 'error', db: 'down' });
  });
});
