import { describe, expect, it } from 'vitest';
import { createTestApp } from '../test/test-app';

// tech-spec, «Безопасность»: чужой id всегда даёт 404 и ничего не меняет.
describe("another user's quest", () => {
  it('is 404 for every mutation and stays untouched', async () => {
    const owner = await createTestApp();
    const stranger = await createTestApp();
    const line = await owner.createLine();
    const chapter = await owner.createQuest(line.id, 'chapter');
    const quest = await owner.createQuest(chapter.id, 'quest');
    const before = await owner.tree(line.id);

    const results = await Promise.all([
      stranger.call('PATCH', `/quests/${quest.id}`, { title: 'чужое' }),
      stranger.call('POST', `/quests/${quest.id}/move`, { afterId: null }),
      stranger.call('POST', `/quests/${quest.id}/complete`),
      stranger.call('POST', `/quests/${quest.id}/reopen`),
      stranger.call('POST', `/quests/${chapter.id}/pause`),
      stranger.call('POST', `/quests/${chapter.id}/resume`),
      stranger.call('POST', `/quests/${quest.id}/cancel`),
      stranger.call('POST', `/quests/${quest.id}/restore`),
      stranger.call('DELETE', `/quests/${quest.id}`),
      stranger.call('DELETE', `/quests/${line.id}`),
    ]);

    expect(results.map((r) => r.status)).toEqual(Array(results.length).fill(404));
    expect(await owner.tree(line.id)).toEqual(before);
  });

  it('is not listed among the lines of another user', async () => {
    const owner = await createTestApp();
    const stranger = await createTestApp();
    await owner.createLine();

    expect((await stranger.call('GET', '/lines')).body).toEqual({
      lines: [],
      counts: { open: 0, paused: 0, done: 0, cancelled: 0 },
    });
  });
});
