import type { DraftKind, QuestDraft } from '@life-rpg/domain';
import type {
  CreateQuestRequest,
  LineTreeResponse,
  MutationResponse,
  UpdateQuestRequest,
} from '@life-rpg/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { queryKeys } from '@/shared/api/keys';
import {
  completeQuest,
  createQuest,
  createQuestBatch,
  deleteQuest,
  fetchTree,
  reopenQuest,
  runStatusAction,
  setActiveQuest,
  updateQuest,
} from '@/shared/api/quests-api';
import { ru } from '@/shared/strings/ru';
import {
  applyStatusLocally,
  insertDraftsLocally,
  insertLocally,
  mergeResponse,
  removeLocally,
  tempIdsOf,
  type NodeAction,
  type TempDraft,
  type TreeNode,
} from './line-model';

export function useLineTree(lineId: string) {
  return useQuery({ queryKey: queryKeys.tree(lineId), queryFn: () => fetchTree(lineId) });
}

type TreeMutationOptions<V> = {
  mutationFn: (vars: V) => Promise<MutationResponse>;
  /** Что пользователь видит сразу, до ответа сервера (docs/ux.md, «Общие состояния»). */
  optimistic: (data: LineTreeResponse, vars: V) => LineTreeResponse;
  merge?: (data: LineTreeResponse, response: MutationResponse, vars: V) => LineTreeResponse;
  onDone?: (response: MutationResponse, vars: V) => void;
};

/** Снимок → локальный расчёт доменом → ответ сервера поверх; при ошибке откат и «Повторить». */
function useTreeMutation<V>(lineId: string, options: TreeMutationOptions<V>) {
  const queryClient = useQueryClient();
  const key = queryKeys.tree(lineId);
  const mutationKey = ['line-mutation', lineId];

  const mutation = useMutation({
    mutationKey,
    mutationFn: options.mutationFn,
    onMutate: async (vars: V) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<LineTreeResponse>(key);
      if (previous) queryClient.setQueryData(key, options.optimistic(previous, vars));
      return { previous };
    },
    onError: (_error, vars, snapshot) => {
      if (snapshot?.previous) queryClient.setQueryData(key, snapshot.previous);
      toast.error(ru.toasts.saveFailed, {
        action: { label: ru.toasts.retry, onClick: () => mutation.mutate(vars) },
      });
    },
    onSuccess: (response, vars) => {
      const merge = options.merge ?? ((data: LineTreeResponse) => mergeResponse(data, response));
      queryClient.setQueryData<LineTreeResponse>(key, (data) => data && merge(data, response, vars));
      options.onDone?.(response, vars);
    },
    onSettled: () => {
      // Пока в линии идёт другая мутация, перезапрос затёр бы её локальный результат.
      if (queryClient.isMutating({ mutationKey }) > 1) return;
      return Promise.all([
        queryClient.invalidateQueries({ queryKey: key }),
        queryClient.invalidateQueries({ queryKey: queryKeys.allLines }),
        queryClient.invalidateQueries({ queryKey: queryKeys.today }),
      ]);
    },
  });
  return mutation;
}

const now = () => new Date().toISOString();

type StatusVars = { node: TreeNode; action: NodeAction; withChildren?: boolean };
const inverse: Partial<Record<NodeAction, NodeAction>> = {
  pause: 'resume',
  resume: 'pause',
  cancel: 'restore',
  restore: 'cancel',
};
const statusToast: Partial<Record<NodeAction, string>> = {
  pause: ru.line.toasts.paused,
  resume: ru.line.toasts.resumed,
  cancel: ru.line.toasts.cancelled,
  restore: ru.line.toasts.restored,
};

export function useNodeStatus(lineId: string) {
  const mutation = useTreeMutation<StatusVars>(lineId, {
    mutationFn: ({ node, action, withChildren }) => {
      if (action === 'complete') return completeQuest(node.id, withChildren ?? false);
      if (action === 'reopen') return reopenQuest(node.id);
      return runStatusAction(node.id, action);
    },
    optimistic: (data, { node, action, withChildren }) =>
      applyStatusLocally(data, node.id, action, now(), { withChildren }),
    // Отметка видна сама по себе; тост с «Вернуть» — только у паузы, отмены и обратных к ним.
    onDone: (_response, { node, action }) => {
      const message = statusToast[action];
      const undo = inverse[action];
      if (!message || !undo) return;
      toast(message, { action: { label: ru.toasts.undo, onClick: () => mutation.mutate({ node, action: undo }) } });
    },
  });
  return mutation;
}

export type CreateVars = { id: string; parentId: string; kind: CreateQuestRequest['kind']; title: string };

export function useCreateNode(lineId: string) {
  return useTreeMutation<CreateVars>(lineId, {
    mutationFn: ({ parentId, kind, title }) => createQuest({ parentId, kind, title }),
    optimistic: (data, draft) => insertLocally(data, draft, now()),
    merge: (data, response, draft) => mergeResponse(data, response, [draft.id]),
  });
}

export type BatchVars = { parentId: string; kind: DraftKind; drafts: TempDraft[] };

const withoutIds = (drafts: readonly TempDraft[]): QuestDraft[] =>
  drafts.map((draft) => ({ title: draft.title, children: withoutIds(draft.children) }));

export function useCreateBatch(lineId: string) {
  return useTreeMutation<BatchVars>(lineId, {
    mutationFn: ({ parentId, kind, drafts }) => createQuestBatch({ parentId, kind, items: withoutIds(drafts) }),
    optimistic: (data, { parentId, kind, drafts }) => insertDraftsLocally(data, parentId, kind, drafts, now()),
    merge: (data, response, { drafts }) => mergeResponse(data, response, tempIdsOf(drafts)),
  });
}

export function useUpdateNode(lineId: string) {
  return useTreeMutation<{ id: string; body: UpdateQuestRequest }>(lineId, {
    mutationFn: ({ id, body }) => updateQuest(id, body),
    optimistic: (data, { id, body }) => ({
      ...data,
      nodes: data.nodes.map((node) => (node.id === id ? { ...node, ...body } : node)),
    }),
  });
}

export function useDeleteNode(lineId: string) {
  return useTreeMutation<{ node: TreeNode }>(lineId, {
    mutationFn: ({ node }) => deleteQuest(node.id),
    optimistic: (data, { node }) => removeLocally(data, node.id, now()),
    onDone: () => toast(ru.toasts.deleted),
  });
}

export function useSetActiveQuest(lineId: string) {
  return useTreeMutation<{ questId: string | null }>(lineId, {
    mutationFn: ({ questId }) => setActiveQuest(questId),
    optimistic: (data, { questId }) => ({ ...data, activeQuestId: questId }),
    onDone: (_response, { questId }) => {
      if (questId) toast(ru.line.toasts.tracked);
    },
  });
}
