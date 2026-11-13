import { describe, expect, it } from 'vitest';
import { createTestApp, errorCodeOf, testEnv } from '../test/test-app';

// tech-spec, «Безопасность»: запросы с других origin отклоняются. Чужой сайт может отправить
// из браузера пользователя форму или запрос без тела (complete, pause, DELETE) — без CORS и с cookie.
describe('a cross-site request with the session cookie', () => {
  it('is rejected with 403 forbidden and changes nothing', async () => {
    const t = await createTestApp();
    const line = await t.createLine();
    const quest = await t.createQuest(line.id, 'quest');
    const before = await t.tree(line.id);
    const fromEvil = { origin: 'https://evil.example', 'sec-fetch-site': 'cross-site' };

    const results = await Promise.all([
      t.request(`/quests/${quest.id}/complete`, { method: 'POST', headers: fromEvil }),
      t.request(`/quests/${line.id}`, { method: 'DELETE', headers: fromEvil }),
      t.request('/lines', {
        method: 'POST',
        headers: { ...fromEvil, 'content-type': 'application/x-www-form-urlencoded' },
        body: 'title=evil',
      }),
    ]);

    expect(results.map((res) => res.status)).toEqual([403, 403, 403]);
    const bodies = await Promise.all(results.map(async (res) => ({ status: res.status, body: await res.json() })));
    expect(bodies.map(errorCodeOf)).toEqual(['forbidden', 'forbidden', 'forbidden']);
    expect(await t.tree(line.id)).toEqual(before);
  });

  it('passes from the app origin, and reads stay open to any origin', async () => {
    const t = await createTestApp();
    const line = await t.createLine();
    const quest = await t.createQuest(line.id, 'quest');

    const own = await t.request(`/quests/${quest.id}/complete`, {
      method: 'POST',
      headers: { origin: new URL(testEnv.BETTER_AUTH_URL).origin },
    });
    const read = await t.request('/lines', { headers: { origin: 'https://evil.example' } });

    expect([own.status, read.status]).toEqual([200, 200]);
  });
});
