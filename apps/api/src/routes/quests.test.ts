import { describe, expect, it } from 'vitest';
import { createTestApp, errorCodeOf, statusesOf } from '../test/test-app';

describe('POST /api/v1/quests', () => {
  it('appends new children after the existing ones', async () => {
    const t = await createTestApp();
    const line = await t.createLine();
    const first = await t.createQuest(line.id, 'chapter', 'Глава 1');
    const second = await t.createQuest(line.id, 'chapter', 'Глава 2');
    const third = await t.createQuest(line.id, 'quest', 'Задание');

    expect(first.position < second.position && second.position < third.position).toBe(true);
  });

  it('answers 201 with the new node in changed', async () => {
    const t = await createTestApp();
    const line = await t.createLine();

    const result = await t.call('POST', '/quests', { parentId: line.id, kind: 'quest', title: 'Бегать', deadline: '2027-01-31' });

    expect(result.status).toBe(201);
    expect(result.body).toMatchObject({
      changed: [{ parentId: line.id, kind: 'quest', status: 'open', title: 'Бегать', deadline: '2027-01-31' }],
    });
  });

  it('reopens a done quest and its done ancestors when a step is added', async () => {
    const t = await createTestApp();
    const line = await t.createLine();
    const quest = await t.createQuest(line.id, 'quest');
    const step = await t.createQuest(quest.id, 'step');
    await t.mutate('POST', `/quests/${step.id}/complete`);

    const { changed } = await t.mutate('POST', '/quests', { parentId: quest.id, kind: 'step', title: 'new' });

    expect(statusesOf(changed)).toMatchObject({ [quest.id]: 'open', [line.id]: 'open' });
  });

  it('answers 404 for an unknown parent', async () => {
    const t = await createTestApp();

    const result = await t.call('POST', '/quests', { parentId: crypto.randomUUID(), kind: 'quest', title: 'x' });

    expect(result.status).toBe(404);
  });

  it('answers 409 invalid_parent for a wrong nesting', async () => {
    const t = await createTestApp();
    const line = await t.createLine();
    const chapter = await t.createQuest(line.id, 'chapter');

    const result = await t.call('POST', '/quests', { parentId: chapter.id, kind: 'step', title: 'x' });

    expect(result.status).toBe(409);
    expect(errorCodeOf(result)).toBe('invalid_parent');
  });

  it('answers 409 branch_locked inside a paused chapter', async () => {
    const t = await createTestApp();
    const line = await t.createLine();
    const chapter = await t.createQuest(line.id, 'chapter');
    await t.mutate('POST', `/quests/${chapter.id}/pause`);

    const result = await t.call('POST', '/quests', { parentId: chapter.id, kind: 'quest', title: 'x' });

    expect(result.status).toBe(409);
    expect(errorCodeOf(result)).toBe('branch_locked');
  });

  it("answers 404 for another user's parent", async () => {
    const owner = await createTestApp();
    const stranger = await createTestApp();
    const line = await owner.createLine();

    expect((await stranger.call('POST', '/quests', { parentId: line.id, kind: 'quest', title: 'x' })).status).toBe(404);
  });
});

describe('PATCH /api/v1/quests/:id', () => {
  it('updates title, description and deadline', async () => {
    const t = await createTestApp();
    const line = await t.createLine();

    const { changed } = await t.mutate('PATCH', `/quests/${line.id}`, {
      title: 'Новое',
      description: 'Описание',
      deadline: '2027-03-01',
    });
    const cleared = await t.mutate('PATCH', `/quests/${line.id}`, { description: null, deadline: null });

    expect(changed[0]).toMatchObject({ title: 'Новое', description: 'Описание', deadline: '2027-03-01' });
    expect(cleared.changed[0]).toMatchObject({ title: 'Новое', description: null, deadline: null });
  });

  it('answers 400 for an empty body and 404 for an unknown id', async () => {
    const t = await createTestApp();
    const line = await t.createLine();

    expect((await t.call('PATCH', `/quests/${line.id}`, {})).status).toBe(400);
    expect((await t.call('PATCH', `/quests/${crypto.randomUUID()}`, { title: 'x' })).status).toBe(404);
  });

  it('answers 409 branch_locked for a node inside a paused chapter', async () => {
    const t = await createTestApp();
    const line = await t.createLine();
    const chapter = await t.createQuest(line.id, 'chapter');
    const quest = await t.createQuest(chapter.id, 'quest');
    await t.mutate('POST', `/quests/${chapter.id}/pause`);

    const result = await t.call('PATCH', `/quests/${quest.id}`, { title: 'x' });

    expect(result.status).toBe(409);
    expect(errorCodeOf(result)).toBe('branch_locked');
  });
});

describe('POST /api/v1/quests/:id/move', () => {
  async function threeSiblings() {
    const t = await createTestApp();
    const line = await t.createLine();
    const a = await t.createQuest(line.id, 'quest', 'A');
    const b = await t.createQuest(line.id, 'quest', 'B');
    const c = await t.createQuest(line.id, 'quest', 'C');
    const order = async () =>
      (await t.tree(line.id)).nodes
        .filter((n) => n.parentId === line.id)
        .sort((x, y) => (x.position < y.position ? -1 : 1))
        .map((n) => n.title);
    return { t, line, a, b, c, order };
  }

  it('moves a node to the first place with afterId null', async () => {
    const { t, c, order } = await threeSiblings();

    await t.mutate('POST', `/quests/${c.id}/move`, { afterId: null });

    expect(await order()).toEqual(['C', 'A', 'B']);
  });

  it('moves a node right after the given sibling', async () => {
    const { t, a, b, order } = await threeSiblings();

    await t.mutate('POST', `/quests/${a.id}/move`, { afterId: b.id });

    expect(await order()).toEqual(['B', 'A', 'C']);
  });

  it('moves a node to the end with afterId of the last sibling', async () => {
    const { t, a, c, order } = await threeSiblings();

    await t.mutate('POST', `/quests/${a.id}/move`, { afterId: c.id });

    expect(await order()).toEqual(['B', 'C', 'A']);
  });

  it('answers 409 invalid_parent when afterId is the node itself', async () => {
    const { t, a } = await threeSiblings();

    const result = await t.call('POST', `/quests/${a.id}/move`, { afterId: a.id });

    expect(result.status).toBe(409);
    expect(errorCodeOf(result)).toBe('invalid_parent');
  });

  it('answers 409 branch_locked inside a paused chapter', async () => {
    const t = await createTestApp();
    const line = await t.createLine();
    const chapter = await t.createQuest(line.id, 'chapter');
    const quest = await t.createQuest(chapter.id, 'quest');
    await t.mutate('POST', `/quests/${chapter.id}/pause`);

    const result = await t.call('POST', `/quests/${quest.id}/move`, { afterId: null });

    expect(result.status).toBe(409);
    expect(errorCodeOf(result)).toBe('branch_locked');
  });

  it('answers 409 invalid_parent when afterId is not a sibling', async () => {
    const { t, line, a } = await threeSiblings();
    const chapter = await t.createQuest(line.id, 'chapter');
    const nested = await t.createQuest(chapter.id, 'quest');

    const result = await t.call('POST', `/quests/${a.id}/move`, { afterId: nested.id });

    expect(result.status).toBe(409);
    expect(errorCodeOf(result)).toBe('invalid_parent');
  });

  it('answers 409 invalid_transition for a line', async () => {
    const t = await createTestApp();
    const line = await t.createLine();

    const result = await t.call('POST', `/quests/${line.id}/move`, { afterId: null });

    expect(result.status).toBe(409);
    expect(errorCodeOf(result)).toBe('invalid_transition');
  });
});

describe('DELETE /api/v1/quests/:id', () => {
  it('deletes the node with its descendants', async () => {
    const t = await createTestApp();
    const line = await t.createLine();
    const chapter = await t.createQuest(line.id, 'chapter');
    const quest = await t.createQuest(chapter.id, 'quest');
    await t.createQuest(quest.id, 'step');

    await t.mutate('DELETE', `/quests/${chapter.id}`);

    expect((await t.tree(line.id)).nodes.map((n) => n.id)).toEqual([line.id]);
  });

  it('completes the quest when its last open step is deleted', async () => {
    const t = await createTestApp();
    const line = await t.createLine();
    const quest = await t.createQuest(line.id, 'quest');
    const done = await t.createQuest(quest.id, 'step', 'done');
    const open = await t.createQuest(quest.id, 'step', 'open');
    await t.mutate('POST', `/quests/${done.id}/complete`);

    const { changed } = await t.mutate('DELETE', `/quests/${open.id}`);

    expect(statusesOf(changed)).toEqual({ [quest.id]: 'done', [line.id]: 'done' });
  });

  it('clears the active quest when it is deleted, without a suggestion', async () => {
    const t = await createTestApp();
    const line = await t.createLine();
    const active = await t.createQuest(line.id, 'quest', 'active');
    await t.createQuest(line.id, 'quest', 'other');
    await t.mutate('PUT', '/me/active-quest', { questId: active.id });

    const result = await t.mutate('DELETE', `/quests/${active.id}`);

    expect(result.activeQuestId).toBeNull();
    expect(result.suggestion).toBeUndefined();
  });

  it('suggests the next quest when the deletion completes the active quest', async () => {
    const t = await createTestApp();
    const line = await t.createLine();
    const active = await t.createQuest(line.id, 'quest', 'active');
    const done = await t.createQuest(active.id, 'step', 'done');
    const open = await t.createQuest(active.id, 'step', 'open');
    const next = await t.createQuest(line.id, 'quest', 'next');
    await t.mutate('POST', `/quests/${done.id}/complete`);
    await t.mutate('PUT', '/me/active-quest', { questId: active.id });

    const result = await t.mutate('DELETE', `/quests/${open.id}`);

    expect(result.activeQuestId).toBeNull();
    expect(result.suggestion).toEqual({ id: next.id, title: 'next' });
  });

  it('is allowed inside a paused chapter', async () => {
    const t = await createTestApp();
    const line = await t.createLine();
    const chapter = await t.createQuest(line.id, 'chapter');
    const quest = await t.createQuest(chapter.id, 'quest');
    await t.mutate('POST', `/quests/${chapter.id}/pause`);

    await t.mutate('DELETE', `/quests/${quest.id}`);

    expect((await t.tree(line.id)).nodes.map((n) => n.id).sort()).toEqual([line.id, chapter.id].sort());
  });

  it('deletes a whole line', async () => {
    const t = await createTestApp();
    const line = await t.createLine();
    await t.createQuest(line.id, 'quest');

    await t.mutate('DELETE', `/quests/${line.id}`);

    expect((await t.call('GET', `/lines/${line.id}/tree`)).status).toBe(404);
  });

  it('answers 404 for an unknown id', async () => {
    const t = await createTestApp();

    expect((await t.call('DELETE', `/quests/${crypto.randomUUID()}`)).status).toBe(404);
  });
});
