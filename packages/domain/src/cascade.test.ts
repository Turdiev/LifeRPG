import { describe, expect, it } from 'vitest';
import {
  applyAddChild,
  applyCancel,
  applyComplete,
  applyDelete,
  applyPause,
  applyReopen,
  applyRestore,
  applyResume,
} from './cascade';
import { byId, catchDomainError, chapter, line, makeNode, makeTree, NOW, quest, statuses, step } from './testing';
import type { QuestKind } from './types';

describe('applyComplete', () => {
  it('completes the last open step and every ancestor whose children are now all done (rule 1)', () => {
    const tree = makeTree(line('L', [chapter('C', [quest('Q', [step('S1', 'done'), step('S2')])])]));

    expect(byId(applyComplete(tree, 'S2', NOW))).toEqual({
      S2: { id: 'S2', status: 'done', completedAt: NOW },
      Q: { id: 'Q', status: 'done', completedAt: NOW },
      C: { id: 'C', status: 'done', completedAt: NOW },
      L: { id: 'L', status: 'done', completedAt: NOW },
    });
  });

  it('leaves the parent open while other steps are open', () => {
    const tree = makeTree(line('L', [quest('Q', [step('S1'), step('S2')])]));

    expect(statuses(applyComplete(tree, 'S1', NOW))).toEqual({ S1: 'done' });
  });

  it('stops bubbling at the first ancestor with open children', () => {
    const tree = makeTree(line('L', [chapter('C1', [quest('Q1', [step('S1')])]), chapter('C2', [quest('Q2')])]));

    expect(statuses(applyComplete(tree, 'S1', NOW))).toEqual({ S1: 'done', Q1: 'done', C1: 'done' });
  });

  it('ignores cancelled siblings when deciding whether the parent is done', () => {
    const tree = makeTree(line('L', [quest('Q', [step('S1'), step('S2', 'cancelled')]), quest('Q2', [], 'done')]));

    expect(statuses(applyComplete(tree, 'S1', NOW))).toEqual({ S1: 'done', Q: 'done', L: 'done' });
  });

  it('does not complete a line while one of its chapters is paused', () => {
    const tree = makeTree(line('L', [chapter('C1', [quest('Q1')]), chapter('C2', [quest('Q2', [], 'done')], 'paused')]));

    expect(statuses(applyComplete(tree, 'Q1', NOW))).toEqual({ Q1: 'done', C1: 'done' });
  });

  it('completes a quest without steps directly', () => {
    const tree = makeTree(line('L', [quest('Q1'), quest('Q2')]));

    expect(statuses(applyComplete(tree, 'Q1', NOW))).toEqual({ Q1: 'done' });
  });

  it('rejects completing a quest with open steps without withChildren (rule 3)', () => {
    const tree = makeTree(line('L', [quest('Q', [step('S1', 'done'), step('S2')])]));

    expect(catchDomainError(() => applyComplete(tree, 'Q', NOW)).code).toBe('has_open_children');
  });

  it('with withChildren closes all open steps, leaving cancelled ones as they are (rule 3)', () => {
    const tree = makeTree(line('L', [quest('Q', [step('S1'), step('S2', 'done'), step('S3', 'cancelled'), step('S4')])]));

    expect(statuses(applyComplete(tree, 'Q', NOW, { withChildren: true }))).toEqual({
      S1: 'done',
      S4: 'done',
      Q: 'done',
      L: 'done',
    });
  });

  it('lets an empty chapter be completed manually', () => {
    const tree = makeTree(line('L', [chapter('C')]));

    expect(statuses(applyComplete(tree, 'C', NOW))).toEqual({ C: 'done', L: 'done' });
  });

  it('lets an empty line be completed manually', () => {
    const tree = makeTree(line('L'));

    expect(statuses(applyComplete(tree, 'L', NOW))).toEqual({ L: 'done' });
  });

  it('rejects completing a non-empty chapter or line: containers complete from their children', () => {
    const tree = makeTree(line('L', [chapter('C', [quest('Q')])]));

    expect(catchDomainError(() => applyComplete(tree, 'C', NOW)).code).toBe('invalid_transition');
    expect(catchDomainError(() => applyComplete(tree, 'L', NOW)).code).toBe('invalid_transition');
  });

  it('is idempotent: completing a done node changes nothing', () => {
    const tree = makeTree(line('L', [quest('Q', [step('S1', 'done'), step('S2')])]));

    expect(applyComplete(tree, 'S1', NOW)).toEqual([]);
  });

  it('rejects changes inside a paused or cancelled branch', () => {
    const tree = makeTree(
      line('L', [
        chapter('Paused', [quest('Q1', [step('S1')])], 'paused'),
        chapter('C', [quest('Cancelled', [step('S2')], 'cancelled'), quest('Q3', [step('S3', 'cancelled')])]),
      ]),
    );

    expect(catchDomainError(() => applyComplete(tree, 'S1', NOW)).code).toBe('branch_locked');
    expect(catchDomainError(() => applyComplete(tree, 'S2', NOW)).code).toBe('branch_locked');
    expect(catchDomainError(() => applyComplete(tree, 'S3', NOW)).code).toBe('branch_locked');
  });

  it('rejects completing a paused chapter itself', () => {
    const tree = makeTree(line('L', [chapter('C', [], 'paused')]));

    expect(catchDomainError(() => applyComplete(tree, 'C', NOW)).code).toBe('branch_locked');
  });
});

describe('applyReopen', () => {
  it('reopens the step and every done ancestor (rule 2)', () => {
    const tree = makeTree(
      line('L', [chapter('C', [quest('Q', [step('S1', 'done'), step('S2', 'done')], 'done')], 'done')], 'done'),
    );

    expect(byId(applyReopen(tree, 'S2', NOW))).toEqual({
      S2: { id: 'S2', status: 'open', completedAt: null },
      Q: { id: 'Q', status: 'open', completedAt: null },
      C: { id: 'C', status: 'open', completedAt: null },
      L: { id: 'L', status: 'open', completedAt: null },
    });
  });

  it('reopening a done quest reopens its done steps too, so it does not complete again at once', () => {
    const tree = makeTree(
      line('L', [quest('Q', [step('S1', 'done'), step('S2', 'done'), step('S3', 'cancelled')], 'done'), quest('Q2')]),
    );

    expect(statuses(applyReopen(tree, 'Q', NOW))).toEqual({ Q: 'open', S1: 'open', S2: 'open' });
  });

  it('reopening a manually completed empty chapter changes only it and its ancestors', () => {
    const tree = makeTree(line('L', [chapter('C', [], 'done')], 'done'));

    expect(statuses(applyReopen(tree, 'C', NOW))).toEqual({ C: 'open', L: 'open' });
  });

  it('is idempotent: reopening an open node changes nothing', () => {
    const tree = makeTree(line('L', [quest('Q', [step('S1')])]));

    expect(applyReopen(tree, 'S1', NOW)).toEqual([]);
  });

  it('rejects changes inside a paused branch', () => {
    const tree = makeTree(line('L', [chapter('C', [quest('Q', [step('S1', 'done')])], 'paused')]));

    expect(catchDomainError(() => applyReopen(tree, 'S1', NOW)).code).toBe('branch_locked');
  });

  it('rejects reopening a cancelled node itself: it is restored, not reopened', () => {
    const tree = makeTree(line('L', [quest('Q', [step('S1', 'cancelled')])]));

    expect(catchDomainError(() => applyReopen(tree, 'S1', NOW)).code).toBe('branch_locked');
  });
});

describe('applyAddChild', () => {
  it('reopens a done parent and its done ancestors (rule 2)', () => {
    const tree = makeTree(line('L', [chapter('C', [quest('Q', [step('S1', 'done')], 'done')], 'done')], 'done'));
    const node = makeNode({ id: 'S2', parentId: 'Q', kind: 'step', position: 'a9' });

    expect(statuses(applyAddChild(tree, node, NOW))).toEqual({ Q: 'open', C: 'open', L: 'open' });
  });

  it('changes nothing when the parent is open', () => {
    const tree = makeTree(line('L', [quest('Q', [step('S1')])]));
    const node = makeNode({ id: 'S2', parentId: 'Q', kind: 'step', position: 'a9' });

    expect(applyAddChild(tree, node, NOW)).toEqual([]);
  });

  it.each<[QuestKind, QuestKind]>([
    ['line', 'step'],
    ['line', 'line'],
    ['chapter', 'chapter'],
    ['chapter', 'step'],
    ['quest', 'quest'],
    ['quest', 'chapter'],
    ['step', 'step'],
  ])('rejects a %s → %s nesting', (parentKind, childKind) => {
    const tree = makeTree(
      line('L', [chapter('chapter', [quest('quest', [step('step')])])]),
    );
    const parentId = parentKind === 'line' ? 'L' : parentKind;
    const node = makeNode({ id: 'new', parentId, kind: childKind, position: 'a9' });

    expect(catchDomainError(() => applyAddChild(tree, node, NOW)).code).toBe('invalid_parent');
  });

  it.each<[QuestKind, QuestKind, string]>([
    ['line', 'chapter', 'L'],
    ['line', 'quest', 'L'],
    ['chapter', 'quest', 'C'],
    ['quest', 'step', 'Q'],
  ])('allows a %s → %s nesting', (_parentKind, childKind, parentId) => {
    const tree = makeTree(line('L', [chapter('C', [quest('Q')])]));
    const node = makeNode({ id: 'new', parentId, kind: childKind, position: 'a9' });

    expect(applyAddChild(tree, node, NOW)).toEqual([]);
  });

  it('rejects adding into a paused chapter or under a cancelled one', () => {
    const tree = makeTree(
      line('L', [chapter('Paused', [quest('Q1')], 'paused'), chapter('Cancelled', [quest('Q2')], 'cancelled')]),
    );

    const intoPaused = makeNode({ id: 'new1', parentId: 'Paused', kind: 'quest', position: 'a9' });
    const underCancelled = makeNode({ id: 'new2', parentId: 'Q2', kind: 'step', position: 'a9' });

    expect(catchDomainError(() => applyAddChild(tree, intoPaused, NOW)).code).toBe('branch_locked');
    expect(catchDomainError(() => applyAddChild(tree, underCancelled, NOW)).code).toBe('branch_locked');
  });

  it('rejects adding directly into a cancelled quest', () => {
    const tree = makeTree(line('L', [quest('Q', [], 'cancelled')]));
    const node = makeNode({ id: 'new', parentId: 'Q', kind: 'step', position: 'a9' });

    expect(catchDomainError(() => applyAddChild(tree, node, NOW)).code).toBe('branch_locked');
  });
});

describe('applyPause / applyResume', () => {
  it('pausing a chapter does not change its descendants (rule 4)', () => {
    const tree = makeTree(line('L', [chapter('C', [quest('Q', [step('S1', 'done'), step('S2')])]), chapter('C2')]));

    expect(statuses(applyPause(tree, 'C', NOW))).toEqual({ C: 'paused' });
  });

  it('pausing a done chapter reopens its done line: a paused chapter is not done', () => {
    const tree = makeTree(line('L', [chapter('C1', [quest('Q1', [], 'done')], 'done'), chapter('C2', [quest('Q2', [], 'done')], 'done')], 'done'));

    expect(statuses(applyPause(tree, 'C2', NOW))).toEqual({ C2: 'paused', L: 'open' });
  });

  it('pauses a whole line', () => {
    const tree = makeTree(line('L', [quest('Q')]));

    expect(statuses(applyPause(tree, 'L', NOW))).toEqual({ L: 'paused' });
  });

  it('rejects pausing a quest or a step', () => {
    const tree = makeTree(line('L', [quest('Q', [step('S')])]));

    expect(catchDomainError(() => applyPause(tree, 'Q', NOW)).code).toBe('invalid_transition');
    expect(catchDomainError(() => applyPause(tree, 'S', NOW)).code).toBe('invalid_transition');
  });

  it('rejects pausing a quest inside a paused chapter as a locked branch', () => {
    const tree = makeTree(line('L', [chapter('C', [quest('Q')], 'paused')]));

    expect(catchDomainError(() => applyPause(tree, 'Q', NOW)).code).toBe('branch_locked');
  });

  it('rejects pausing a cancelled chapter', () => {
    const tree = makeTree(line('L', [chapter('C', [], 'cancelled')]));

    expect(catchDomainError(() => applyPause(tree, 'C', NOW)).code).toBe('invalid_transition');
  });

  it('is idempotent: pausing a paused chapter changes nothing', () => {
    const tree = makeTree(line('L', [chapter('C', [], 'paused')]));

    expect(applyPause(tree, 'C', NOW)).toEqual([]);
  });

  it('rejects pausing a chapter inside a paused line', () => {
    const tree = makeTree(line('L', [chapter('C')], 'paused'));

    expect(catchDomainError(() => applyPause(tree, 'C', NOW)).code).toBe('branch_locked');
  });

  it('resuming returns an unfinished chapter to open', () => {
    const tree = makeTree(line('L', [chapter('C', [quest('Q1', [], 'done'), quest('Q2')], 'paused')]));

    expect(statuses(applyResume(tree, 'C', NOW))).toEqual({ C: 'open' });
  });

  it('resuming returns everything as it was: a chapter with all children done becomes done again', () => {
    const tree = makeTree(
      line('L', [chapter('C1', [quest('Q1', [], 'done')], 'done'), chapter('C2', [quest('Q2', [], 'done')], 'paused')]),
    );

    expect(byId(applyResume(tree, 'C2', NOW))).toEqual({
      C2: { id: 'C2', status: 'done', completedAt: NOW },
      L: { id: 'L', status: 'done', completedAt: NOW },
    });
  });

  it('is idempotent: resuming an open chapter changes nothing', () => {
    const tree = makeTree(line('L', [chapter('C')]));

    expect(applyResume(tree, 'C', NOW)).toEqual([]);
  });

  it('rejects resuming a cancelled chapter', () => {
    const tree = makeTree(line('L', [chapter('C', [], 'cancelled')]));

    expect(catchDomainError(() => applyResume(tree, 'C', NOW)).code).toBe('invalid_transition');
  });

  it('rejects resuming a chapter inside a paused line', () => {
    const tree = makeTree(line('L', [chapter('C', [], 'paused')], 'paused'));

    expect(catchDomainError(() => applyResume(tree, 'C', NOW)).code).toBe('branch_locked');
  });
});

describe('applyCancel / applyRestore', () => {
  it('cancelling the last open step removes it from progress and completes the quest (rule 5)', () => {
    const tree = makeTree(line('L', [quest('Q', [step('S1', 'done'), step('S2')]), quest('Q2', [], 'done')]));

    expect(statuses(applyCancel(tree, 'S2', NOW))).toEqual({ S2: 'cancelled', Q: 'done', L: 'done' });
  });

  it('does not change the descendants of a cancelled node', () => {
    const tree = makeTree(line('L', [chapter('C', [quest('Q', [step('S1', 'done'), step('S2')])]), chapter('C2')]));

    expect(statuses(applyCancel(tree, 'C', NOW))).toEqual({ C: 'cancelled' });
  });

  it('reopens a done container once all its children are cancelled', () => {
    const tree = makeTree(line('L', [quest('Q', [step('S1', 'done')], 'done'), quest('Q2')]));

    expect(statuses(applyCancel(tree, 'S1', NOW))).toEqual({ S1: 'cancelled', Q: 'open' });
  });

  it('cancels a paused chapter', () => {
    const tree = makeTree(line('L', [chapter('C', [], 'paused'), chapter('C2')]));

    expect(statuses(applyCancel(tree, 'C', NOW))).toEqual({ C: 'cancelled' });
  });

  it('cancels a whole line', () => {
    const tree = makeTree(line('L', [quest('Q')]));

    expect(statuses(applyCancel(tree, 'L', NOW))).toEqual({ L: 'cancelled' });
  });

  it('is idempotent: cancelling a cancelled node changes nothing', () => {
    const tree = makeTree(line('L', [quest('Q', [], 'cancelled')]));

    expect(applyCancel(tree, 'Q', NOW)).toEqual([]);
  });

  it('rejects cancelling inside a cancelled branch', () => {
    const tree = makeTree(line('L', [quest('Q', [step('S')], 'cancelled')]));

    expect(catchDomainError(() => applyCancel(tree, 'S', NOW)).code).toBe('branch_locked');
  });

  it('restoring a step brings it back as open and reopens the done quest (rule 5)', () => {
    const tree = makeTree(line('L', [quest('Q', [step('S1', 'done'), step('S2', 'cancelled')], 'done')], 'done'));

    expect(statuses(applyRestore(tree, 'S2', NOW))).toEqual({ S2: 'open', Q: 'open', L: 'open' });
  });

  it('restoring a chapter whose children are all done brings it back as done', () => {
    const tree = makeTree(
      line('L', [chapter('C1', [quest('Q1', [], 'done')], 'done'), chapter('C2', [quest('Q2', [], 'done')], 'cancelled')], 'done'),
    );

    expect(applyRestore(tree, 'C2', NOW)).toEqual([{ id: 'C2', status: 'done', completedAt: NOW }]);
  });

  it('restoring an unfinished branch reopens the done parent', () => {
    const tree = makeTree(
      line('L', [chapter('C1', [quest('Q1', [], 'done')], 'done'), chapter('C2', [quest('Q2')], 'cancelled')], 'done'),
    );

    expect(statuses(applyRestore(tree, 'C2', NOW))).toEqual({ C2: 'open', L: 'open' });
  });

  it('is idempotent: restoring a node that is not cancelled changes nothing', () => {
    const tree = makeTree(line('L', [quest('Q')]));

    expect(applyRestore(tree, 'Q', NOW)).toEqual([]);
  });

  it('rejects restoring a step inside a cancelled quest', () => {
    const tree = makeTree(line('L', [quest('Q', [step('S', 'cancelled')], 'cancelled')]));

    expect(catchDomainError(() => applyRestore(tree, 'S', NOW)).code).toBe('branch_locked');
  });
});

describe('applyDelete', () => {
  it('deleting the last open step completes the quest and its ancestors (rule 6)', () => {
    const tree = makeTree(line('L', [quest('Q', [step('S1', 'done'), step('S2')])]));

    expect(statuses(applyDelete(tree, 'S2', NOW))).toEqual({ Q: 'done', L: 'done' });
  });

  it('deleting a done step leaves an unfinished quest open', () => {
    const tree = makeTree(line('L', [quest('Q', [step('S1', 'done'), step('S2')])]));

    expect(applyDelete(tree, 'S1', NOW)).toEqual([]);
  });

  it('never reports the deleted node or its descendants', () => {
    const tree = makeTree(line('L', [chapter('C1', [quest('Q1', [], 'done')], 'done'), chapter('C2', [quest('Q2', [step('S')])])]));

    expect(statuses(applyDelete(tree, 'C2', NOW))).toEqual({ L: 'done' });
  });

  it('reopens a done container left without children', () => {
    const tree = makeTree(line('L', [quest('Q', [step('S1', 'done')], 'done'), quest('Q2')]));

    expect(statuses(applyDelete(tree, 'S1', NOW))).toEqual({ Q: 'open' });
  });

  it('is allowed inside a paused branch and does not touch the paused node', () => {
    const tree = makeTree(line('L', [chapter('C', [quest('Q', [step('S1', 'done'), step('S2')])], 'paused')]));

    expect(statuses(applyDelete(tree, 'S2', NOW))).toEqual({ Q: 'done' });
  });

  it('deleting a whole line changes nothing else', () => {
    const tree = makeTree(line('L', [quest('Q')]));

    expect(applyDelete(tree, 'L', NOW)).toEqual([]);
  });
});
