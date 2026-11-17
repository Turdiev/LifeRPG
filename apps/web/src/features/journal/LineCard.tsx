import { Link } from '@tanstack/react-router';
import type { LineSummary } from '@/shared/api/quests-api';
import { cn } from '@/shared/lib/utils';
import { ru } from '@/shared/strings/ru';
import { Button } from '@/shared/ui/button';
import { CalendarIcon, DotsIcon, FlagIcon, HourglassIcon, PauseIcon } from '@/shared/ui/icons';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu';
import { Progress } from '@/shared/ui/progress';
import { daysOverdue, formatDeadline, isOverdue, percent } from '@/shared/lib/format';
import { plural } from '@/shared/lib/plural';
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
  const hasMeta = line.status === 'paused' || line.status === 'done' || line.deadline !== null;
  // Отменённая или завершённая цель не может опоздать: охра — только у живых целей.
  const overdue = (line.status === 'open' || line.status === 'paused') && isOverdue(line.deadline, today);

  return (
    <article
      className={cn(
        // Фокус — контур снаружи, а не кольцо: так он не спорит с золотыми уголками активной линии.
        'panel relative flex h-full flex-col px-3.5 pt-3.5 pb-3 has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-4 has-[a:focus-visible]:outline-ring has-[a:focus-visible]:outline-solid',
        // Уголки — только у цели с активным квестом: она одна на экране (docs/ux.md, «Решения по UX»).
        line.hasActiveQuest && 'ornate',
      )}
    >
      <div className="flex items-start gap-1">
        <h2 className={cn('min-w-0 flex-1 pt-0.5 type-heading break-words', muted && 'text-muted-foreground')}>
          {/* Растянутая ссылка: вся карточка кликабельна, а меню остаётся отдельной кнопкой поверх. */}
          <Link
            to="/line/$lineId"
            params={{ lineId: line.id }}
            className={cn(
              'outline-none after:absolute after:inset-0 after:content-[""]',
              line.status === 'cancelled' && 'line-through',
            )}
          >
            {line.title}
          </Link>
        </h2>
        <LineMenu line={line} onEdit={onEdit} onChange={onChange} />
      </div>

      {hasMeta && (
        <div className="mt-1 mb-3 flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[0.8125rem] text-muted-foreground">
          <StatusPill status={line.status} />
          {line.deadline && (
            <span className={cn('inline-flex items-center gap-1.5', overdue && 'font-medium text-overdue')}>
              {/* Просрочка — песочные часы, а не цвет: читается и без него (docs/ux.md, «Цвета статусов»). */}
              {overdue ? <HourglassIcon className="size-4" /> : <CalendarIcon className="size-4" />}
              {overdue
                ? ru.journal.overdue(daysOverdue(line.deadline, today), plural(daysOverdue(line.deadline, today), ru.journal.overdueNoun))
                : ru.journal.deadline(formatDeadline(line.deadline, today))}
            </span>
          )}
        </div>
      )}

      <div className={cn('flex items-center gap-3', !hasMeta && 'mt-3')}>
        <Progress
          value={progress}
          aria-label={ru.journal.progressLabel(line.title)}
          className="flex-1"
          tone={line.status === 'paused' ? 'paused' : line.status === 'cancelled' ? 'cancelled' : 'active'}
        />
        <span className="min-w-9.5 text-right font-heading text-lg leading-none tabular-nums tracking-[0.04em] text-gold-text">
          {ru.journal.progress(progress)}
        </span>
      </div>

      {(line.chapters || line.hasActiveQuest) && (
        <div className="mt-auto flex items-center justify-between gap-3 pt-2.5 text-[0.8125rem] text-muted-foreground">
          <span>{line.chapters && ru.journal.chapter(line.chapters.current, line.chapters.total)}</span>
          {line.hasActiveQuest && (
            <span className="inline-flex items-center gap-1.5 text-gold-text">
              <FlagIcon className="size-4" />
              {ru.journal.activeQuest}
            </span>
          )}
        </div>
      )}
    </article>
  );
}

/** Пауза и завершение — подписью в рамке: состояние читается словом, а не только приглушённым цветом. */
function StatusPill({ status }: { status: LineSummary['status'] }) {
  if (status !== 'paused' && status !== 'done') return null;
  const paused = status === 'paused';
  return (
    <span
      className={cn(
        'inline-flex min-h-6 items-center gap-1.5 rounded-full border px-2.5 text-xs',
        paused ? 'border-paused text-paused' : 'border-border-strong text-gold-text',
      )}
    >
      {paused && <PauseIcon className="size-3.5" />}
      {paused ? ru.journal.paused : ru.journal.done}
    </span>
  );
}

function LineMenu({ line, onEdit, onChange }: Omit<LineCardProps, 'today'>) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative z-10 -mt-1.5 -mr-2" aria-label={ru.lineMenu.open(line.title)}>
          <DotsIcon />
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
