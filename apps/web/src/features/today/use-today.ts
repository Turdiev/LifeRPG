import type { LineTreeResponse, TodayResponse } from '@life-rpg/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { queryKeys } from '@/shared/api/keys';
import { fetchToday, fetchTree, setActiveQuest } from '@/shared/api/quests-api';
import { ru } from '@/shared/strings/ru';
import { lineTreeFromToday } from './today-model';

/** После полуночи ключ новый: пока он грузится, экран держит прежний ответ, а не мигает скелетоном. */
export function useToday(date: string) {
  return useQuery({
    queryKey: queryKeys.todayOn(date),
    queryFn: () => fetchToday(date),
    placeholderData: keepPreviousData,
  });
}

/**
 * Дерево линии активного квеста или контракта дня — в общем кеше `['tree', lineId]`, а не в
 * `['today']`: так этапы и дни отмечаются теми же оптимистичными мутациями, что и на экране линии
 * (`useNodeStatus`). Первые данные берутся из ответа `GET /today`, без второго запроса; свежесть
 * отсчитывается от его загрузки (TanStack Query, «Initial Query Data»).
 */
export function useTodayLineTree(lineId: string, date: string) {
  const queryClient = useQueryClient();
  const key = queryKeys.todayOn(date);
  return useQuery({
    queryKey: queryKeys.tree(lineId),
    queryFn: () => fetchTree(lineId),
    initialData: (): LineTreeResponse | undefined => {
      const today = queryClient.getQueryData<TodayResponse>(key);
      return today && lineTreeFromToday(today, lineId);
    },
    initialDataUpdatedAt: () => queryClient.getQueryState(key)?.dataUpdatedAt,
  });
}

export type TakeVars = { questId: string; lineId: string };

/**
 * «Взять» предложенное задание. Без оптимистичного шага: карточке квеста нужно дерево линии,
 * а его до ответа может не быть в кеше; до ответа выбранное предложение показывает ожидание.
 */
export function useTakeQuest() {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: ({ questId }: TakeVars) => setActiveQuest(questId),
    onSuccess: (_response, { questId, lineId }) => {
      // Карточка читает дерево из кеша: устаревший `activeQuestId` в нём спорил бы с ответом «Сегодня».
      queryClient.setQueryData<LineTreeResponse>(queryKeys.tree(lineId), (data) => data && { ...data, activeQuestId: questId });
      return Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.today }),
        queryClient.invalidateQueries({ queryKey: queryKeys.allLines }),
      ]);
    },
    onError: (_error, vars) => {
      toast.error(ru.toasts.saveFailed, {
        action: { label: ru.toasts.retry, onClick: () => mutation.mutate(vars) },
      });
    },
  });
  return mutation;
}
