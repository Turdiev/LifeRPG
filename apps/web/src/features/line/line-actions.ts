import { createContext, useContext } from 'react';
import type { CreateVars } from './use-line';
import type { NodeAction, TreeNode } from './line-model';

/** Действия над деревом нужны строкам любого уровня — контекст вместо пропсов через три уровня. */
export type LineActions = {
  toggle: (node: TreeNode) => void;
  run: (node: TreeNode, action: NodeAction) => void;
  create: (draft: Omit<CreateVars, 'id'>) => void;
  openDetails: (id: string) => void;
  askDelete: (node: TreeNode) => void;
};

export const LineActionsContext = createContext<LineActions | null>(null);

export function useLineActions(): LineActions {
  const actions = useContext(LineActionsContext);
  if (!actions) throw new Error('useLineActions must be used inside LineActionsContext');
  return actions;
}

/** Временный узел ещё не сохранён: действия с ним дождутся ответа сервера. */
export function isPending(node: TreeNode): boolean {
  return node.id.startsWith('temp-');
}
