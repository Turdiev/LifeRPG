import { scheduleResponseSchema, todayResponseSchema, type PutScheduleRequest } from '@life-rpg/shared';
import { describe, expect, it } from 'vitest';
import { createTestApp, errorCodeOf, statusesOf, type TestApp } from '../test/test-app';

const DAY_MS = 24 * 60 * 60 * 1000;
const EVERY_DAY = 127;
// Даты от настоящего «сегодня» по UTC: сервер сверяет `today` со своими часами.
const TODAY = new Date().toISOString().slice(0, 10);

function addDays(date: string, days: number): string {
  return new Date(Date.parse(date) + days * DAY_MS).toISOString().slice(0, 10);
}

/** Неделя ежедневного контракта с сегодняшнего дня. */
const WEEK: PutScheduleRequest = { weekdays: EVERY_DAY, start: TODAY, end: addDays(TODAY, 6), today: TODAY };

async function questInChapter(t: TestApp) {
  const line = await t.createLine('Здоровье');
  const chapter = await t.createQuest(line.id, 'chapter', 'Глава 1');
  const quest = await t.createQuest(chapter.id, 'quest', 'Зарядка');
  return { line, chapter, quest };
}

async function putSchedule(t: TestApp, questId: string, body: PutScheduleRequest) {
  const result = await t.call('PUT', `/quests/${questId}/schedule`, body);
  if (result.status !== 200) throw new Error(`PUT schedule → ${result.status}: ${JSON.stringify(result.body)}`);
  return scheduleResponseSchema.parse(result.body);
}

/** Дни контракта в порядке дерева. */
async function daysOf(t: TestApp, lineId: string, questId: string) {
  const { nodes } = await t.tree(lineId);
  return nodes
    .filter((node) => node.parentId === questId)
    .sort((a, b) => (a.position < b.position ? -1 : 1));
}

async function contract(t: TestApp, schedule: PutScheduleRequest = WEEK) {
  const nodes = await questInChapter(t);
  await putSchedule(t, nodes.quest.id, schedule);
  return { ...nodes, days: await daysOf(t, nodes.line.id, nodes.quest.id) };
}

describe('contracts over HTTP', () => {
  it('make a contract → mark a day → change the schedule → finish', async () => {
    const t = await createTestApp();
    const { line, chapter, quest } = await questInChapter(t);

    const made = await putSchedule(t, quest.id, WEEK);
    const days = await daysOf(t, line.id, quest.id);

    expect(made.removed).toEqual([]);
    expect(made.changed.find((node) => node.id === quest.id)).toMatchObject({
      schedule: { weekdays: EVERY_DAY, start: WEEK.start, end: WEEK.end },
    });
    expect(days.map((day) => day.scheduledOn)).toEqual([0, 1, 2, 3, 4, 5, 6].map((n) => addDays(TODAY, n)));
    expect(days.every((day) => day.kind === 'step' && day.title === day.scheduledOn)).toBe(true);

    await t.mutate('POST', `/quests/${days[0]!.id}/complete`, { today: TODAY });
    const shorter = await putSchedule(t, quest.id, { ...WEEK, end: addDays(TODAY, 3) });
    const repeated = await putSchedule(t, quest.id, { ...WEEK, end: addDays(TODAY, 3) });

    expect(shorter.removed.sort()).toEqual(days.slice(4).map((day) => day.id).sort());
    expect(repeated.removed).toEqual([]);
    expect((await daysOf(t, line.id, quest.id)).map((day) => day.id)).toEqual(days.slice(0, 4).map((day) => day.id));

    const finished = await t.mutate('POST', `/quests/${quest.id}/finish`);
    const tree = await t.tree(line.id);

    expect(statusesOf(finished.changed)).toEqual({
      [days[1]!.id]: 'cancelled',
      [days[2]!.id]: 'cancelled',
      [days[3]!.id]: 'cancelled',
      [quest.id]: 'done',
      [chapter.id]: 'done',
      [line.id]: 'done',
    });
    expect(tree.nodes.find((node) => node.id === line.id)?.progress).toEqual({ done: 1, total: 1 });
  });

  it('creates days only on the chosen weekdays, in date order', async () => {
    const t = await createTestApp();
    const weekday = 1 << ((new Date(Date.parse(TODAY)).getUTCDay() + 6) % 7);
    const { days } = await contract(t, { weekdays: weekday, start: TODAY, end: addDays(TODAY, 20), today: TODAY });

    expect(days.map((day) => day.scheduledOn)).toEqual([TODAY, addDays(TODAY, 7), addDays(TODAY, 14)]);
  });

  it('brings a cancelled future day back when the schedule is saved again after finishing', async () => {
    const t = await createTestApp();
    const { line, quest, days } = await contract(t);
    await t.mutate('POST', `/quests/${days[0]!.id}/complete`, { today: TODAY });
    await t.mutate('POST', `/quests/${quest.id}/finish`);

    const reopened = await putSchedule(t, quest.id, WEEK);

    expect(reopened.removed).toEqual([]);
    expect(statusesOf(reopened.changed)).toMatchObject({
      [days[6]!.id]: 'open',
      [quest.id]: 'open',
      [line.id]: 'open',
    });
  });

  it('stops being the active quest once it becomes a contract, and suggests the next quest', async () => {
    const t = await createTestApp();
    const { chapter, quest } = await questInChapter(t);
    const next = await t.createQuest(chapter.id, 'quest', 'Пробежка');
    await t.mutate('PUT', '/me/active-quest', { questId: quest.id });

    const made = await putSchedule(t, quest.id, WEEK);

    expect(made.activeQuestId).toBeNull();
    expect(made.suggestion).toEqual({ id: next.id, title: 'Пробежка' });
  });

  it('clears the deadline when the schedule is turned on', async () => {
    const t = await createTestApp();
    const { quest } = await questInChapter(t);
    await t.mutate('PATCH', `/quests/${quest.id}`, { deadline: addDays(TODAY, 30) });

    const { changed } = await putSchedule(t, quest.id, WEEK);

    expect(changed.find((node) => node.id === quest.id)?.deadline).toBeNull();
  });

  it('moves the start of a contract that has not started yet, keeping days in date order', async () => {
    const t = await createTestApp();
    const { line, quest } = await contract(t, { ...WEEK, start: addDays(TODAY, 2) });

    await putSchedule(t, quest.id, { ...WEEK, start: addDays(TODAY, 4) });
    const later = await daysOf(t, line.id, quest.id);
    await putSchedule(t, quest.id, { ...WEEK, start: addDays(TODAY, 1), end: addDays(TODAY, 8) });
    const wider = await daysOf(t, line.id, quest.id);

    expect(later.map((day) => day.scheduledOn)).toEqual([4, 5, 6].map((n) => addDays(TODAY, n)));
    expect(wider.map((day) => day.scheduledOn)).toEqual([1, 2, 3, 4, 5, 6, 7, 8].map((n) => addDays(TODAY, n)));
    expect(wider.slice(3, 6).map((day) => day.id)).toEqual(later.map((day) => day.id));
  });

  it('answers 409 to a schedule for a quest with steps, for a chapter and with a start in the past', async () => {
    const t = await createTestApp();
    const { chapter, quest } = await questInChapter(t);
    await t.createQuest(quest.id, 'step');
    const empty = await t.createQuest(chapter.id, 'quest', 'Пустое');

    const results = [
      await t.call('PUT', `/quests/${quest.id}/schedule`, WEEK),
      await t.call('PUT', `/quests/${chapter.id}/schedule`, WEEK),
      await t.call('PUT', `/quests/${empty.id}/schedule`, { ...WEEK, start: addDays(TODAY, -1) }),
    ];

    expect(results.map((result) => [result.status, errorCodeOf(result)])).toEqual([
      [409, 'invalid_transition'],
      [409, 'invalid_transition'],
      [409, 'invalid_transition'],
    ]);
  });

  it('answers 400 to a term over 366 days, a reversed term, no weekdays and a date after tomorrow', async () => {
    const t = await createTestApp();
    const { quest } = await questInChapter(t);

    const results = [
      await t.call('PUT', `/quests/${quest.id}/schedule`, { ...WEEK, end: addDays(TODAY, 366) }),
      await t.call('PUT', `/quests/${quest.id}/schedule`, { ...WEEK, end: addDays(TODAY, -1) }),
      await t.call('PUT', `/quests/${quest.id}/schedule`, { ...WEEK, weekdays: 0 }),
      await t.call('PUT', `/quests/${quest.id}/schedule`, { ...WEEK, today: addDays(TODAY, 2) }),
    ];

    expect(results.map((result) => [result.status, errorCodeOf(result)])).toEqual(
      Array.from({ length: 4 }, () => [400, 'validation_failed']),
    );
    expect(await putSchedule(t, quest.id, { ...WEEK, end: addDays(TODAY, 365) })).toBeDefined();
  });
});

describe('contract days', () => {
  it('need today to be marked or cancelled', async () => {
    const t = await createTestApp();
    const { days } = await contract(t);

    const complete = await t.call('POST', `/quests/${days[0]!.id}/complete`);
    const cancel = await t.call('POST', `/quests/${days[0]!.id}/cancel`);

    expect([complete.status, errorCodeOf(complete)]).toEqual([400, 'validation_failed']);
    expect([cancel.status, errorCodeOf(cancel)]).toEqual([400, 'validation_failed']);
  });

  it('answers 409 not_due to marking a day ahead, and 409 to cancelling it', async () => {
    const t = await createTestApp();
    const { days } = await contract(t);

    const complete = await t.call('POST', `/quests/${days[2]!.id}/complete`, { today: TODAY });
    const cancel = await t.call('POST', `/quests/${days[2]!.id}/cancel`, { today: TODAY });

    expect([complete.status, errorCodeOf(complete)]).toEqual([409, 'not_due']);
    expect([cancel.status, errorCodeOf(cancel)]).toEqual([409, 'invalid_transition']);
  });

  it('cancels today’s day and marks it again after restore', async () => {
    const t = await createTestApp();
    const { days } = await contract(t);

    const cancelled = await t.mutate('POST', `/quests/${days[0]!.id}/cancel`, { today: TODAY });
    await t.mutate('POST', `/quests/${days[0]!.id}/restore`);
    const done = await t.mutate('POST', `/quests/${days[0]!.id}/complete`, { today: TODAY });

    expect(statusesOf(cancelled.changed)).toMatchObject({ [days[0]!.id]: 'cancelled' });
    expect(statusesOf(done.changed)).toMatchObject({ [days[0]!.id]: 'done' });
  });

  it('cannot be added, renamed, given a deadline, moved or deleted by hand', async () => {
    const t = await createTestApp();
    const { quest, days } = await contract(t);
    const day = days[0]!;

    const extra = { parentId: quest.id, kind: 'step' };
    const results = [
      await t.call('POST', '/quests', { ...extra, title: 'Лишний' }),
      await t.call('POST', '/quests/batch', { ...extra, items: [{ title: 'Лишний', children: [] }] }),
      await t.call('PATCH', `/quests/${day.id}`, { title: 'Другое' }),
      await t.call('PATCH', `/quests/${day.id}`, { deadline: TODAY }),
      await t.call('PATCH', `/quests/${quest.id}`, { deadline: TODAY }),
      await t.call('POST', `/quests/${day.id}/move`, { afterId: days[1]!.id }),
      await t.call('DELETE', `/quests/${day.id}`),
    ];

    expect(results.map((result) => [result.status, errorCodeOf(result)])).toEqual([
      [409, 'invalid_parent'],
      [409, 'invalid_parent'],
      [409, 'invalid_transition'],
      [409, 'invalid_transition'],
      [409, 'invalid_transition'],
      [409, 'invalid_transition'],
      [409, 'invalid_transition'],
    ]);
  });

  it('keep a description, and the contract keeps its title and can be deleted with its days', async () => {
    const t = await createTestApp();
    const { line, quest, days } = await contract(t);

    await t.mutate('PATCH', `/quests/${days[0]!.id}`, { description: 'Десять минут' });
    await t.mutate('PATCH', `/quests/${quest.id}`, { title: 'Утренняя зарядка' });
    await t.mutate('DELETE', `/quests/${quest.id}`);

    expect((await t.tree(line.id)).nodes.some((node) => node.parentId === quest.id)).toBe(false);
  });
});

describe('GET /api/v1/today?date=', () => {
  it('lists contracts due on the date in tree order, expired ones last, with the trees of their lines', async () => {
    const t = await createTestApp();
    const line = await t.createLine('Здоровье');
    const chapter = await t.createQuest(line.id, 'chapter', 'Глава 1');
    const expired = await t.createQuest(chapter.id, 'quest', 'Растяжка');
    const marked = await t.createQuest(chapter.id, 'quest', 'Зарядка');
    const skipped = await t.createQuest(chapter.id, 'quest', 'Медитация');
    const pausedChapter = await t.createQuest(line.id, 'chapter', 'Глава 2');
    const paused = await t.createQuest(pausedChapter.id, 'quest', 'Плавание');
    // Дата из прошлого: так приходит отметка из очереди без сети, и срок можно было начать тогда.
    const past = addDays(TODAY, -10);
    await putSchedule(t, expired.id, { weekdays: EVERY_DAY, start: past, end: addDays(past, 2), today: past });
    for (const quest of [marked, skipped, paused]) await putSchedule(t, quest.id, WEEK);
    const [markedDay] = await daysOf(t, line.id, marked.id);
    const [skippedDay] = await daysOf(t, line.id, skipped.id);
    await t.mutate('POST', `/quests/${markedDay!.id}/complete`, { today: TODAY });
    await t.mutate('POST', `/quests/${skippedDay!.id}/cancel`, { today: TODAY });
    await t.mutate('POST', `/quests/${pausedChapter.id}/pause`);

    const result = await t.call('GET', `/today?date=${TODAY}`);
    const { contracts } = todayResponseSchema.parse(result.body);
    const path = [
      { id: line.id, title: 'Здоровье' },
      { id: chapter.id, title: 'Глава 1' },
    ];

    expect(contracts?.items).toEqual([
      {
        questId: marked.id,
        title: 'Зарядка',
        dayId: markedDay!.id,
        lineId: line.id,
        path,
        progress: { done: 1, total: 7 },
        expired: false,
      },
      {
        questId: expired.id,
        title: 'Растяжка',
        dayId: null,
        lineId: line.id,
        path,
        progress: { done: 0, total: 3 },
        expired: true,
      },
    ]);
    expect(contracts?.lines.map((entry) => entry.lineId)).toEqual([line.id]);
    expect(contracts?.lines[0]!.nodes.find((node) => node.id === markedDay!.id)).toMatchObject({ status: 'done' });
  });

  it('has no contracts without a date, and rejects a date after tomorrow', async () => {
    const t = await createTestApp();
    await contract(t);

    const withoutDate = todayResponseSchema.parse((await t.call('GET', '/today')).body);
    const tooLate = await t.call('GET', `/today?date=${addDays(TODAY, 2)}`);

    expect(withoutDate.contracts).toBeUndefined();
    expect([tooLate.status, errorCodeOf(tooLate)]).toEqual([400, 'validation_failed']);
  });
});

describe('the contract itself', () => {
  it('cannot be completed or reopened directly', async () => {
    const t = await createTestApp();
    const { quest, days } = await contract(t);
    const complete = await t.call('POST', `/quests/${quest.id}/complete`, { withChildren: true });
    await t.mutate('POST', `/quests/${days[0]!.id}/complete`, { today: TODAY });
    await t.mutate('POST', `/quests/${quest.id}/finish`);
    const reopen = await t.call('POST', `/quests/${quest.id}/reopen`);

    expect([complete.status, errorCodeOf(complete)]).toEqual([409, 'invalid_transition']);
    expect([reopen.status, errorCodeOf(reopen)]).toEqual([409, 'invalid_transition']);
  });

  it('cannot be finished without a marked day', async () => {
    const t = await createTestApp();
    const { quest } = await contract(t);

    const result = await t.call('POST', `/quests/${quest.id}/finish`);

    expect([result.status, errorCodeOf(result)]).toEqual([409, 'invalid_transition']);
  });

  it('loses its schedule and days while no day is marked, and keeps them after', async () => {
    const t = await createTestApp();
    const { line, quest, days } = await contract(t);
    const other = await contract(t);
    await t.mutate('POST', `/quests/${other.days[0]!.id}/complete`, { today: TODAY });

    const removed = await t.call('DELETE', `/quests/${quest.id}/schedule`);
    const kept = await t.call('DELETE', `/quests/${other.quest.id}/schedule`);

    const body = scheduleResponseSchema.parse(removed.body);
    expect(body.removed.sort()).toEqual(days.map((day) => day.id).sort());
    expect(body.changed.find((node) => node.id === quest.id)?.schedule).toBeNull();
    expect((await t.tree(line.id)).nodes.some((node) => node.parentId === quest.id)).toBe(false);
    expect([kept.status, errorCodeOf(kept)]).toEqual([409, 'invalid_transition']);
  });

  it('is not found for another user', async () => {
    const owner = await createTestApp();
    const stranger = await createTestApp();
    const { quest } = await contract(owner);

    const results = [
      await stranger.call('PUT', `/quests/${quest.id}/schedule`, WEEK),
      await stranger.call('DELETE', `/quests/${quest.id}/schedule`),
      await stranger.call('POST', `/quests/${quest.id}/finish`),
    ];

    expect(results.map((result) => result.status)).toEqual([404, 404, 404]);
  });
});
