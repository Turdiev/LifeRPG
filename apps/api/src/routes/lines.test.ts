import { linesResponseSchema } from '@life-rpg/shared';
import { describe, expect, it } from 'vitest';
import { createTestApp, errorCodeOf } from '../test/test-app';

describe('POST /api/v1/lines', () => {
  it('creates an open line with the given fields', async () => {
    const t = await createTestApp();

    const result = await t.call('POST', '/lines', { title: '  Полумарафон  ', deadline: '2027-05-01' });

    expect(result.status).toBe(201);
    expect(result.body).toMatchObject({
      changed: [{ kind: 'line', status: 'open', parentId: null, title: 'Полумарафон', deadline: '2027-05-01' }],
    });
  });

  it('rejects an empty title and unknown fields with 400', async () => {
    const t = await createTestApp();

    const empty = await t.call('POST', '/lines', { title: '   ' });
    const unknown = await t.call('POST', '/lines', { title: 'Линия', status: 'done' });

    expect(empty.status).toBe(400);
    expect(errorCodeOf(empty)).toBe('validation_failed');
    expect(unknown.status).toBe(400);
  });

  it('rejects malformed JSON with 400', async () => {
    const t = await createTestApp();

    const res = await t.request('/lines', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"title":',
    });

    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: { code: 'validation_failed' } });
  });
});

describe('GET /api/v1/lines', () => {
  it('lists only lines of the requested status, with progress', async () => {
    const t = await createTestApp();
    const first = await t.createLine('Первая');
    const second = await t.createLine('Вторая');
    const chapter = await t.createQuest(first.id, 'chapter');
    const quest = await t.createQuest(chapter.id, 'quest');
    await t.createQuest(quest.id, 'step', 'Этап 1');
    const done = await t.createQuest(quest.id, 'step', 'Этап 2');
    await t.mutate('POST', `/quests/${done.id}/complete`);
    await t.mutate('POST', `/quests/${second.id}/pause`);

    const open = linesResponseSchema.parse((await t.call('GET', '/lines')).body);
    const paused = linesResponseSchema.parse((await t.call('GET', '/lines?status=paused')).body);

    expect(open.lines).toEqual([
      expect.objectContaining({ id: first.id, progress: { done: 1, total: 2 }, hasActiveQuest: false }),
    ]);
    expect(paused.lines.map((l) => l.id)).toEqual([second.id]);
  });

  it('puts the line with the active quest first, the rest by their latest change in any node', async () => {
    const t = await createTestApp();
    const a = await t.createLine('A');
    const b = await t.createLine('B');
    await t.createLine('C');
    const questA = await t.createQuest(a.id, 'quest');
    await t.createQuest(a.id, 'quest', 'держит линию A открытой');
    const questB = await t.createQuest(b.id, 'quest');
    await t.mutate('PUT', '/me/active-quest', { questId: questB.id });
    await t.mutate('POST', `/quests/${questA.id}/complete`);

    const { lines } = linesResponseSchema.parse((await t.call('GET', '/lines')).body);

    expect(lines.map((l) => [l.title, l.hasActiveQuest])).toEqual([
      ['B', true],
      ['A', false],
      ['C', false],
    ]);
  });

  it('counts a deletion inside a line as its latest change', async () => {
    const t = await createTestApp();
    const b = await t.createLine('B');
    const a = await t.createLine('A');
    const quest = await t.createQuest(a.id, 'quest');
    await t.createQuest(b.id, 'quest');

    await t.mutate('DELETE', `/quests/${quest.id}`);
    const { lines } = linesResponseSchema.parse((await t.call('GET', '/lines')).body);

    expect(lines.map((l) => l.title)).toEqual(['A', 'B']);
  });

  it('reports the first unfinished chapter as current, among chapters that are not cancelled', async () => {
    const t = await createTestApp();
    const line = await t.createLine();
    const c1 = await t.createQuest(line.id, 'chapter', 'C1');
    await t.createQuest(line.id, 'chapter', 'C2');
    const c3 = await t.createQuest(line.id, 'chapter', 'C3');
    await t.createQuest(line.id, 'chapter', 'C4');
    await t.mutate('POST', `/quests/${c1.id}/complete`);
    await t.mutate('POST', `/quests/${c3.id}/cancel`);
    const flat = await t.createLine('Без глав');
    await t.createQuest(flat.id, 'quest');

    const { lines } = linesResponseSchema.parse((await t.call('GET', '/lines')).body);

    expect(lines.find((l) => l.id === line.id)?.chapters).toEqual({ current: 2, total: 3 });
    expect(lines.find((l) => l.id === flat.id)?.chapters).toBeNull();
  });

  it('reports the last chapter as current when all chapters are done', async () => {
    const t = await createTestApp();
    const line = await t.createLine();
    const c1 = await t.createQuest(line.id, 'chapter', 'C1');
    const c2 = await t.createQuest(line.id, 'chapter', 'C2');
    await t.createQuest(line.id, 'quest', 'Открытое задание в линии');
    await t.mutate('POST', `/quests/${c1.id}/complete`);
    await t.mutate('POST', `/quests/${c2.id}/complete`);

    const { lines } = linesResponseSchema.parse((await t.call('GET', '/lines')).body);

    expect(lines[0]?.chapters).toEqual({ current: 2, total: 2 });
  });

  it('returns the number of lines in every status for the filter chips', async () => {
    const t = await createTestApp();
    await t.createLine('open');
    const paused = await t.createLine('paused');
    const done = await t.createLine('done');
    await t.mutate('POST', `/quests/${paused.id}/pause`);
    await t.mutate('POST', `/quests/${done.id}/complete`);

    const response = linesResponseSchema.parse((await t.call('GET', '/lines?status=done')).body);

    expect(response.counts).toEqual({ open: 1, paused: 1, done: 1, cancelled: 0 });
    expect(response.lines.map((l) => l.title)).toEqual(['done']);
  });

  it('rejects an unknown status filter', async () => {
    const t = await createTestApp();

    expect((await t.call('GET', '/lines?status=archived')).status).toBe(400);
  });
});

describe('GET /api/v1/lines/:id/tree', () => {
  it('returns every node of the line flat, each with its progress', async () => {
    const t = await createTestApp();
    const line = await t.createLine();
    const quest = await t.createQuest(line.id, 'quest');
    const step = await t.createQuest(quest.id, 'step');
    await t.createQuest(quest.id, 'step', 'second');
    await t.mutate('POST', `/quests/${step.id}/complete`);

    const tree = await t.tree(line.id);

    expect(tree.nodes).toHaveLength(4);
    expect(tree.nodes.find((n) => n.id === line.id)?.progress).toEqual({ done: 1, total: 2 });
    expect(tree.nodes.find((n) => n.id === step.id)?.progress).toEqual({ done: 1, total: 1 });
    expect(tree.activeQuestId).toBeNull();
  });

  it('answers 404 for an unknown id and for a node that is not a line', async () => {
    const t = await createTestApp();
    const line = await t.createLine();
    const quest = await t.createQuest(line.id, 'quest');

    const unknown = await t.call('GET', `/lines/${crypto.randomUUID()}/tree`);
    const notLine = await t.call('GET', `/lines/${quest.id}/tree`);

    expect(unknown.status).toBe(404);
    expect(errorCodeOf(unknown)).toBe('not_found');
    expect(notLine.status).toBe(404);
  });

  it('answers 400 for an id that is not a uuid', async () => {
    const t = await createTestApp();

    expect((await t.call('GET', '/lines/not-a-uuid/tree')).status).toBe(400);
  });

  it("answers 404, not 403, for another user's line", async () => {
    const owner = await createTestApp();
    const stranger = await createTestApp();
    const line = await owner.createLine();

    expect((await stranger.call('GET', `/lines/${line.id}/tree`)).status).toBe(404);
  });
});
