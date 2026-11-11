import { describe, expect, it } from 'vitest';
import { createTestApp, errorCodeOf, statusesOf } from '../test/test-app';

type Draft = { title: string; children: Draft[] };
const draft = (title: string, children: Draft[] = []): Draft => ({ title, children });

describe('POST /api/v1/quests/batch', () => {
  it('creates a whole subtree with kinds derived from the top level, in the pasted order', async () => {
    const t = await createTestApp();
    const line = await t.createLine();

    const result = await t.call('POST', '/quests/batch', {
      parentId: line.id,
      kind: 'chapter',
      items: [draft('Глава 1', [draft('Задание', [draft('Этап 1'), draft('Этап 2')])]), draft('Глава 2')],
    });
    const tree = await t.tree(line.id);
    const byTitle = (title: string) => tree.nodes.find((n) => n.title === title)!;
    const childrenOf = (id: string) =>
      tree.nodes
        .filter((n) => n.parentId === id)
        .sort((a, b) => (a.position < b.position ? -1 : 1))
        .map((n) => `${n.kind}:${n.title}`);

    expect(result.status).toBe(201);
    expect((result.body as { changed: unknown[] }).changed).toHaveLength(5);
    expect(childrenOf(line.id)).toEqual(['chapter:Глава 1', 'chapter:Глава 2']);
    expect(childrenOf(byTitle('Глава 1').id)).toEqual(['quest:Задание']);
    expect(childrenOf(byTitle('Задание').id)).toEqual(['step:Этап 1', 'step:Этап 2']);
  });

  it('appends after the existing children of the parent', async () => {
    const t = await createTestApp();
    const line = await t.createLine();
    const quest = await t.createQuest(line.id, 'quest');
    await t.createQuest(quest.id, 'step', 'Был раньше');

    await t.mutate('POST', '/quests/batch', { parentId: quest.id, kind: 'step', items: [draft('Новый 1'), draft('Новый 2')] });
    const steps = (await t.tree(line.id)).nodes
      .filter((n) => n.parentId === quest.id)
      .sort((a, b) => (a.position < b.position ? -1 : 1))
      .map((n) => n.title);

    expect(steps).toEqual(['Был раньше', 'Новый 1', 'Новый 2']);
  });

  it('reopens a done parent and its done ancestors', async () => {
    const t = await createTestApp();
    const line = await t.createLine();
    const quest = await t.createQuest(line.id, 'quest');
    await t.mutate('POST', `/quests/${quest.id}/complete`);

    const { changed } = await t.mutate('POST', '/quests/batch', {
      parentId: quest.id,
      kind: 'step',
      items: [draft('Этап')],
    });

    expect(statusesOf(changed)).toMatchObject({ [quest.id]: 'open', [line.id]: 'open' });
  });

  it('answers 409 invalid_parent for a kind that does not fit the parent or a tree deeper than a step', async () => {
    const t = await createTestApp();
    const line = await t.createLine();
    const chapter = await t.createQuest(line.id, 'chapter');

    const wrongKind = await t.call('POST', '/quests/batch', { parentId: chapter.id, kind: 'step', items: [draft('x')] });
    const tooDeep = await t.call('POST', '/quests/batch', {
      parentId: chapter.id,
      kind: 'quest',
      items: [draft('Задание', [draft('Этап', [draft('Глубже этапа')])])],
    });

    expect([wrongKind.status, tooDeep.status]).toEqual([409, 409]);
    expect([errorCodeOf(wrongKind), errorCodeOf(tooDeep)]).toEqual(['invalid_parent', 'invalid_parent']);
    expect((await t.tree(line.id)).nodes).toHaveLength(2);
  });

  it('answers 409 branch_locked inside a paused chapter', async () => {
    const t = await createTestApp();
    const line = await t.createLine();
    const chapter = await t.createQuest(line.id, 'chapter');
    await t.mutate('POST', `/quests/${chapter.id}/pause`);

    const result = await t.call('POST', '/quests/batch', { parentId: chapter.id, kind: 'quest', items: [draft('x')] });

    expect(result.status).toBe(409);
    expect(errorCodeOf(result)).toBe('branch_locked');
  });

  it('answers 400 for more than 200 elements or a title longer than 120 characters', async () => {
    const t = await createTestApp();
    const line = await t.createLine();
    const quest = await t.createQuest(line.id, 'quest');
    const many = Array.from({ length: 101 }, (_, i) => draft(`Задание ${i}`, [draft('Этап')]));

    const tooMany = await t.call('POST', '/quests/batch', { parentId: line.id, kind: 'quest', items: many });
    const tooLong = await t.call('POST', '/quests/batch', {
      parentId: quest.id,
      kind: 'step',
      items: [draft('я'.repeat(121))],
    });

    expect([tooMany.status, tooLong.status]).toEqual([400, 400]);
  });

  it('answers 400, not 500, for a tree nested a thousand levels deep', async () => {
    const t = await createTestApp();
    const line = await t.createLine();
    let deep = draft('x');
    for (let i = 0; i < 1000; i++) deep = draft('x', [deep]);

    const result = await t.call('POST', '/quests/batch', { parentId: line.id, kind: 'chapter', items: [deep] });

    expect(result.status).toBe(400);
  });

  it('answers 413 for a body larger than a real paste can be', async () => {
    const t = await createTestApp();
    const line = await t.createLine();
    const items = Array.from({ length: 600 }, () => draft('я'.repeat(120)));

    const result = await t.call('POST', '/quests/batch', { parentId: line.id, kind: 'quest', items });

    expect(result.status).toBe(413);
    expect(errorCodeOf(result)).toBe('payload_too_large');
  });

  it("answers 404 for another user's parent", async () => {
    const owner = await createTestApp();
    const stranger = await createTestApp();
    const line = await owner.createLine();

    const result = await stranger.call('POST', '/quests/batch', { parentId: line.id, kind: 'quest', items: [draft('x')] });

    expect(result.status).toBe(404);
  });
});
