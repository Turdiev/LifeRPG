import {
  lineTreeResponseSchema,
  mutationResponseSchema,
  type CreateQuestRequest,
  type Quest,
} from '@life-rpg/shared';
import { testUtils } from 'better-auth/plugins';
import { createApp } from '../app';
import { authService, createAuth, type AuthEnv } from '../auth/auth';
import { connectDb, type Db } from '../db/client';
import { TEST_DATABASE_URL } from './database';

type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
export type ApiResult = { status: number; body: unknown };

// Ненастоящие секреты: Google в тестах не вызывается, а сессии создаёт `testUtils`.
const TEST_AUTH_ENV: AuthEnv = {
  BETTER_AUTH_URL: 'http://localhost:5173',
  BETTER_AUTH_SECRET: 'test-secret-for-integration-tests-only-0123456789',
  GOOGLE_CLIENT_ID: 'test-client-id',
  GOOGLE_CLIENT_SECRET: 'test-client-secret',
};
export const testEnv = TEST_AUTH_ENV as Env;

/** Тот же `createAuth`, что в проде, плюс `testUtils`: пользователи и cookie сессий без Google. */
export function createTestAuth(db: Db) {
  return createAuth(TEST_AUTH_ENV, db, [testUtils()]);
}

/** Приложение как в проде: сессия проверяется настоящей middleware, а не подставляется. */
export function createTestServer() {
  return createApp({ connectDb: () => connectDb(TEST_DATABASE_URL), createAuth: (_env, db) => authService(createTestAuth(db)) });
}

/** Запрос к API без cookie сессии — или с той, что передали в `headers`. */
export async function anonymousCall(method: Method, path: string, headers: Record<string, string> = {}) {
  const res = await createTestServer().request(`/api/v1${path}`, { method, headers }, testEnv);
  return { status: res.status, body: (await res.json()) as unknown };
}

/** Пользователь, как после первого входа, и cookie его сессии. */
export async function signUpTestUser(): Promise<{ userId: string; cookie: string }> {
  const { db, close } = await connectDb(TEST_DATABASE_URL);
  try {
    const { test } = await createTestAuth(db).$context;
    const user = await test.saveUser(test.createUser({ email: `${crypto.randomUUID()}@test.local` }));
    const headers = await test.getAuthHeaders({ userId: user.id });
    return { userId: user.id, cookie: headers.get('cookie') ?? '' };
  } finally {
    await close();
  }
}

/**
 * Приложение с отдельным случайным пользователем: тесты изолированы по `user_id`,
 * поэтому файлы идут параллельно, а базу не нужно чистить.
 */
export async function createTestApp() {
  const { userId, cookie } = await signUpTestUser();
  const app = createTestServer();

  function request(path: string, init: RequestInit): Promise<Response> {
    const headers = new Headers(init.headers);
    headers.set('cookie', cookie);
    return Promise.resolve(app.request(`/api/v1${path}`, { ...init, headers }, testEnv));
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
