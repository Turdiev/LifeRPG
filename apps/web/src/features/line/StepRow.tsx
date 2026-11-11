import { cn } from '@/shared/lib/utils';
import { ru } from '@/shared/strings/ru';
import { Checkbox } from '@/shared/ui/checkbox';
import { isPending, useLineActions } from './line-actions';
import type { StepView } from './line-model';

export function StepRow({ step }: { step: StepView }) {
  const { toggle, openDetails } = useLineActions();
  const { node } = step;
  const done = node.status === 'done';

  return (
    <div className="flex min-h-11 items-center gap-3 pl-3">
      <Checkbox
        checked={done}
        disabled={step.locked || isPending(node)}
        onCheckedChange={() => toggle(node)}
        aria-label={done ? ru.line.reopen(node.title) : ru.line.complete(node.title)}
      />
      <button
        type="button"
        onClick={() => openDetails(node.id)}
        aria-label={ru.line.openDetails(node.title)}
        className={cn(
          'min-h-11 flex-1 rounded-md py-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring',
          (done || step.locked) && 'text-muted-foreground',
          node.status === 'cancelled' && 'line-through',
        )}
      >
        {node.title}
      </button>
    </div>
  );
}
