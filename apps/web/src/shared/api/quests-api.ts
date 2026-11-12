import {
  lineTreeResponseSchema,
  linesResponseSchema,
  mutationResponseSchema,
  todayResponseSchema,
  type CreateLineRequest,
  type CreateQuestRequest,
  type LinesResponse,
  type UpdateQuestRequest,
} from '@life-rpg/shared';
import type { DraftKind, QuestDraft } from '@life-rpg/domain';
import { apiRequest } from './client';

export type QuestStatus = LinesResponse['lines'][number]['status'];
export type LineSummary = LinesResponse['lines'][number];
export type StatusAction = 'pause' | 'resume' | 'cancel' | 'restore';

export function fetchLines(status: QuestStatus) {
  return apiRequest('GET', `/lines?status=${status}`, linesResponseSchema);
}

export function fetchTree(lineId: string) {
  return apiRequest('GET', `/lines/${encodeURIComponent(lineId)}/tree`, lineTreeResponseSchema);
}

export function fetchToday() {
  return apiRequest('GET', '/today', todayResponseSchema);
}

export function createLine(body: CreateLineRequest) {
  return apiRequest('POST', '/lines', mutationResponseSchema, body);
}

export function updateQuest(id: string, body: UpdateQuestRequest) {
  return apiRequest('PATCH', `/quests/${encodeURIComponent(id)}`, mutationResponseSchema, body);
}

export function runStatusAction(id: string, action: StatusAction) {
  return apiRequest('POST', `/quests/${encodeURIComponent(id)}/${action}`, mutationResponseSchema);
}

export function deleteQuest(id: string) {
  return apiRequest('DELETE', `/quests/${encodeURIComponent(id)}`, mutationResponseSchema);
}

export function createQuest(body: CreateQuestRequest) {
  return apiRequest('POST', '/quests', mutationResponseSchema, body);
}

/** Тело только у отметки задания с открытыми этапами: пустое JSON-тело API отклонил бы. */
export function completeQuest(id: string, withChildren: boolean) {
  return apiRequest(
    'POST',
    `/quests/${encodeURIComponent(id)}/complete`,
    mutationResponseSchema,
    withChildren ? { withChildren } : undefined,
  );
}

export function reopenQuest(id: string) {
  return apiRequest('POST', `/quests/${encodeURIComponent(id)}/reopen`, mutationResponseSchema);
}

export function setActiveQuest(questId: string | null) {
  return apiRequest('PUT', '/me/active-quest', mutationResponseSchema, { questId });
}

/** Черновик из парсера домена не глубже этапа; форму проверит схема на сервере. */
export function createQuestBatch(body: { parentId: string; kind: DraftKind; items: QuestDraft[] }) {
  return apiRequest('POST', '/quests/batch', mutationResponseSchema, body);
}
