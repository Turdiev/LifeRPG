import { todayResponseSchema } from '@life-rpg/shared';
import { describe, expect, it } from 'vitest';
import { createTestApp, type TestApp } from '../test/test-app';

async function today(t: TestApp) {
  const result = await t.call('GET', '/today');
  expect(result.status).toBe(200);
  return todayResponseSchema.parse(result.body);
}

describe('GET /api/v1/today', () => {
  it('is empty for a user without lines', async () => {
    const t = await createTestApp();

    expect(await today(t)).toEqual({
      active: null,
      otherLines: [],
      suggestions: [],
      counts: { open: 0, paused: 0, done: 0, cancelled: 0 },
    });
  });

  it('returns the whole tree of the active quest line with progress, and the other open lines', async () => {
    const t = await createTestApp();
    const line = await t.createLine('Полумарафон');
    const chapter = await t.createQuest(line.id, 'chapter');
    const quest = await t.createQuest(chapter.id, 'quest');
    const done = await t.createQuest(quest.id, 'step', 'Этап 1');
    await t.createQuest(quest.id, 'step', 'Этап 2');
    await t.mutate('POST', `/quests/${done.id}/complete`);
    await t.createQuest(line.id, 'quest', 'Без этапов');
    const other = await t.createLine('Другая');
    const paused = await t.createLine('На паузе');
    await t.mutate('POST', `/quests/${paused.id}/pause`);
    await t.mutate('PUT', '/me/active-quest', { questId: quest.id });

    const result = await today(t);

    expect(result.active).toMatchObject({ questId: quest.id, lineId: line.id });
    expect(result.active!.nodes).toHaveLength(6);
    expect(result.active!.nodes.find((node) => node.id === line.id)).toMatchObject({ progress: { done: 1, total: 3 } });
    expect(result.active!.nodes.find((node) => node.id === quest.id)).toMatchObject({ progress: { done: 1, total: 2 } });
    expect(result.otherLines.map((summary) => summary.id)).toEqual([other.id]);
    expect(result.suggestions).toEqual([]);
    expect(result.counts).toEqual({ open: 2, paused: 1, done: 0, cancelled: 0 });
  });

  it('without an active quest suggests the first quest of each open line in journal order, then the following ones', async () => {
    const t = await createTestApp();
    const a = await t.createLine('A');
    const b = await t.createLine('B');
    const a1 = await t.createQuest(a.id, 'quest', 'A1');
    const a2 = await t.createQuest(a.id, 'quest', 'A2');
    await t.createQuest(a.id, 'quest', 'A3');
    // B изменена последней — в журнале она первая.
    const b1 = await t.createQuest(b.id, 'quest', 'B1');

    const result = await today(t);

    expect(result.active).toBeNull();
    expect(result.otherLines.map((summary) => summary.id)).toEqual([b.id, a.id]);
    expect(result.suggestions).toEqual([
      { id: b1.id, title: 'B1', lineId: b.id, lineTitle: 'B' },
      { id: a1.id, title: 'A1', lineId: a.id, lineTitle: 'A' },
      { id: a2.id, title: 'A2', lineId: a.id, lineTitle: 'A' },
    ]);
  });

  it('suggests nothing from paused lines and paused chapters', async () => {
    const t = await createTestApp();
    const pausedLine = await t.createLine('На паузе');
    await t.createQuest(pausedLine.id, 'quest');
    await t.mutate('POST', `/quests/${pausedLine.id}/pause`);
    const line = await t.createLine('В работе');
    const chapter = await t.createQuest(line.id, 'chapter');
    await t.createQuest(chapter.id, 'quest');
    await t.mutate('POST', `/quests/${chapter.id}/pause`);

    const result = await today(t);

    expect(result.suggestions).toEqual([]);
    expect(result.otherLines.map((summary) => summary.id)).toEqual([line.id]);
    expect(result.counts).toMatchObject({ open: 1, paused: 1 });
  });

  it('offers suggestions again once the active quest is completed', async () => {
    const t = await createTestApp();
    const line = await t.createLine();
    const first = await t.createQuest(line.id, 'quest', 'Первое');
    const second = await t.createQuest(line.id, 'quest', 'Второе');
    await t.mutate('PUT', '/me/active-quest', { questId: first.id });

    await t.mutate('POST', `/quests/${first.id}/complete`);
    const result = await today(t);

    expect(result.active).toBeNull();
    expect(result.suggestions.map((suggestion) => suggestion.id)).toEqual([second.id]);
  });

  it('never shows lines of another user', async () => {
    const owner = await createTestApp();
    const stranger = await createTestApp();
    const line = await owner.createLine();
    const quest = await owner.createQuest(line.id, 'quest');
    await owner.mutate('PUT', '/me/active-quest', { questId: quest.id });

    const result = await today(stranger);

    expect(result).toMatchObject({ active: null, otherLines: [], suggestions: [] });
    expect(result.counts).toEqual({ open: 0, paused: 0, done: 0, cancelled: 0 });
  });
});
