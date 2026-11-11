import { ChevronRight } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { cn } from '@/shared/lib/utils';
import { ru } from '@/shared/strings/ru';

/** Выполненные элементы уровня свёрнуты в строку внизу группы: история видна, но не мешает (решение PRD). */
export function DoneGroup({ count, children }: { count: number; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  if (count === 0) return null;

  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex min-h-11 w-full items-center gap-1.5 rounded-lg px-2 text-left text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ChevronRight className={cn('size-4 transition-transform', open && 'rotate-90')} aria-hidden />
        {ru.line.doneGroup(count)}
      </button>
      {open && children}
    </div>
  );
}
