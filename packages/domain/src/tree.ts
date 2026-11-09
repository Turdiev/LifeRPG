import type { QuestNode, Tree } from './types';

export function buildTree(nodes: readonly QuestNode[]): Tree {
  const byId = new Map<string, QuestNode>();
  const children = new Map<string, QuestNode[]>();

  for (const node of nodes) {
    byId.set(node.id, node);
    if (node.parentId === null) continue;
    const siblings = children.get(node.parentId);
    if (siblings) siblings.push(node);
    else children.set(node.parentId, [node]);
  }
  for (const siblings of children.values()) siblings.sort(comparePosition);

  return { nodes: byId, children };
}

// `<` сравнивает UTF-16-единицы, и для ASCII-ключей fractional-indexing это совпадает
// с побайтовым порядком Postgres (`COLLATE "C"`). `localeCompare` дал бы другой порядок.
function comparePosition(a: QuestNode, b: QuestNode): number {
  if (a.position < b.position) return -1;
  if (a.position > b.position) return 1;
  return 0;
}

export function getNode(tree: Tree, id: string): QuestNode {
  const node = tree.nodes.get(id);
  if (!node) throw new Error(`Quest ${id} is not in the tree`);
  return node;
}

export function childrenOf(tree: Tree, id: string): readonly QuestNode[] {
  return tree.children.get(id) ?? [];
}

/** От родителя вверх до линии. */
export function ancestorsOf(tree: Tree, id: string): QuestNode[] {
  const ancestors: QuestNode[] = [];
  let parentId = getNode(tree, id).parentId;
  while (parentId !== null) {
    const parent = getNode(tree, parentId);
    ancestors.push(parent);
    parentId = parent.parentId;
  }
  return ancestors;
}

/** Лист — этап или задание без неотменённых этапов; пустые глава и линия листьями не считаются. */
export function isLeaf(tree: Tree, node: QuestNode): boolean {
  return (
    node.kind === 'step' ||
    (node.kind === 'quest' && childrenOf(tree, node.id).every((child) => child.status === 'cancelled'))
  );
}

export function isLocked(node: QuestNode): boolean {
  return node.status === 'paused' || node.status === 'cancelled';
}
