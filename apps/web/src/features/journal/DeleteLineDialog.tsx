import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/shared/api/keys';
import { fetchTree, type LineSummary } from '@/shared/api/quests-api';
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

type DeleteLineDialogProps = {
  line: LineSummary;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
};

/** Удаление безвозвратно, поэтому диалог называет, сколько элементов пропадёт (решение PRD). */
export function DeleteLineDialog({ line, open, onOpenChange, onConfirm }: DeleteLineDialogProps) {
  // Число потомков есть только в дереве; заодно дерево окажется в кеше для экрана линии.
  const tree = useQuery({ queryKey: queryKeys.tree(line.id), queryFn: () => fetchTree(line.id) });
  const descendants = tree.data ? tree.data.nodes.length - 1 : null;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{ru.deleteLine.title}</AlertDialogTitle>
          <AlertDialogDescription>
            {descendants === null
              ? ru.deleteLine.withUnknown(line.title)
              : descendants > 0
                ? ru.deleteLine.withChildren(line.title, descendants, plural(descendants, ru.deleteLine.elements))
                : ru.deleteLine.single(line.title)}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{ru.deleteLine.cancel}</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onConfirm}>
            {ru.deleteLine.confirm}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
