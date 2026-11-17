import type { QueryClient } from '@tanstack/react-query';
import { queryKeys } from './keys';

/**
 * Выход или истёкшая сессия: уводим на вход и стираем кеш прошлого аккаунта (на устройстве может
 * войти другой человек). Порядок важен. Стереть кеш сразу нельзя: экраны приложения ещё на месте и
 * тут же запросили бы свои данные заново, получили 401 и снова стёрли бы кеш — десятки запросов.
 * Поэтому сначала отменяем запросы в полёте и помечаем «сессии нет» (так `/login` не вернёт обратно),
 * переходим и только потом, когда экраны размонтированы, стираем всё. Это же стирание убирает и
 * снимок, который вернул бы в кеш откат оптимистичной мутации.
 */
export async function leaveSession(queryClient: QueryClient, toLogin: () => Promise<void>): Promise<void> {
  await queryClient.cancelQueries();
  queryClient.setQueryData(queryKeys.session, null);
  await toLogin();
  queryClient.clear();
}
