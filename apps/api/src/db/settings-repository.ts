import { and, eq } from 'drizzle-orm';
import type { Executor } from './client';
import { userSettings } from './schema';

export async function getActiveQuestId(ex: Executor, userId: string): Promise<string | null> {
  const [row] = await ex
    .select({ activeQuestId: userSettings.activeQuestId })
    .from(userSettings)
    .where(eq(userSettings.userId, userId));
  return row?.activeQuestId ?? null;
}

/**
 * Очищает ссылку, только если она всё ещё указывает на `questId`: строка настроек не
 * заблокирована, и параллельный `PUT /me/active-quest` мог уже назначить другое задание.
 */
export async function clearActiveQuestIf(ex: Executor, userId: string, questId: string): Promise<void> {
  await ex
    .update(userSettings)
    .set({ activeQuestId: null })
    .where(and(eq(userSettings.userId, userId), eq(userSettings.activeQuestId, questId)));
}

/** Строка настроек появляется при первой записи; до этапа 6 её никто не создаёт заранее. */
export async function setActiveQuestId(ex: Executor, userId: string, questId: string | null): Promise<void> {
  await ex
    .insert(userSettings)
    .values({ userId, activeQuestId: questId })
    .onConflictDoUpdate({ target: userSettings.userId, set: { activeQuestId: questId } });
}
