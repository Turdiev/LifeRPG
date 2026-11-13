import { queryOptions } from '@tanstack/react-query';
import { createAuthClient } from 'better-auth/client';
import { queryKeys } from './keys';

// Ванильный клиент, без хуков `better-auth/react`: сессия — серверные данные и живёт в TanStack
// Query, как всё остальное (CLAUDE.md). API на том же адресе, поэтому baseURL не нужен.
const authClient = createAuthClient();

export type SessionUser = { id: string; name: string; email: string; image?: string | null };

/** `null` — не вошёл. Ошибку сети бросаем: вместо экрана входа будет «Повторить» (`RouteError`). */
export const sessionQuery = queryOptions({
  queryKey: queryKeys.session,
  queryFn: async (): Promise<SessionUser | null> => {
    const { data, error } = await authClient.getSession();
    if (error) throw new Error(error.message ?? `Session check failed: ${error.status}`);
    return data?.user ?? null;
  },
  // Сессия меняется только входом и выходом; 401 от API сбрасывает её раньше (main.tsx).
  staleTime: 5 * 60_000,
});

/**
 * Редирект на Google и обратно. Относительные адреса Better Auth достраивает от своего baseURL;
 * при ошибке добавляет к `errorCallbackURL` параметр `error`.
 */
export async function signInWithGoogle(): Promise<void> {
  const { error } = await authClient.signIn.social({
    provider: 'google',
    callbackURL: '/today',
    errorCallbackURL: '/login',
  });
  if (error) throw new Error(error.message ?? `Sign-in failed: ${error.status}`);
}

export async function signOut(): Promise<void> {
  const { error } = await authClient.signOut();
  if (error) throw new Error(error.message ?? `Sign-out failed: ${error.status}`);
}
