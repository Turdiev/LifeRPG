import { describe, expect, it } from 'vitest';
import { makeNode } from './testing';
import { buildTree } from './tree';

describe('buildTree', () => {
  it('indexes every node by id', () => {
    const tree = buildTree([
      makeNode({ id: 'L', parentId: null, kind: 'line' }),
      makeNode({ id: 'Q', parentId: 'L', kind: 'quest' }),
    ]);

    expect([...tree.nodes.keys()]).toEqual(['L', 'Q']);
  });

  it('orders siblings by position regardless of input order', () => {
    const tree = buildTree([
      makeNode({ id: 'L', parentId: null, kind: 'line' }),
      makeNode({ id: 'second', parentId: 'L', kind: 'quest', position: 'a1' }),
      makeNode({ id: 'first', parentId: 'L', kind: 'quest', position: 'a0' }),
      makeNode({ id: 'third', parentId: 'L', kind: 'quest', position: 'a2' }),
    ]);

    expect(tree.children.get('L')?.map((n) => n.id)).toEqual(['first', 'second', 'third']);
  });

  it('compares positions bytewise like COLLATE "C", not by locale', () => {
    // Ключи fractional-indexing смешивают регистры: побайтово 'Z' (0x5A) < 'a' (0x61),
    // а сравнение с учётом локали ставит 'a' первым.
    const tree = buildTree([
      makeNode({ id: 'L', parentId: null, kind: 'line' }),
      makeNode({ id: 'lower', parentId: 'L', kind: 'quest', position: 'a0' }),
      makeNode({ id: 'upper', parentId: 'L', kind: 'quest', position: 'Zz' }),
    ]);

    expect(tree.children.get('L')?.map((n) => n.id)).toEqual(['upper', 'lower']);
  });

  it('has no children entry for leaves', () => {
    const tree = buildTree([
      makeNode({ id: 'L', parentId: null, kind: 'line' }),
      makeNode({ id: 'Q', parentId: 'L', kind: 'quest' }),
    ]);

    expect(tree.children.has('Q')).toBe(false);
  });
});
