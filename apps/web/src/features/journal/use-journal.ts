import type { LinesResponse, UpdateQuestRequest } from '@life-rpg/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { queryKeys } from '@/shared/api/keys';
import {
  createLine,
  deleteQuest,
  fetchLines,
  runStatusAction,
  updateQuest,
  type QuestStatus,
  type StatusAction,
} from '@/shared/api/quests-api';
import { ru } from '@/shared/strings/ru';
import { withoutLine } from './journal-model';

export function useLines(status: QuestStatus) {
  return useQuery({ queryKey: queryKeys.lines(status), queryFn: () => fetchLines(status) });
}

export function useCreateLine() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createLine,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.allLines }),
  });
}

export function useUpdateLine() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateQuestRequest }) => updateQuest(id, body),
    onSettled: (_data, _error, { id }) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.allLines }),
        queryClient.invalidateQueries({ queryKey: queryKeys.tree(id) }),
      ]),
  });
}

export type LineChangeAction = StatusAction | 'delete';
/** `status: null` — без оптимистичного шага: «Вернуть» сам восстанавливает список из снимка. */
type LineChange = { line: { id: string; status: QuestStatus | null }; action: LineChangeAction };

/** Куда уходит линия; `null` — статус после действия знает только сервер, или линии больше нет. */
const targetStatus: Record<LineChangeAction, QuestStatus | null> = {
  pause: 'paused',
  cancel: 'cancelled',
  resume: null,
  restore: null,
  delete: null,
};
const undoAction: Partial<Record<LineChangeAction, StatusAction>> = {
  pause: 'resume',
  resume: 'pause',
  cancel: 'restore',
  restore: 'cancel',
};
const successToast: Record<LineChangeAction, string> = {
  pause: ru.toasts.paused,
  resume: ru.toasts.resumed,
  cancel: ru.toasts.cancelled,
  restore: ru.toasts.restored,
  delete: ru.toasts.deleted,
};
const lineChangeKey = ['line-change'] as const;

/**
 * Пауза, возобновление, отмена, восстановление и удаление линии из журнала.
 * Карточка исчезает из фильтра сразу (docs/ux.md: «изменение видно сразу»), при ошибке
 * возвращается; обратимые действия дают тост с «Вернуть».
 */
export function useLineChange() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationKey: lineChangeKey,
    mutationFn: ({ line, action }: LineChange) =>
      action === 'delete' ? deleteQuest(line.id) : runStatusAction(line.id, action),
    onMutate: async ({ line, action }) => {
      if (line.status === null) return undefined;
      const key = queryKeys.lines(line.status);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<LinesResponse>(key);
      if (previous) queryClient.setQueryData(key, withoutLine(previous, line.id, line.status, targetStatus[action]));
      return { key, previous };
    },
    onError: (_error, variables, snapshot) => {
      if (snapshot?.previous) queryClient.setQueryData(snapshot.key, snapshot.previous);
      toast.error(ru.toasts.saveFailed, {
        action: { label: ru.toasts.retry, onClick: () => mutation.mutate(variables) },
      });
    },
    onSuccess: (_data, { line, action }, snapshot) => {
      const undo = undoAction[action];
      if (!undo) return void toast(successToast[action]);
      toast(successToast[action], {
        action: {
          label: ru.toasts.undo,
          onClick: () => {
            // Список, в котором нажали «Вернуть», возвращается сразу — из снимка до действия.
            if (snapshot?.previous) queryClient.setQueryData(snapshot.key, snapshot.previous);
            mutation.mutate({ line: { id: line.id, status: null }, action: undo });
          },
        },
      });
    },
    onSettled: (_data, _error, { line }) => {
      // Пока идёт другая смена, перезапрос вернул бы её карточку на место раньше времени.
      if (queryClient.isMutating({ mutationKey: lineChangeKey }) > 1) return;
      return Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.allLines }),
        queryClient.invalidateQueries({ queryKey: queryKeys.tree(line.id) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.today }),
      ]);
    },
  });

  return mutation;
}
