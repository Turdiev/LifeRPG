import { isContract } from '@life-rpg/domain';
import { plural } from '@/shared/lib/plural';
import { ru } from '@/shared/strings/ru';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/ui/alert-dialog';
import type { TreeNode } from './line-model';

type DialogProps = { node: TreeNode; onOpenChange: (open: boolean) => void; onConfirm: () => void };

/**
 * Удаление безвозвратно, поэтому диалог называет, сколько элементов пропадёт (решение PRD); у контракта
 * это дни, а не этапы (docs/ux.md, «Контракт в дереве»).
 */
export function DeleteNodeDialog({ node, descendants, onOpenChange, onConfirm }: DialogProps & { descendants: number }) {
  const contract = isContract(node);
  return (
    <AlertDialog open onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{contract ? ru.contract.deleteTitle : ru.line.deleteNode.title[node.kind]}</AlertDialogTitle>
          <AlertDialogDescription>
            {contract
              ? ru.contract.deleteText(node.title, descendants, plural(descendants, ru.contract.days))
              : descendants > 0
                ? ru.line.deleteNode.withChildren(node.title, descendants, plural(descendants, ru.deleteLine.elements))
                : ru.line.deleteNode.single(node.title)}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{ru.line.deleteNode.cancel}</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onConfirm}>
            {ru.line.deleteNode.confirm}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** Массовая отметка этапов — одно из двух действий с подтверждением (docs/ux.md, «Подтверждения»). */
export function CompleteAllDialog({ node, openSteps, onOpenChange, onConfirm }: DialogProps & { openSteps: number }) {
  return (
    <AlertDialog open onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{ru.line.completeAll.title}</AlertDialogTitle>
          <AlertDialogDescription>
            {ru.line.completeAll.text(node.title, openSteps, plural(openSteps, ru.line.completeAll.steps))}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{ru.line.completeAll.cancel}</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>{ru.line.completeAll.confirm}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** Завершение отменяет все неотмеченные дни, и одной кнопкой «Вернуть» его не откатить (docs/ux.md). */
type FinishProps = Omit<DialogProps, 'node'> & { marked: number; total: number };

export function FinishContractDialog({ marked, total, onOpenChange, onConfirm }: FinishProps) {
  return (
    <AlertDialog open onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{ru.contract.finishDialog.title}</AlertDialogTitle>
          <AlertDialogDescription>{ru.contract.finishDialog.text(marked, total)}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{ru.contract.finishDialog.cancel}</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>{ru.contract.finishDialog.confirm}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
