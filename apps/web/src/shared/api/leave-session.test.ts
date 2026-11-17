import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import { queryKeys } from './keys';
import { leaveSession } from './leave-session';

describe('leaveSession', () => {
  it('marks the session as gone before going to login and wipes the cache only after it', async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(queryKeys.session, { id: 'u1' });
    queryClient.setQueryData(queryKeys.today, { active: null });
    let atNavigation: { session: unknown; today: unknown } | null = null;

    await leaveSession(queryClient, async () => {
      atNavigation = {
        session: queryClient.getQueryData(queryKeys.session),
        today: queryClient.getQueryData(queryKeys.today),
      };
    });

    // Пока экраны приложения ещё на месте, их данные не трогаем: стёртый кеш они бы тут же запросили снова.
    expect(atNavigation).toEqual({ session: null, today: { active: null } });
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
  });

  it('cancels requests in flight so their answers do not land in the cache of the next account', async () => {
    const queryClient = new QueryClient();
    let aborted = false;
    void queryClient
      .fetchQuery({
        queryKey: queryKeys.today,
        queryFn: ({ signal }) =>
          new Promise((_, reject) => signal.addEventListener('abort', () => ((aborted = true), reject(signal.reason)))),
      })
      .catch(() => {});

    await leaveSession(queryClient, async () => {});

    expect(aborted).toBe(true);
  });
});
