import { eq, like } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { connectDb } from '../db/client';
import { rateLimit, session, userSettings, verification } from '../db/schema';
import { TEST_DATABASE_URL } from '../test/database';
import { anonymousCall, createTestApp, createTestServer, errorCodeOf, signUpTestUser, testEnv } from '../test/test-app';

const ANY_ID = '00000000-0000-4000-8000-000000000000';

// Каждый маршрут /api/v1 — по одному запросу; тело не важно: сессия проверяется раньше валидации.
const routes: [Parameters<typeof anonymousCall>[0], string][] = [
  ['GET', '/lines'],
  ['POST', '/lines'],
  ['GET', `/lines/${ANY_ID}/tree`],
  ['POST', '/quests'],
  ['POST', '/quests/batch'],
  ['PATCH', `/quests/${ANY_ID}`],
  ['POST', `/quests/${ANY_ID}/move`],
  ['POST', `/quests/${ANY_ID}/complete`],
  ['POST', `/quests/${ANY_ID}/reopen`],
  ['POST', `/quests/${ANY_ID}/pause`],
  ['POST', `/quests/${ANY_ID}/resume`],
  ['POST', `/quests/${ANY_ID}/cancel`],
  ['POST', `/quests/${ANY_ID}/restore`],
  ['DELETE', `/quests/${ANY_ID}`],
  ['GET', '/today'],
  ['PUT', '/me/active-quest'],
];

describe('requests without a session', () => {
  it('answer 401 unauthorized on every data route', async () => {
    const results = await Promise.all(routes.map(([method, path]) => anonymousCall(method, path)));

    expect(results.map((r) => r.status)).toEqual(Array(routes.length).fill(401));
    expect(results.map(errorCodeOf)).toEqual(Array(routes.length).fill('unauthorized'));
  });

  it('answer 401 with a forged or unsigned session cookie', async () => {
    const forged = await anonymousCall('GET', '/lines', { cookie: 'better-auth.session_token=forged-token.forged-signature' });
    const unsigned = await anonymousCall('GET', '/lines', { cookie: 'better-auth.session_token=forged-token' });

    expect([forged.status, unsigned.status]).toEqual([401, 401]);
  });

  it('do not change any data', async () => {
    const t = await createTestApp();
    const line = await t.createLine();
    const before = await t.tree(line.id);

    await anonymousCall('DELETE', `/quests/${line.id}`);

    expect(await t.tree(line.id)).toEqual(before);
  });
});

/** Меняет срок сессии пользователя прямо в базе — как будто прошло время. */
async function setSessionExpiry(userId: string, expiresAt: Date) {
  const { db, close } = await connectDb(TEST_DATABASE_URL);
  try {
    await db.update(session).set({ expiresAt }).where(eq(session.userId, userId));
  } finally {
    await close();
  }
}

async function sessionRows(userId: string) {
  const { db, close } = await connectDb(TEST_DATABASE_URL);
  try {
    return await db.select().from(session).where(eq(session.userId, userId));
  } finally {
    await close();
  }
}

const DAY_MS = 24 * 60 * 60 * 1000;

describe('session lifetime', () => {
  it('is extended to 30 days by a data request once a day has passed, with a new cookie in the response', async () => {
    const { userId, cookie } = await signUpTestUser();
    // До конца 20 дней: со входа прошло больше `updateAge` (1 день).
    await setSessionExpiry(userId, new Date(Date.now() + 20 * DAY_MS));

    const res = await createTestServer().request('/api/v1/lines', { headers: { cookie } }, testEnv);

    expect(res.status).toBe(200);
    expect(res.headers.getSetCookie().some((c) => c.startsWith('better-auth.session_token='))).toBe(true);
    const [row] = await sessionRows(userId);
    expect(row!.expiresAt.getTime()).toBeGreaterThan(Date.now() + 29 * DAY_MS);
  });

  it('is not extended or re-sent while it is fresh', async () => {
    const { cookie } = await signUpTestUser();

    const res = await createTestServer().request('/api/v1/lines', { headers: { cookie } }, testEnv);

    expect(res.status).toBe(200);
    expect(res.headers.getSetCookie()).toEqual([]);
  });

  it('answers 401 once expired, deletes the session and clears the cookie', async () => {
    const { userId, cookie } = await signUpTestUser();
    await setSessionExpiry(userId, new Date(Date.now() - 1000));

    const res = await createTestServer().request('/api/v1/lines', { headers: { cookie } }, testEnv);

    expect(res.status).toBe(401);
    expect(res.headers.getSetCookie().some((c) => /^better-auth\.session_token=;.*Max-Age=0/i.test(c))).toBe(true);
    expect(await sessionRows(userId)).toEqual([]);
  });
});

describe('/api/auth/*', () => {
  it('reports the session of the cookie, and none without it', async () => {
    const { userId, cookie } = await signUpTestUser();
    const server = createTestServer();

    const withCookie = await server.request('/api/auth/get-session', { headers: { cookie } }, testEnv);
    const without = await server.request('/api/auth/get-session', {}, testEnv);

    expect(((await withCookie.json()) as { user: { id: string } }).user.id).toBe(userId);
    expect(await without.json()).toBeNull();
  });

  it('starts Google sign-in: redirect URL, OAuth state and a rate limit record', async () => {
    const res = await createTestServer().request(
      '/api/auth/sign-in/social',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'cf-connecting-ip': `10.0.0.${Math.floor(Math.random() * 250)}` },
        body: JSON.stringify({ provider: 'google', callbackURL: '/today' }),
      },
      testEnv,
    );

    expect(res.status).toBe(200);
    const { url } = (await res.json()) as { url: string };
    expect(new URL(url).hostname).toBe('accounts.google.com');
    const state = new URL(url).searchParams.get('state');
    const { db, close } = await connectDb(TEST_DATABASE_URL);
    try {
      // Ключ записи — state с префиксом Better Auth; префикс — его деталь, поэтому сверяем окончание.
      expect(await db.select().from(verification).where(like(verification.identifier, `%${state!}`))).toHaveLength(1);
      expect((await db.select().from(rateLimit)).some((row) => row.key.startsWith('10.0.0.'))).toBe(true);
    } finally {
      await close();
    }
  });
});

describe('a broken Google callback', () => {
  it('redirects to the sign-in screen with an error, not to the built-in error page of Better Auth', async () => {
    // Нет cookie состояния OAuth — так бывает, если вход начали в другом браузере или cookie потерялась.
    const res = await createTestServer().request('/api/auth/callback/google?code=x&state=unknown', {}, testEnv);

    expect(res.status).toBe(302);
    const location = new URL(res.headers.get('location')!, testEnv.BETTER_AUTH_URL);
    expect(location.pathname).toBe('/login');
    expect(location.searchParams.get('error')).toBeTruthy();
  });
});

describe('first sign-in', () => {
  it('creates default user settings', async () => {
    const { userId } = await signUpTestUser();
    const { db, close } = await connectDb(TEST_DATABASE_URL);
    try {
      const rows = await db.select().from(userSettings).where(eq(userSettings.userId, userId));
      expect(rows).toEqual([{ userId, activeQuestId: null, vibration: false, sound: false }]);
    } finally {
      await close();
    }
  });
});
