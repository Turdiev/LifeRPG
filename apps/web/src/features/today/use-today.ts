import type { LineTreeResponse, TodayResponse } from '@life-rpg/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { queryKeys } from '@/shared/api/keys';
import { fetchToday, fetchTree, setActiveQuest } from '@/shared/api/quests-api';
import { ru } from '@/shared/strings/ru';

export function useToday() {
  return useQuery({ queryKey: queryKeys.today, queryFn: fetchToday });
}

/**
 * Дерево линии активного квеста — в общем кеше `['tree', lineId]`, а не в `['today']`: так
 * этапы отмечаются теми же оптимистичными мутациями, что и на экране линии (`useNodeStatus`).
 * Первые данные берутся из ответа `GET /today`, без второго запроса; свежесть отсчитывается
 * от его загрузки (TanStack Query, «Initial Query Data»).
 */
export function useActiveLineTree(lineId: string) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: queryKeys.tree(lineId),
    queryFn: () => fetchTree(lineId),
    initialData: (): LineTreeResponse | undefined => {
      const active = queryClient.getQueryData<TodayResponse>(queryKeys.today)?.active;
      return active?.lineId === lineId ? { nodes: active.nodes, activeQuestId: active.questId } : undefined;
    },
    initialDataUpdatedAt: () => queryClient.getQueryState(queryKeys.today)?.dataUpdatedAt,
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
