import { describe, expect, it } from 'vitest';
import { createTestApp, errorCodeOf, statusesOf, type TestApp } from '../test/test-app';

async function lineWithSteps(t: TestApp, stepCount = 2) {
  const line = await t.createLine();
  const chapter = await t.createQuest(line.id, 'chapter');
  const quest = await t.createQuest(chapter.id, 'quest');
  const steps = [];
  for (let i = 0; i < stepCount; i++) steps.push(await t.createQuest(quest.id, 'step', `Этап ${i + 1}`));
  return { line, chapter, quest, steps };
}

describe('POST /api/v1/quests/:id/complete', () => {
  it('completes the last step and every ancestor, with completedAt', async () => {
    const t = await createTestApp();
    const { line, chapter, quest, steps } = await lineWithSteps(t);
    await t.mutate('POST', `/quests/${steps[0]!.id}/complete`);

    const { changed } = await t.mutate('POST', `/quests/${steps[1]!.id}/complete`);

    expect(statusesOf(changed)).toEqual({
      [steps[1]!.id]: 'done',
      [quest.id]: 'done',
      [chapter.id]: 'done',
      [line.id]: 'done',
    });
    expect(changed.every((node) => node.completedAt !== null)).toBe(true);
    const tree = await t.tree(line.id);
    expect(tree.nodes.find((n) => n.id === line.id)).toMatchObject({ status: 'done', progress: { done: 2, total: 2 } });
  });

  it('answers 409 has_open_children for a quest with open steps, and closes them with withChildren', async () => {
    const t = await createTestApp();
    const { quest, steps } = await lineWithSteps(t);

    const rejected = await t.call('POST', `/quests/${quest.id}/complete`);
    const { changed } = await t.mutate('POST', `/quests/${quest.id}/complete`, { withChildren: true });

    expect(rejected.status).toBe(409);
    expect(errorCodeOf(rejected)).toBe('has_open_children');
    expect(statusesOf(changed)).toMatchObject({ [steps[0]!.id]: 'done', [steps[1]!.id]: 'done', [quest.id]: 'done' });
  });

  it('is idempotent: completing a done node answers 200 with nothing changed', async () => {
    const t = await createTestApp();
    const { steps } = await lineWithSteps(t);
    await t.mutate('POST', `/quests/${steps[0]!.id}/complete`);

    const { changed } = await t.mutate('POST', `/quests/${steps[0]!.id}/complete`);

    expect(changed).toEqual([]);
  });

  it('completes both of two steps completed at the same time and closes the line (FOR UPDATE)', async () => {
    const t = await createTestApp();
    const { line, steps } = await lineWithSteps(t);

    await Promise.all(steps.map((step) => t.mutate('POST', `/quests/${step.id}/complete`)));

    const tree = await t.tree(line.id);
    expect(tree.nodes.every((node) => node.status === 'done')).toBe(true);
  });
});

describe('reopen, pause, resume, cancel, restore', () => {
  it('reopens a step and its done ancestors', async () => {
    const t = await createTestApp();
    const { line, chapter, quest, steps } = await lineWithSteps(t, 1);
    await t.mutate('POST', `/quests/${steps[0]!.id}/complete`);

    const { changed } = await t.mutate('POST', `/quests/${steps[0]!.id}/reopen`);

    expect(statusesOf(changed)).toEqual({
      [steps[0]!.id]: 'open',
      [quest.id]: 'open',
      [chapter.id]: 'open',
      [line.id]: 'open',
    });
    expect(changed.every((node) => node.completedAt === null)).toBe(true);
  });

  it('locks a paused chapter until it is resumed', async () => {
    const t = await createTestApp();
    const { chapter, steps } = await lineWithSteps(t);
    await t.mutate('POST', `/quests/${chapter.id}/pause`);

    const locked = await t.call('POST', `/quests/${steps[0]!.id}/complete`);
    await t.mutate('POST', `/quests/${chapter.id}/resume`);
    const unlocked = await t.call('POST', `/quests/${steps[0]!.id}/complete`);

    expect(locked.status).toBe(409);
    expect(errorCodeOf(locked)).toBe('branch_locked');
    expect(unlocked.status).toBe(200);
  });

  it('answers 409 invalid_transition when pausing a quest', async () => {
    const t = await createTestApp();
    const { quest } = await lineWithSteps(t);

    const result = await t.call('POST', `/quests/${quest.id}/pause`);

    expect(result.status).toBe(409);
    expect(errorCodeOf(result)).toBe('invalid_transition');
  });

  it('cancelling the last open step completes the quest; restoring reopens it', async () => {
    const t = await createTestApp();
    const { quest, steps } = await lineWithSteps(t);
    await t.mutate('POST', `/quests/${steps[0]!.id}/complete`);

    const cancelled = await t.mutate('POST', `/quests/${steps[1]!.id}/cancel`);
    const restored = await t.mutate('POST', `/quests/${steps[1]!.id}/restore`);

    expect(statusesOf(cancelled.changed)).toMatchObject({ [steps[1]!.id]: 'cancelled', [quest.id]: 'done' });
    expect(statusesOf(restored.changed)).toMatchObject({ [steps[1]!.id]: 'open', [quest.id]: 'open' });
  });

  it('answers 404 for an unknown id and 400 for an unknown body field', async () => {
    const t = await createTestApp();
    const { steps } = await lineWithSteps(t, 1);

    expect((await t.call('POST', `/quests/${crypto.randomUUID()}/complete`)).status).toBe(404);
    expect((await t.call('POST', `/quests/${steps[0]!.id}/complete`, { force: true })).status).toBe(400);
  });
});

describe('active quest', () => {
  it('PUT /me/active-quest sets and clears the active quest', async () => {
    const t = await createTestApp();
    const { line, quest } = await lineWithSteps(t);

    const set = await t.mutate('PUT', '/me/active-quest', { questId: quest.id });
    const afterSet = await t.tree(line.id);
    const cleared = await t.mutate('PUT', '/me/active-quest', { questId: null });

    expect(set.activeQuestId).toBe(quest.id);
    expect(afterSet.activeQuestId).toBe(quest.id);
    expect(cleared.activeQuestId).toBeNull();
  });

  it('answers 409 for a step, a done quest or a quest in a paused chapter', async () => {
    const t = await createTestApp();
    const { chapter, quest, steps } = await lineWithSteps(t, 1);
    const done = await t.createQuest(chapter.id, 'quest', 'done');
    await t.mutate('POST', `/quests/${done.id}/complete`);

    const forStep = await t.call('PUT', '/me/active-quest', { questId: steps[0]!.id });
    const forDone = await t.call('PUT', '/me/active-quest', { questId: done.id });
    await t.mutate('POST', `/quests/${chapter.id}/pause`);
    const forPaused = await t.call('PUT', '/me/active-quest', { questId: quest.id });

    expect([forStep.status, forDone.status, forPaused.status]).toEqual([409, 409, 409]);
    expect([errorCodeOf(forStep), errorCodeOf(forDone), errorCodeOf(forPaused)]).toEqual([
      'invalid_transition',
      'invalid_transition',
      'branch_locked',
    ]);
  });

  it('cancelling the active quest clears it and suggests the next one', async () => {
    const t = await createTestApp();
    const { chapter, quest } = await lineWithSteps(t);
    const next = await t.createQuest(chapter.id, 'quest', 'Следующее');
    await t.mutate('PUT', '/me/active-quest', { questId: quest.id });

    const result = await t.mutate('POST', `/quests/${quest.id}/cancel`);

    expect(result.activeQuestId).toBeNull();
    expect(result.suggestion).toEqual({ id: next.id, title: 'Следующее' });
  });

  it("answers 404 for another user's quest", async () => {
    const owner = await createTestApp();
    const stranger = await createTestApp();
    const { quest } = await lineWithSteps(owner);

    expect((await stranger.call('PUT', '/me/active-quest', { questId: quest.id })).status).toBe(404);
  });

  it('completing the active quest clears it and suggests the next one of the chapter', async () => {
    const t = await createTestApp();
    const { chapter, quest, steps } = await lineWithSteps(t, 1);
    const next = await t.createQuest(chapter.id, 'quest', 'Следующее');
    await t.mutate('PUT', '/me/active-quest', { questId: quest.id });

    const result = await t.mutate('POST', `/quests/${steps[0]!.id}/complete`);

    expect(result.activeQuestId).toBeNull();
    expect(result.suggestion).toEqual({ id: next.id, title: 'Следующее' });
  });

  it('pausing the chapter of the active quest clears it and suggests a quest of the next chapter', async () => {
    const t = await createTestApp();
    const { line, chapter, quest } = await lineWithSteps(t);
    const nextChapter = await t.createQuest(line.id, 'chapter', 'Глава 2');
    const next = await t.createQuest(nextChapter.id, 'quest', 'В главе 2');
    await t.mutate('PUT', '/me/active-quest', { questId: quest.id });

    const result = await t.mutate('POST', `/quests/${chapter.id}/pause`);

    expect(result.activeQuestId).toBeNull();
    expect(result.suggestion).toEqual({ id: next.id, title: 'В главе 2' });
  });

  it('keeps the active quest when another quest changes', async () => {
    const t = await createTestApp();
    const { chapter, quest } = await lineWithSteps(t);
    const other = await t.createQuest(chapter.id, 'quest', 'other');
    await t.mutate('PUT', '/me/active-quest', { questId: quest.id });

    const result = await t.mutate('POST', `/quests/${other.id}/complete`);

    expect(result.activeQuestId).toBe(quest.id);
    expect(result.suggestion).toBeUndefined();
  });
});
