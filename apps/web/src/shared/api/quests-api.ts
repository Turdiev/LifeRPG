import {
  lineTreeResponseSchema,
  linesResponseSchema,
  mutationResponseSchema,
  type CreateLineRequest,
  type CreateQuestRequest,
  type LinesResponse,
  type UpdateQuestRequest,
} from '@life-rpg/shared';
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
