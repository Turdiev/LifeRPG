import { describe, expect, it } from 'vitest';
import { createTestApp } from '../test/test-app';

// Главный сценарий этапа 3: цель разбивается на квесты, этапы отмечаются, прогресс растёт.
describe('main scenario over HTTP', () => {
  it('from a new line to a completed goal', async () => {
    const t = await createTestApp();
    const line = await t.createLine('Пробежать полумарафон к маю');
    const chapter = await t.createQuest(line.id, 'chapter', 'Глава 1. Набрать базу');
    const quest = await t.createQuest(chapter.id, 'quest', 'Бегать 3 раза в неделю');
    const monday = await t.createQuest(quest.id, 'step', 'Пробежка 5 км в понедельник');
    const wednesday = await t.createQuest(quest.id, 'step', 'Пробежка 5 км в среду');
    await t.mutate('PUT', '/me/active-quest', { questId: quest.id });

    await t.mutate('POST', `/quests/${monday.id}/complete`);
    const halfway = await t.tree(line.id);

    const finished = await t.mutate('POST', `/quests/${wednesday.id}/complete`);
    const done = await t.tree(line.id);

    expect(halfway.nodes.find((n) => n.id === line.id)?.progress).toEqual({ done: 1, total: 2 });
    expect(halfway.activeQuestId).toBe(quest.id);
    expect(finished.activeQuestId).toBeNull();
    expect(finished.suggestion).toBeUndefined();
    expect(done.nodes.every((n) => n.status === 'done')).toBe(true);
    expect(done.nodes.find((n) => n.id === line.id)?.progress).toEqual({ done: 2, total: 2 });
  });
});
