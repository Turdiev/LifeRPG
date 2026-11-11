import { Link } from '@tanstack/react-router';
import { Check, Flag, MoreHorizontal, Pause, Scroll, Swords } from 'lucide-react';
import type { LineSummary } from '@/shared/api/quests-api';
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
import { Progress } from '@/shared/ui/progress';
import { formatDeadline, isOverdue, percent } from '@/shared/lib/format';
import type { LineChangeAction } from './use-journal';

type LineCardProps = {
  line: LineSummary;
  today: string;
  onEdit: () => void;
  onChange: (action: LineChangeAction) => void;
};

export function LineCard({ line, today, onEdit, onChange }: LineCardProps) {
  const progress = percent(line.progress);
  const muted = line.status === 'paused' || line.status === 'cancelled';
  // Отменённая или завершённая цель не может опоздать: охра — только у живых целей.
  const overdue = (line.status === 'open' || line.status === 'paused') && isOverdue(line.deadline, today);

  return (
    <article
      className={cn(
        'relative rounded-xl border bg-card p-4 has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-ring',
        // Золото — только у линии с активным квестом (docs/ux.md, «Цвета статусов»).
        line.hasActiveQuest && 'border-quest ring-1 ring-quest',
      )}
    >
      <div className="flex items-start gap-2">
        <StatusIcon status={line.status} />
        <h2 className={cn('min-w-0 flex-1 pt-0.5 text-xl break-words', muted && 'text-muted-foreground')}>
          {/* Растянутая ссылка: вся карточка кликабельна, а меню остаётся отдельной кнопкой поверх. */}
          <Link
            to="/line/$lineId"
            params={{ lineId: line.id }}
            className={cn(
              'outline-none after:absolute after:inset-0 after:rounded-xl after:content-[""]',
              line.status === 'cancelled' && 'line-through',
            )}
          >
            {line.title}
          </Link>
        </h2>
        <LineMenu line={line} onEdit={onEdit} onChange={onChange} />
      </div>

      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
        {line.hasActiveQuest && (
          <span className="flex items-center gap-1 font-medium text-quest-foreground">
            <Swords className="size-4" aria-hidden />
            {ru.journal.activeQuest}
          </span>
        )}
        {line.chapters && (
          <span className="flex items-center gap-1">
            <Flag className="size-4" aria-hidden />
            {ru.journal.chapter(line.chapters.current, line.chapters.total)}
          </span>
        )}
        {line.deadline && (
          <span className={cn(overdue && 'font-medium text-overdue')}>
            {ru.journal.deadline(formatDeadline(line.deadline, today))}
          </span>
        )}
      </div>

      <div className="mt-3 flex items-center gap-3">
        <Progress
          value={progress}
          aria-label={ru.journal.progressLabel(line.title)}
          className="flex-1"
          // Пауза и отмена — серые (docs/ux.md, «Цвета статусов»); зелень остаётся живым целям.
          indicatorClassName={muted ? 'bg-muted-foreground/50' : undefined}
        />
        <span className="w-10 text-right text-sm tabular-nums text-muted-foreground">
          {ru.journal.progress(progress)}
        </span>
      </div>
    </article>
  );
}

function StatusIcon({ status }: { status: LineSummary['status'] }) {
  const className = 'mt-1.5 size-5 shrink-0';
  if (status === 'done') return <Check className={cn(className, 'text-success')} aria-hidden />;
  if (status === 'paused') return <Pause className={cn(className, 'text-muted-foreground')} aria-hidden />;
  return <Scroll className={cn(className, 'text-muted-foreground')} aria-hidden />;
}

function LineMenu({ line, onEdit, onChange }: Omit<LineCardProps, 'today'>) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative z-10 -mt-1.5 -mr-2" aria-label={ru.lineMenu.open(line.title)}>
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-52">
        <DropdownMenuItem onSelect={onEdit}>{ru.lineMenu.rename}</DropdownMenuItem>
        {line.status === 'open' && (
          <DropdownMenuItem onSelect={() => onChange('pause')}>{ru.lineMenu.pause}</DropdownMenuItem>
        )}
        {line.status === 'paused' && (
          <DropdownMenuItem onSelect={() => onChange('resume')}>{ru.lineMenu.resume}</DropdownMenuItem>
        )}
        {(line.status === 'open' || line.status === 'paused') && (
          <DropdownMenuItem onSelect={() => onChange('cancel')}>{ru.lineMenu.cancel}</DropdownMenuItem>
        )}
        {line.status === 'cancelled' && (
          <DropdownMenuItem onSelect={() => onChange('restore')}>{ru.lineMenu.restore}</DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={() => onChange('delete')}>
          {ru.lineMenu.delete}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
