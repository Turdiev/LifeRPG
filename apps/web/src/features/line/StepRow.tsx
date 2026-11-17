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
    <div className="flex min-h-11.5 items-center gap-1 border-b">
      <Checkbox
        checked={done}
        cancelled={node.status === 'cancelled'}
        disabled={step.locked || isPending(node)}
        onCheckedChange={() => toggle(node)}
        aria-label={done ? ru.line.reopen(node.title) : ru.line.complete(node.title)}
      />
      <button
        type="button"
        onClick={() => openDetails(node.id)}
        aria-label={ru.line.openDetails(node.title)}
        className={cn(
          'min-h-11 min-w-0 flex-1 py-2 text-left text-[0.9375rem] leading-snug break-words outline-none focus-visible:outline-2 focus-visible:outline-ring',
          (done || step.locked) && 'text-muted-foreground',
          done && 'line-through decoration-gold-dim',
          node.status === 'cancelled' && 'line-through',
        )}
      >
        {node.title}
      </button>
    </div>
  );
}
