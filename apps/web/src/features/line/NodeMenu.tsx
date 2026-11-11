import { MoreHorizontal } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { ru } from '@/shared/strings/ru';
import { Button } from '@/shared/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu';
import { isPending, useLineActions } from './line-actions';
import type { TreeNode } from './line-model';

/** Меню «⋯» линии и главы: правка, пауза, отмена, удаление (docs/ux.md). */
export function NodeMenu({ node, locked, className }: { node: TreeNode; locked: boolean; className?: string }) {
  const { run, openDetails, askDelete } = useLineActions();
  // В замороженной ветке доступно только удаление (правило 3 «Доменной логики»).
  const canChangeStatus = !locked && !isPending(node);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className={cn('shrink-0', className)} aria-label={ru.line.menu(node.title)}>
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-52">
        <DropdownMenuItem onSelect={() => openDetails(node.id)}>{ru.line.actions.edit}</DropdownMenuItem>
        {canChangeStatus && node.status === 'open' && (
          <DropdownMenuItem onSelect={() => run(node, 'pause')}>{ru.line.actions.pause}</DropdownMenuItem>
        )}
        {canChangeStatus && node.status === 'paused' && (
          <DropdownMenuItem onSelect={() => run(node, 'resume')}>{ru.line.actions.resume}</DropdownMenuItem>
        )}
        {canChangeStatus && (node.status === 'open' || node.status === 'paused') && (
          <DropdownMenuItem onSelect={() => run(node, 'cancel')}>{ru.line.actions.cancel}</DropdownMenuItem>
        )}
        {canChangeStatus && node.status === 'cancelled' && (
          <DropdownMenuItem onSelect={() => run(node, 'restore')}>{ru.line.actions.restore}</DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={() => askDelete(node)}>
          {ru.line.actions.delete}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
