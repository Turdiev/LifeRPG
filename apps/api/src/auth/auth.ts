import { APIError, betterAuth, type BetterAuthPlugin } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import type { Db } from '../db/client';
import { account, rateLimit, session, user, verification } from '../db/schema';
import { createSettings } from '../db/settings-repository';

/** Секреты входа: задаёт автор (`.dev.vars` локально, `wrangler secret` в проде), список — в wrangler.jsonc. */
export type AuthEnv = Pick<Env, 'BETTER_AUTH_URL' | 'BETTER_AUTH_SECRET' | 'GOOGLE_CLIENT_ID' | 'GOOGLE_CLIENT_SECRET'>;

const DAY = 60 * 60 * 24;

/**
 * Экземпляр Better Auth на один запрос: клиент базы на Workers тоже живёт один запрос
 * (пул держит Hyperdrive), а Drizzle-адаптер привязан к конкретному клиенту.
 * `plugins` — только для тестов (`testUtils`).
 */
export function createAuth<Plugins extends BetterAuthPlugin[] = []>(env: AuthEnv, db: Db, plugins?: Plugins) {
  return betterAuth({
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(db, {
      provider: 'pg',
      schema: { user, session, account, verification, rateLimit },
    }),
    socialProviders: {
      // Только openid, email и profile (области по умолчанию): поэтому даже тестовый режим
      // OAuth-клиента Google не требует списка тестировщиков (tech-spec, «Вход»).
      google: { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET },
    },
    // tech-spec, «Вход»: сессия живёт 30 дней и продлевается при использовании.
    session: { expiresIn: 30 * DAY, updateAge: DAY },
    // По умолчанию Better Auth включает лимит только при NODE_ENV=production, а на Workers его нет.
    rateLimit: { enabled: true, storage: 'database' },
    // Better Auth ищет IP в x-forwarded-for, а Worker получает его в cf-connecting-ip: без этого
    // у всех пользователей был бы один ключ лимита, и чужие запросы блокировали бы вход любому.
    advanced: { ipAddress: { ipAddressHeaders: ['cf-connecting-ip'] } },
    // Ошибки callback до разбора state (потерянная cookie, подменённый state) Better Auth по умолчанию
    // ведёт на свою страницу /api/auth/error, а не на errorCallbackURL клиента — уводим на экран входа.
    onAPIError: { errorURL: '/login' },
    databaseHooks: {
      // tech-spec, «Вход», п. 3: при первом входе создаётся строка user_settings.
      user: { create: { after: async (created) => createSettings(db, created.id) } },
    },
    // Дженерик сохраняет типы плагина: в тестах `$context.test` типизирован.
    plugins: plugins ?? ([] as unknown as Plugins),
  });
}

/**
 * Сессия запроса: `userId` — `null`, если её нет, она истекла или подделана. `setCookie` — то, что
 * Better Auth записал бы в ответ: продлённая (раз в `updateAge`) или стёртая истёкшая cookie.
 */
export type SessionCheck = { userId: string | null; setCookie: string[] };

/** То, что приложению нужно от Better Auth: тип не зависит от плагинов, тесты подставляют свой экземпляр. */
export type AuthService = {
  handler: (request: Request) => Promise<Response>;
  checkSession: (headers: Headers) => Promise<SessionCheck>;
};

/** Структурный тип вместо `ReturnType<typeof createAuth>`: экземпляр с плагинами ему тоже подходит. */
type BetterAuthLike = {
  handler: (request: Request) => Promise<Response>;
  api: {
    getSession: (context: {
      headers: Headers;
      returnHeaders: true;
    }) => Promise<{ headers: Headers; response: { user: { id: string } } | null }>;
  };
};

export function authService(auth: BetterAuthLike): AuthService {
  return {
    handler: (request) => auth.handler(request),
    checkSession: async (headers) => {
      try {
        // returnHeaders: продление сессии в базе бесполезно без новой cookie у браузера,
        // а `auth.api` без этого флага выбрасывает её Set-Cookie (tech-spec, «Вход»: продлевается при использовании).
        const result = await auth.api.getSession({ headers, returnHeaders: true });
        return { userId: result.response?.user.id ?? null, setCookie: result.headers.getSetCookie() };
      } catch (error) {
        // Сессию удалили (выход в другой вкладке) ровно во время продления — это та же «нет сессии».
        if (error instanceof APIError && error.statusCode === 401) return { userId: null, setCookie: [] };
        throw error;
      }
    },
  };
}
