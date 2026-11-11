import { describe, expect, it } from 'vitest';
import { canBeActive, isBranchLocked, nextOpenChild, nextQuest, suggestQuests } from './active-quest';
import { chapter, line, makeTree, quest, step } from './testing';

describe('canBeActive', () => {
  const tree = makeTree(
    line('L', [
      chapter('C', [quest('Open', [step('S')]), quest('Done', [], 'done'), quest('Cancelled', [], 'cancelled')]),
      chapter('Paused', [quest('InPaused')], 'paused'),
      chapter('CancelledChapter', [quest('InCancelled')], 'cancelled'),
      quest('Direct'),
    ]),
  );

  it('accepts an open quest whose ancestors are all open', () => {
    expect(canBeActive(tree, 'Open')).toBe(true);
    expect(canBeActive(tree, 'Direct')).toBe(true);
  });

  it('rejects a done or cancelled quest', () => {
    expect(canBeActive(tree, 'Done')).toBe(false);
    expect(canBeActive(tree, 'Cancelled')).toBe(false);
  });

  it('rejects a quest inside a paused or cancelled branch', () => {
    expect(canBeActive(tree, 'InPaused')).toBe(false);
    expect(canBeActive(tree, 'InCancelled')).toBe(false);
  });

  it('rejects a quest of a paused line', () => {
    const pausedLine = makeTree(line('L', [quest('Q')], 'paused'));

    expect(canBeActive(pausedLine, 'Q')).toBe(false);
  });

  it('rejects anything that is not a quest', () => {
    expect(canBeActive(tree, 'L')).toBe(false);
    expect(canBeActive(tree, 'C')).toBe(false);
    expect(canBeActive(tree, 'S')).toBe(false);
  });

  it('rejects an id that is not in the tree, e.g. a deleted quest', () => {
    expect(canBeActive(tree, 'missing')).toBe(false);
  });
});

describe('isBranchLocked', () => {
  const tree = makeTree(
    line('L', [chapter('Paused', [quest('InPaused')], 'paused'), quest('Cancelled', [step('InCancelled')], 'cancelled'), quest('Q')]),
  );

  it('is true when an ancestor is paused or cancelled', () => {
    expect(isBranchLocked(tree, 'InPaused')).toBe(true);
    expect(isBranchLocked(tree, 'InCancelled')).toBe(true);
  });

  it('is true when the locked ancestor is higher than the parent', () => {
    const deep = makeTree(line('L', [chapter('C', [quest('Q', [step('S')])], 'paused')]));

    expect(isBranchLocked(deep, 'S')).toBe(true);
  });

  it('ignores the status of the node itself', () => {
    expect(isBranchLocked(tree, 'Paused')).toBe(false);
    expect(isBranchLocked(tree, 'Cancelled')).toBe(false);
    expect(isBranchLocked(tree, 'Q')).toBe(false);
  });
});

describe('nextOpenChild', () => {
  it('returns the first open child by order, skipping done and cancelled ones', () => {
    const tree = makeTree(line('L', [quest('Q', [step('S1', 'done'), step('S2', 'cancelled'), step('S3'), step('S4')])]));

    expect(nextOpenChild(tree, 'Q')).toBe('S3');
  });

  it('returns null when every child is done or cancelled', () => {
    const tree = makeTree(line('L', [quest('Q', [step('S1', 'done'), step('S2', 'cancelled')])]));

    expect(nextOpenChild(tree, 'Q')).toBeNull();
  });

  it('returns null for a node without children', () => {
    const tree = makeTree(line('L', [quest('Q')]));

    expect(nextOpenChild(tree, 'Q')).toBeNull();
  });
});

describe('nextQuest', () => {
  it('suggests the next open quest of the same chapter by order', () => {
    const tree = makeTree(line('L', [chapter('C', [quest('Current', [], 'done'), quest('Q2', [], 'done'), quest('Q3'), quest('Q4')])]));

    expect(nextQuest(tree, 'Current')).toBe('Q3');
  });

  it('then the first open quest of the following chapters', () => {
    const tree = makeTree(
      line('L', [
        chapter('C1', [quest('Current', [], 'done')]),
        chapter('C2', [quest('Q2', [], 'done')]),
        chapter('C3', [quest('Q3'), quest('Q4')]),
      ]),
    );

    expect(nextQuest(tree, 'Current')).toBe('Q3');
  });

  it('skips paused and cancelled chapters and cancelled quests', () => {
    const tree = makeTree(
      line('L', [
        chapter('C1', [quest('Current', [], 'done'), quest('Cancelled', [], 'cancelled')]),
        chapter('C2', [quest('InPaused')], 'paused'),
        chapter('C3', [quest('InCancelled')], 'cancelled'),
        chapter('C4', [quest('Q4')]),
      ]),
    );

    expect(nextQuest(tree, 'Current')).toBe('Q4');
  });

  it('then the quests placed directly in the line, even if they come before the chapters', () => {
    const tree = makeTree(line('L', [quest('Direct'), chapter('C1', [quest('Current', [], 'done')]), chapter('C2', [quest('Q2')])]));

    expect(nextQuest(tree, 'Current')).toBe('Q2');
    expect(nextQuest(makeTree(line('L', [quest('Direct'), chapter('C1', [quest('Current', [], 'done')])])), 'Current')).toBe(
      'Direct',
    );
  });

  it('wraps around to earlier quests of the same chapter and earlier chapters', () => {
    const sameChapter = makeTree(line('L', [chapter('C', [quest('Earlier'), quest('Current', [], 'done')])]));
    const earlierChapter = makeTree(line('L', [chapter('C1', [quest('Earlier')]), chapter('C2', [quest('Current', [], 'done')])]));

    expect(nextQuest(sameChapter, 'Current')).toBe('Earlier');
    expect(nextQuest(earlierChapter, 'Current')).toBe('Earlier');
  });

  it('for a quest placed directly in the line: the next direct quest, then chapters from the start', () => {
    const tree = makeTree(line('L', [chapter('C1', [quest('InChapter')]), quest('Current', [], 'done'), quest('Next')]));
    const lastDirect = makeTree(line('L', [chapter('C1', [quest('InChapter')]), quest('Current', [], 'done')]));

    expect(nextQuest(tree, 'Current')).toBe('Next');
    expect(nextQuest(lastDirect, 'Current')).toBe('InChapter');
  });

  it('never suggests the quest itself and returns null when nothing else is open', () => {
    const tree = makeTree(line('L', [chapter('C', [quest('Current'), quest('Q2', [], 'done')])]));

    expect(nextQuest(tree, 'Current')).toBeNull();
  });

  it('returns null for an id that is not in the tree, e.g. a deleted quest', () => {
    const tree = makeTree(line('L', [quest('Q')]));

    expect(nextQuest(tree, 'missing')).toBeNull();
  });

  it('works for a quest inside a paused chapter: the suggestion comes from elsewhere', () => {
    const tree = makeTree(line('L', [chapter('C1', [quest('Current'), quest('Sibling')], 'paused'), chapter('C2', [quest('Q2')])]));

    expect(nextQuest(tree, 'Current')).toBe('Q2');
  });
});

describe('suggestQuests', () => {
  it('takes the first open quest of each line, in the given order of lines', () => {
    const lines = [
      makeTree(line('A', [quest('A1'), quest('A2')])),
      makeTree(line('B', [quest('B1')])),
      makeTree(line('C', [quest('C1')])),
      makeTree(line('D', [quest('D1')])),
    ];

    expect(suggestQuests(lines, 3)).toEqual(['A1', 'B1', 'C1']);
  });

  it('fills the remaining places with the following quests of the same lines, line by line', () => {
    const lines = [makeTree(line('A', [quest('A1'), quest('A2'), quest('A3')])), makeTree(line('B', [quest('B1'), quest('B2')]))];

    expect(suggestQuests(lines, 3)).toEqual(['A1', 'B1', 'A2']);
    expect(suggestQuests(lines, 5)).toEqual(['A1', 'B1', 'A2', 'B2', 'A3']);
  });

  it('orders quests of a line like nextQuest: chapters first, then quests placed directly in the line', () => {
    const lines = [makeTree(line('L', [quest('Direct'), chapter('C1', [quest('Q1')]), chapter('C2', [quest('Q2')])]))];

    expect(suggestQuests(lines, 3)).toEqual(['Q1', 'Q2', 'Direct']);
  });

  it('suggests only quests that can be active', () => {
    const lines = [
      makeTree(
        line('L', [
          chapter('C1', [quest('Done', [], 'done'), quest('Cancelled', [], 'cancelled'), quest('Open')]),
          chapter('Paused', [quest('InPaused')], 'paused'),
          chapter('CancelledChapter', [quest('InCancelled')], 'cancelled'),
        ]),
      ),
      makeTree(line('PausedLine', [quest('InPausedLine')], 'paused')),
    ];

    expect(suggestQuests(lines, 3)).toEqual(['Open']);
  });

  it('skips lines without open quests and returns an empty list when there is nothing to suggest', () => {
    const lines = [makeTree(line('Empty')), makeTree(line('AllDone', [quest('Q', [], 'done')], 'done')), makeTree(line('B', [quest('B1')]))];

    expect(suggestQuests(lines, 3)).toEqual(['B1']);
    expect(suggestQuests([makeTree(line('Empty'))], 3)).toEqual([]);
    expect(suggestQuests([], 3)).toEqual([]);
  });
});
