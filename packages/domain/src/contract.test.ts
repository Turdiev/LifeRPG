import { describe, expect, it } from 'vitest';
import { applyChanges } from './apply-changes';
import { applyCancel, applyComplete, applyReopen, applyRestore } from './cascade';
import {
  applyFinishContract,
  applyRemoveSchedule,
  applySchedule,
  contractDates,
  defaultTerm,
  planSchedule,
} from './contract';
import { progress } from './progress';
import { buildTree } from './tree';
import {
  catchDomainError,
  chapter,
  contract,
  day,
  line,
  makeNode,
  makeTree,
  newDays,
  NOW,
  quest,
  statuses,
  step,
} from './testing';
import type { Schedule } from './types';

const MON = 1;
const TUE = 2;
const WED = 4;
const FRI = 16;
const SUN = 64;
const EVERY_DAY = 127;

// 30 ноября 2026 — понедельник, 4 декабря — пятница.
const TODAY = '2026-12-04';
const MWF: Schedule = { weekdays: MON | WED | FRI, start: '2026-11-30', end: '2026-12-13' };

/** Контракт на две недели «пн, ср, пт»: понедельник отмечен, среда пропущена, сегодня пятница. */
function twoWeeks(statusesByDate: Record<string, 'open' | 'done' | 'cancelled'> = {}, contractStatus: 'open' | 'done' = 'open') {
  const dates = ['2026-11-30', '2026-12-02', '2026-12-04', '2026-12-07', '2026-12-09', '2026-12-11'];
  const base: Record<string, 'open' | 'done' | 'cancelled'> = { '2026-11-30': 'done' };
  const days = dates.map((date) => day(date, statusesByDate[date] ?? base[date] ?? 'open'));
  return makeTree(line('L', [chapter('C', [contract('K', MWF, days, contractStatus)])]));
}

describe('contractDates (rule 2)', () => {
  it('lists the days that fall on the chosen weekdays, end included', () => {
    expect(contractDates(MWF, MWF.start)).toEqual([
      '2026-11-30',
      '2026-12-02',
      '2026-12-04',
      '2026-12-07',
      '2026-12-09',
      '2026-12-11',
    ]);
  });

  it('treats all seven weekdays as every day', () => {
    expect(contractDates({ weekdays: EVERY_DAY, start: '2026-12-01', end: '2026-12-03' }, '2026-12-01')).toEqual([
      '2026-12-01',
      '2026-12-02',
      '2026-12-03',
    ]);
  });

  it('handles a term that starts and ends mid-week', () => {
    expect(contractDates({ weekdays: SUN, start: '2026-12-01', end: '2026-12-13' }, '2026-12-01')).toEqual([
      '2026-12-06',
      '2026-12-13',
    ]);
  });

  it('starts from the given date when it is later than the term start', () => {
    expect(contractDates(MWF, '2026-12-05')).toEqual(['2026-12-07', '2026-12-09', '2026-12-11']);
  });
});

describe('planSchedule: turning a quest into a contract (rule 1)', () => {
  const ENABLE_TODAY = '2026-11-30';

  it('plans a day for every scheduled date of the term', () => {
    const tree = makeTree(line('L', [quest('Q')]));

    expect(planSchedule(tree, 'Q', MWF, ENABLE_TODAY)).toEqual({
      add: ['2026-11-30', '2026-12-02', '2026-12-04', '2026-12-07', '2026-12-09', '2026-12-11'],
      remove: [],
      restore: [],
    });
  });

  it('rejects a quest with steps, even cancelled ones', () => {
    const withStep = makeTree(line('L', [quest('Q', [step('S')])]));
    const withCancelled = makeTree(line('L', [quest('Q', [step('S', 'cancelled')])]));

    expect(catchDomainError(() => planSchedule(withStep, 'Q', MWF, ENABLE_TODAY)).code).toBe('invalid_transition');
    expect(catchDomainError(() => planSchedule(withCancelled, 'Q', MWF, ENABLE_TODAY)).code).toBe(
      'invalid_transition',
    );
  });

  it('rejects anything but a quest', () => {
    const tree = makeTree(line('L', [chapter('C')]));

    expect(catchDomainError(() => planSchedule(tree, 'C', MWF, ENABLE_TODAY)).code).toBe('invalid_transition');
  });

  it('rejects a quest in a paused branch and a cancelled quest', () => {
    const tree = makeTree(line('L', [chapter('P', [quest('InPaused')], 'paused'), quest('Cancelled', [], 'cancelled')]));

    expect(catchDomainError(() => planSchedule(tree, 'InPaused', MWF, ENABLE_TODAY)).code).toBe('branch_locked');
    expect(catchDomainError(() => planSchedule(tree, 'Cancelled', MWF, ENABLE_TODAY)).code).toBe('branch_locked');
  });

  it('rejects a term that starts before today', () => {
    const tree = makeTree(line('L', [quest('Q')]));

    expect(catchDomainError(() => planSchedule(tree, 'Q', MWF, '2026-12-01')).code).toBe('invalid_transition');
  });

  it('accepts a term of 366 days across 29 February and rejects a longer one', () => {
    const tree = makeTree(line('L', [quest('Q')]));
    const year: Schedule = { weekdays: EVERY_DAY, start: '2027-03-01', end: '2028-02-29' };

    expect(planSchedule(tree, 'Q', year, '2027-03-01').add).toHaveLength(366);
    expect(catchDomainError(() => planSchedule(tree, 'Q', { ...year, end: '2028-03-01' }, '2027-03-01')).code).toBe(
      'invalid_transition',
    );
  });

  it('rejects a term that ends before it starts and an empty set of weekdays', () => {
    const tree = makeTree(line('L', [quest('Q')]));

    expect(
      catchDomainError(() => planSchedule(tree, 'Q', { ...MWF, end: '2026-11-29' }, ENABLE_TODAY)).code,
    ).toBe('invalid_transition');
    expect(catchDomainError(() => planSchedule(tree, 'Q', { ...MWF, weekdays: 0 }, ENABLE_TODAY)).code).toBe(
      'invalid_transition',
    );
    expect(catchDomainError(() => planSchedule(tree, 'Q', { ...MWF, weekdays: 128 }, ENABLE_TODAY)).code).toBe(
      'invalid_transition',
    );
  });

  it('rejects a schedule that yields no days', () => {
    const tree = makeTree(line('L', [quest('Q')]));
    const noSunday: Schedule = { weekdays: SUN, start: '2026-12-01', end: '2026-12-05' };

    expect(catchDomainError(() => planSchedule(tree, 'Q', noSunday, '2026-12-01')).code).toBe('invalid_transition');
  });

  it('reopens a done quest and its done ancestors once the days exist', () => {
    const tree = makeTree(line('L', [quest('Q', [], 'done')], 'done'));
    const plan = planSchedule(tree, 'Q', MWF, ENABLE_TODAY);

    expect(statuses(applySchedule(tree, 'Q', plan, newDays('Q', plan.add), NOW))).toEqual({ Q: 'open', L: 'open' });
  });
});

describe('completing and cancelling contract days (rules 3 and 4)', () => {
  it('completes today and a missed past day, but not a future one', () => {
    const tree = twoWeeks();

    expect(statuses(applyComplete(tree, '2026-12-04', NOW, { today: TODAY }))).toEqual({ '2026-12-04': 'done' });
    expect(statuses(applyComplete(tree, '2026-12-02', NOW, { today: TODAY }))).toEqual({ '2026-12-02': 'done' });
    expect(catchDomainError(() => applyComplete(tree, '2026-12-07', NOW, { today: TODAY })).code).toBe('not_due');
  });

  it('needs today to complete a day', () => {
    expect(() => applyComplete(twoWeeks(), '2026-12-04', NOW)).toThrow(/today/);
  });

  it('completes the contract and its ancestors when the last live day is done (cascade rule 1)', () => {
    const shortTerm: Schedule = { ...MWF, end: TODAY };
    const tree = makeTree(
      line('L', [
        chapter('C', [
          contract('K', shortTerm, [day('2026-11-30', 'done'), day('2026-12-02', 'cancelled'), day('2026-12-04')]),
        ]),
      ]),
    );

    expect(statuses(applyComplete(tree, '2026-12-04', NOW, { today: TODAY }))).toEqual({
      '2026-12-04': 'done',
      K: 'done',
      C: 'done',
      L: 'done',
    });
  });

  it('cancels today’s day, but not a future day', () => {
    const tree = twoWeeks();

    expect(statuses(applyCancel(tree, '2026-12-04', NOW, { today: TODAY }))).toEqual({ '2026-12-04': 'cancelled' });
    expect(catchDomainError(() => applyCancel(tree, '2026-12-07', NOW, { today: TODAY })).code).toBe(
      'invalid_transition',
    );
  });

  it('does not cancel the last live day: the whole contract is cancelled instead', () => {
    const tree = makeTree(
      line('L', [contract('K', { ...MWF, end: TODAY }, [day('2026-11-30', 'cancelled'), day('2026-12-02', 'cancelled'), day('2026-12-04')])]),
    );

    expect(catchDomainError(() => applyCancel(tree, '2026-12-04', NOW, { today: TODAY })).code).toBe(
      'invalid_transition',
    );
    expect(statuses(applyCancel(tree, 'K', NOW))).toEqual({ K: 'cancelled' });
  });

  it('cancels and restores a past day', () => {
    const tree = twoWeeks({ '2026-12-02': 'cancelled' });

    expect(statuses(applyCancel(twoWeeks(), '2026-12-02', NOW, { today: TODAY }))).toEqual({ '2026-12-02': 'cancelled' });
    expect(statuses(applyRestore(tree, '2026-12-02', NOW))).toEqual({ '2026-12-02': 'open' });
  });

  it('restores a future day cancelled by finishing and reopens the contract', () => {
    const finished = makeTree(
      line('L', [contract('K', MWF, [day('2026-11-30', 'done'), day('2026-12-07', 'cancelled')], 'done')], 'done'),
    );

    expect(statuses(applyRestore(finished, '2026-12-07', NOW))).toEqual({ '2026-12-07': 'open', K: 'open', L: 'open' });
  });

  it('needs today to cancel a day', () => {
    expect(() => applyCancel(twoWeeks(), '2026-12-04', NOW)).toThrow(/today/);
  });
});

describe('finishing a contract (rule 5)', () => {
  it('cancels every open day, future ones included, and completes the contract', () => {
    const tree = twoWeeks({ '2026-12-04': 'done' });
    const changes = applyFinishContract(tree, 'K', NOW);

    expect(statuses(changes)).toEqual({
      '2026-12-02': 'cancelled',
      '2026-12-07': 'cancelled',
      '2026-12-09': 'cancelled',
      '2026-12-11': 'cancelled',
      K: 'done',
      C: 'done',
      L: 'done',
    });
  });

  it('forgives missed days in the progress of the chapter', () => {
    const tree = twoWeeks({ '2026-12-04': 'done' });
    const finished = buildTree(applyChanges([...tree.nodes.values()], applyFinishContract(tree, 'K', NOW)));

    expect(progress(tree, 'C')).toEqual({ done: 2, total: 6 });
    expect(progress(finished, 'C')).toEqual({ done: 2, total: 2 });
  });

  it('needs at least one completed day', () => {
    const tree = twoWeeks({ '2026-11-30': 'open' });

    expect(catchDomainError(() => applyFinishContract(tree, 'K', NOW)).code).toBe('invalid_transition');
  });

  it('rejects a quest that is not a contract and a contract in a paused branch', () => {
    const tree = makeTree(
      line('L', [quest('Q'), chapter('P', [contract('K', MWF, [day('2026-11-30', 'done')])], 'paused')]),
    );

    expect(catchDomainError(() => applyFinishContract(tree, 'Q', NOW)).code).toBe('invalid_transition');
    expect(catchDomainError(() => applyFinishContract(tree, 'K', NOW)).code).toBe('branch_locked');
  });

  it('does nothing for a contract that is already done', () => {
    const tree = makeTree(line('L', [contract('K', MWF, [day('2026-11-30', 'done')], 'done')], 'done'));

    expect(applyFinishContract(tree, 'K', NOW)).toEqual([]);
  });

  it('does not complete or reopen the contract itself', () => {
    const open = twoWeeks();
    const done = makeTree(line('L', [contract('K', MWF, [day('2026-11-30', 'done'), day('2026-12-02', 'cancelled')], 'done')], 'done'));

    expect(catchDomainError(() => applyComplete(open, 'K', NOW, { withChildren: true })).code).toBe(
      'invalid_transition',
    );
    expect(catchDomainError(() => applyReopen(done, 'K', NOW)).code).toBe('invalid_transition');
  });

  it('reopens the contract when a single day is reopened', () => {
    const done = makeTree(line('L', [contract('K', MWF, [day('2026-11-30', 'done'), day('2026-12-02', 'done')], 'done')], 'done'));

    expect(statuses(applyReopen(done, '2026-11-30', NOW))).toEqual({ '2026-11-30': 'open', K: 'open', L: 'open' });
  });
});

describe('changing the schedule (rule 6)', () => {
  it('removes future undone days that left the schedule and keeps past ones', () => {
    const plan = planSchedule(twoWeeks(), 'K', { ...MWF, weekdays: MON | FRI }, TODAY);

    expect(plan).toEqual({ add: [], remove: ['2026-12-09'], restore: [] });
  });

  it('adds the missing days when the term is extended', () => {
    const plan = planSchedule(twoWeeks(), 'K', { ...MWF, end: '2026-12-18' }, TODAY);

    expect(plan).toEqual({ add: ['2026-12-14', '2026-12-16', '2026-12-18'], remove: [], restore: [] });
  });

  it('keeps a completed day even when its weekday is dropped', () => {
    const plan = planSchedule(twoWeeks({ '2026-12-04': 'done' }), 'K', { ...MWF, weekdays: MON | WED }, TODAY);

    expect(plan).toEqual({ add: [], remove: ['2026-12-11'], restore: [] });
  });

  it('returns an empty plan for the same schedule', () => {
    expect(planSchedule(twoWeeks(), 'K', MWF, TODAY)).toEqual({ add: [], remove: [], restore: [] });
  });

  it('brings back future days cancelled by finishing and reopens the contract', () => {
    const finished = makeTree(
      line('L', [
        chapter('C', [
          contract('K', MWF, [
            day('2026-11-30', 'done'),
            day('2026-12-02', 'cancelled'),
            day('2026-12-04', 'done'),
            day('2026-12-07', 'cancelled'),
            day('2026-12-09', 'cancelled'),
            day('2026-12-11', 'cancelled'),
          ], 'done'),
        ], 'done'),
      ], 'done'),
    );
    const plan = planSchedule(finished, 'K', { ...MWF, end: '2026-12-14' }, TODAY);

    expect(plan).toEqual({ add: ['2026-12-14'], remove: [], restore: ['2026-12-07', '2026-12-09', '2026-12-11'] });
    expect(statuses(applySchedule(finished, 'K', plan, newDays('K', plan.add), NOW))).toEqual({
      '2026-12-07': 'open',
      '2026-12-09': 'open',
      '2026-12-11': 'open',
      K: 'open',
      C: 'open',
      L: 'open',
    });
  });

  it('leaves today’s and past cancelled days cancelled: only finishing could cancel a future day', () => {
    const tree = twoWeeks({ '2026-12-02': 'cancelled', '2026-12-04': 'cancelled' });

    expect(planSchedule(tree, 'K', MWF, TODAY)).toEqual({ add: [], remove: [], restore: [] });
  });

  it('completes the contract when only done days are left', () => {
    const tree = twoWeeks({ '2026-12-02': 'done', '2026-12-04': 'done' });
    const plan = planSchedule(tree, 'K', { ...MWF, end: TODAY }, TODAY);

    expect(plan).toEqual({ add: [], remove: ['2026-12-07', '2026-12-09', '2026-12-11'], restore: [] });
    expect(statuses(applySchedule(tree, 'K', plan, [], NOW))).toEqual({ K: 'done', C: 'done', L: 'done' });
  });

  it('rejects a new start for a running contract', () => {
    expect(catchDomainError(() => planSchedule(twoWeeks(), 'K', { ...MWF, start: '2026-12-07' }, TODAY)).code).toBe(
      'invalid_transition',
    );
  });

  it('moves the start of a contract that has not started yet, but not into the past', () => {
    const later: Schedule = { ...MWF, start: '2026-12-07' };
    const tree = makeTree(
      line('L', [contract('K', later, [day('2026-12-07'), day('2026-12-09'), day('2026-12-11')])]),
    );

    expect(planSchedule(tree, 'K', { ...later, start: '2026-12-09' }, TODAY)).toEqual({
      add: [],
      remove: ['2026-12-07'],
      restore: [],
    });
    expect(planSchedule(tree, 'K', { ...later, start: TODAY }, TODAY)).toEqual({
      add: [TODAY],
      remove: [],
      restore: [],
    });
    expect(catchDomainError(() => planSchedule(tree, 'K', { ...later, start: '2026-12-02' }, TODAY)).code).toBe(
      'invalid_transition',
    );
  });

  it('keeps the start of a contract that starts today: its first day has already come', () => {
    const tree = makeTree(line('L', [contract('K', { ...MWF, start: TODAY }, [day(TODAY), day('2026-12-07')])]));

    expect(
      catchDomainError(() => planSchedule(tree, 'K', { ...MWF, start: '2026-12-05' }, TODAY)).code,
    ).toBe('invalid_transition');
  });

  it('rejects a change that leaves no live days', () => {
    const tree = makeTree(line('L', [contract('K', { ...MWF, start: TODAY }, [day('2026-12-04'), day('2026-12-07')])]));

    expect(
      catchDomainError(() => planSchedule(tree, 'K', { weekdays: TUE, start: TODAY, end: TODAY }, TODAY)).code,
    ).toBe('invalid_transition');
  });
});

describe('removing the schedule (rule 7)', () => {
  it('is allowed without completed days and changes no statuses', () => {
    const tree = twoWeeks({ '2026-11-30': 'cancelled' });

    expect(applyRemoveSchedule(tree, 'K')).toEqual([]);
  });

  it('is not allowed once a day is completed', () => {
    expect(catchDomainError(() => applyRemoveSchedule(twoWeeks(), 'K')).code).toBe('invalid_transition');
  });

  it('rejects a quest that is not a contract', () => {
    const tree = makeTree(line('L', [quest('Q')]));

    expect(catchDomainError(() => applyRemoveSchedule(tree, 'Q')).code).toBe('invalid_transition');
  });
});

describe('a contract in a paused branch (rule 9)', () => {
  it('locks its days without changing statuses', () => {
    const tree = makeTree(line('L', [chapter('P', [contract('K', MWF, [day('2026-11-30'), day('2026-12-02')])], 'paused')]));

    expect(catchDomainError(() => applyComplete(tree, '2026-11-30', NOW, { today: TODAY })).code).toBe('branch_locked');
  });
});

describe('defaultTerm: the term offered when a quest becomes a contract (rule 1)', () => {
  const withDeadlines = (chapterDeadline: string | null, lineDeadline: string | null) =>
    buildTree([
      makeNode({ id: 'L', parentId: null, kind: 'line', deadline: lineDeadline }),
      makeNode({ id: 'C', parentId: 'L', kind: 'chapter', deadline: chapterDeadline }),
      makeNode({ id: 'Q', parentId: 'C', kind: 'quest' }),
      makeNode({ id: 'Direct', parentId: 'L', kind: 'quest' }),
    ]);

  it('starts today and ends at the chapter deadline', () => {
    expect(defaultTerm(withDeadlines('2026-12-31', '2027-05-01'), 'Q', TODAY)).toEqual({
      start: TODAY,
      end: '2026-12-31',
    });
  });

  it('falls back to the goal deadline when the chapter has none, and for a quest right in the goal', () => {
    const tree = withDeadlines(null, '2027-05-01');

    expect(defaultTerm(tree, 'Q', TODAY)).toEqual({ start: TODAY, end: '2027-05-01' });
    expect(defaultTerm(tree, 'Direct', TODAY)).toEqual({ start: TODAY, end: '2027-05-01' });
  });

  it('leaves the end to the user without a deadline', () => {
    expect(defaultTerm(withDeadlines(null, null), 'Q', TODAY)).toEqual({ start: TODAY, end: null });
  });

  it('leaves the end to the user when the chapter deadline has passed, without falling back to the goal', () => {
    expect(defaultTerm(withDeadlines('2026-12-03', '2027-05-01'), 'Q', TODAY)).toEqual({ start: TODAY, end: null });
  });

  it('accepts a deadline today and one 366 days ahead, but not further', () => {
    expect(defaultTerm(withDeadlines(TODAY, null), 'Q', TODAY).end).toBe(TODAY);
    expect(defaultTerm(withDeadlines('2027-12-04', null), 'Q', TODAY).end).toBe('2027-12-04');
    expect(defaultTerm(withDeadlines('2027-12-05', null), 'Q', TODAY).end).toBeNull();
  });
});
