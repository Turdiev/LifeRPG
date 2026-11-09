import { describe, expect, it } from 'vitest';
import { progress } from './progress';
import { chapter, line, makeTree, quest, step } from './testing';

describe('progress', () => {
  it('counts done leaves over all leaves of the subtree (PRD example: 6 of 12 steps → 50%)', () => {
    const fourSteps = (prefix: string, done: number) =>
      [0, 1, 2, 3].map((i) => step(`${prefix}${i}`, i < done ? 'done' : 'open'));
    const tree = makeTree(
      line('L', [
        chapter('C', [quest('Q1', fourSteps('a', 4)), quest('Q2', fourSteps('b', 2)), quest('Q3', fourSteps('c', 0))]),
      ]),
    );

    expect(progress(tree, 'C')).toEqual({ done: 6, total: 12 });
    expect(progress(tree, 'L')).toEqual({ done: 6, total: 12 });
    expect(progress(tree, 'Q2')).toEqual({ done: 2, total: 4 });
  });

  it('treats a quest without steps as a leaf', () => {
    const tree = makeTree(line('L', [quest('Q1', [], 'done'), quest('Q2', [step('S1'), step('S2', 'done')])]));

    expect(progress(tree, 'L')).toEqual({ done: 2, total: 3 });
    expect(progress(tree, 'Q1')).toEqual({ done: 1, total: 1 });
  });

  it('treats a quest whose steps are all cancelled as a leaf', () => {
    const tree = makeTree(line('L', [quest('Q1', [step('S1', 'cancelled')], 'done'), quest('Q2', [step('S2')])]));

    expect(progress(tree, 'Q1')).toEqual({ done: 1, total: 1 });
    expect(progress(tree, 'L')).toEqual({ done: 1, total: 2 });
  });

  it('a step is a leaf of itself', () => {
    const tree = makeTree(line('L', [quest('Q', [step('S', 'done')])]));

    expect(progress(tree, 'S')).toEqual({ done: 1, total: 1 });
  });

  it('excludes cancelled branches entirely', () => {
    const tree = makeTree(
      line('L', [
        chapter('C1', [quest('Q1', [step('S1', 'done'), step('S2', 'cancelled')])]),
        chapter('C2', [quest('Q2', [step('S3', 'done'), step('S4')])], 'cancelled'),
      ]),
    );

    expect(progress(tree, 'L')).toEqual({ done: 1, total: 1 });
  });

  it('counts leaves of paused branches', () => {
    const tree = makeTree(line('L', [chapter('C', [quest('Q', [step('S1', 'done'), step('S2')])], 'paused')]));

    expect(progress(tree, 'L')).toEqual({ done: 1, total: 2 });
  });

  it('shows 0 of 0 for an empty container, even a manually completed one', () => {
    const tree = makeTree(line('L', [chapter('Empty'), chapter('Done', [], 'done')]));

    expect(progress(tree, 'Empty')).toEqual({ done: 0, total: 0 });
    expect(progress(tree, 'Done')).toEqual({ done: 0, total: 0 });
    expect(progress(tree, 'L')).toEqual({ done: 0, total: 0 });
  });

  it('shows the progress of a cancelled node itself, ignoring only its cancelled descendants', () => {
    const tree = makeTree(line('L', [quest('Q', [step('S1', 'done'), step('S2'), step('S3', 'cancelled')], 'cancelled')]));

    expect(progress(tree, 'Q')).toEqual({ done: 1, total: 2 });
  });
});
