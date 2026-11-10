import {
  lineTreeResponseSchema,
  mutationResponseSchema,
  type CreateQuestRequest,
  type Quest,
} from '@life-rpg/shared';
import { Client } from 'pg';
import { createApp } from '../app';
import { connectDb } from '../db/client';
import { TEST_DATABASE_URL } from './database';

type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
export type ApiResult = { status: number; body: unknown };

/**
 * Приложение с отдельным случайным пользователем: тесты изолированы по `user_id`,
 * поэтому файлы идут параллельно, а базу не нужно чистить.
 */
export async function createTestApp() {
  const userId = `test-${crypto.randomUUID()}`;
  const client = new Client({ connectionString: TEST_DATABASE_URL });
  await client.connect();
  await client.query('INSERT INTO "user" (id, name, email) VALUES ($1, $1, $2)', [userId, `${userId}@test.local`]);
  await client.end();

  const app = createApp({ connectDb: () => connectDb(TEST_DATABASE_URL), devUserId: userId });

  function request(path: string, init: RequestInit): Promise<Response> {
    return Promise.resolve(app.request(`/api/v1${path}`, init, {} as Env));
  }

  async function call(method: Method, path: string, body?: unknown): Promise<ApiResult> {
    const init: RequestInit =
      body === undefined
        ? { method }
        : { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
    const res = await request(path, init);
    return { status: res.status, body: await res.json() };
  }

  async function expectOk(method: Method, path: string, body?: unknown) {
    const result = await call(method, path, body);
    if (result.status !== 200 && result.status !== 201) {
      throw new Error(`${method} ${path} → ${result.status}: ${JSON.stringify(result.body)}`);
    }
    return result.body;
  }

  return {
    userId,
    request,
    call,
    async mutate(method: Method, path: string, body?: unknown) {
      return mutationResponseSchema.parse(await expectOk(method, path, body));
    },
    async createLine(title = 'Линия'): Promise<Quest> {
      const { changed } = mutationResponseSchema.parse(await expectOk('POST', '/lines', { title }));
      return changed[0]!;
    },
    async createQuest(parentId: string, kind: CreateQuestRequest['kind'], title: string = kind): Promise<Quest> {
      const { changed } = mutationResponseSchema.parse(await expectOk('POST', '/quests', { parentId, kind, title }));
      return changed.find((node) => node.parentId === parentId && node.title === title)!;
    },
    async tree(lineId: string) {
      return lineTreeResponseSchema.parse(await expectOk('GET', `/lines/${lineId}/tree`));
    },
  };
}

export type TestApp = Awaited<ReturnType<typeof createTestApp>>;

/** `{ id: status }` изменённых узлов: порядок `changed` не важен. */
export function statusesOf(changed: readonly Quest[]): Record<string, string> {
  return Object.fromEntries(changed.map((node) => [node.id, node.status]));
}

export function errorCodeOf(result: ApiResult): unknown {
  return (result.body as { error?: { code?: unknown } }).error?.code;
}
