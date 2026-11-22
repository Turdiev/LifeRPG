import { useState, type ReactNode } from 'react';
import { cn } from '@/shared/lib/utils';
import { ru } from '@/shared/strings/ru';
import { ChevronRightIcon } from '@/shared/ui/icons';

type DoneGroupProps = { count: number; label?: string; className?: string; children: ReactNode };

/**
 * Выполненные элементы уровня свёрнуты в строку внизу группы: история видна, но не мешает (решение PRD).
 * `label` — своя подпись: у контракта так же свёрнуты «Не отмечено» и «Не засчитано».
 */
export function DoneGroup({ count, label, className, children }: DoneGroupProps) {
  const [open, setOpen] = useState(false);
  if (count === 0) return null;

  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          'flex min-h-11 w-full items-center gap-2 text-left text-[0.8125rem] text-muted-foreground outline-none hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring',
          className,
        )}
      >
        <ChevronRightIcon className={cn('size-4 transition-transform', open && 'rotate-90')} />
        {label ?? ru.line.doneGroup(count)}
      </button>
      {open && children}
    </div>
  );
}
