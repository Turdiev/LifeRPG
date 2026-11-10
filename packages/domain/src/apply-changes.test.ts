import { describe, expect, it } from 'vitest';
import { applyChanges } from './apply-changes';
import { line, makeNodes, NOW, quest, step } from './testing';

describe('applyChanges', () => {
  it('replaces status and completedAt of the changed nodes and keeps the rest as is', () => {
    const nodes = makeNodes(line('L', [quest('Q', [step('S1'), step('S2')])]));

    const result = applyChanges(nodes, [{ id: 'S1', status: 'done', completedAt: NOW }]);

    expect(result.find((n) => n.id === 'S1')).toMatchObject({ status: 'done', completedAt: NOW, title: 'S1' });
    expect(result.find((n) => n.id === 'S2')).toBe(nodes.find((n) => n.id === 'S2'));
  });

  it('does not mutate the input', () => {
    const nodes = makeNodes(line('L', [quest('Q')]));

    applyChanges(nodes, [{ id: 'Q', status: 'done', completedAt: NOW }]);

    expect(nodes.find((n) => n.id === 'Q')?.status).toBe('open');
  });
});
