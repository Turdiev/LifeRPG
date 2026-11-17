import type { LinesResponse } from '@life-rpg/shared';
import { Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import type { LineSummary, QuestStatus } from '@/shared/api/quests-api';
import { useDelayedFlag } from '@/shared/hooks/use-delayed-flag';
import { ru } from '@/shared/strings/ru';
import { Button } from '@/shared/ui/button';
import { GearIcon, PlusIcon } from '@/shared/ui/icons';
import { Skeleton } from '@/shared/ui/skeleton';
import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group';
import { DeleteLineDialog } from './DeleteLineDialog';
import { localToday } from '@/shared/lib/format';
import { LineCard } from './LineCard';
import { LineFormSheet } from './LineFormSheet';
import { useLineChange, useLines } from './use-journal';

const statuses: QuestStatus[] = ['open', 'paused', 'done', 'cancelled'];

export function JournalPage({ status }: { status: QuestStatus }) {
  const navigate = useNavigate({ from: '/journal' });
  const lines = useLines(status);
  const lineChange = useLineChange();
  const showSkeleton = useDelayedFlag(lines.isPending, 300);

  const [form, setForm] = useState<{ open: boolean; line?: LineSummary }>({ open: false });
  const [deleting, setDeleting] = useState<LineSummary | null>(null);
  const today = localToday();

  return (
    <div className="space-y-4">
      {/* Настройки — иконка в шапке журнала, отдельной вкладки нет (docs/ux.md, «Карта экранов»).
          На компьютере «Новая цель» — тоже в шапке; на телефоне она внизу, под большим пальцем. */}
      <header className="flex items-center gap-2">
        <h1 className="flex-1 type-banner">{ru.journal.title}</h1>
        <Button className="hidden lg:inline-flex" onClick={() => setForm({ open: true })}>
          <PlusIcon />
          {ru.journal.newLine}
        </Button>
        <Button asChild variant="ghost" size="icon" className="-mr-2">
          <Link to="/settings" aria-label={ru.settings.open}>
            <GearIcon />
          </Link>
        </Button>
      </header>

      <ToggleGroup
        type="single"
        variant="outline"
        value={status}
        // Снять выбор нельзя: пустое значение означает повторный клик по активному фильтру.
        onValueChange={(value) => value && void navigate({ search: { status: value as QuestStatus } })}
        aria-label={ru.journal.filtersLabel}
        className="no-scrollbar -mx-4 w-[calc(100%+2rem)] justify-start overflow-x-auto px-4"
      >
        {statuses.map((value) => (
          <ToggleGroupItem
            key={value}
            value={value}
            // Выбранный фильтр отличает и золотая кромка, а не только цвет текста (WCAG 1.4.11).
            className="shrink-0 gap-2"
          >
            {ru.journal.filters[value]}
            {lines.data && (
              <span className="font-semibold tabular-nums text-foreground">{lines.data.counts[value]}</span>
            )}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      {lines.isPending ? (
        showSkeleton && <JournalSkeleton />
      ) : lines.isError ? (
        <div className="space-y-3 py-8 text-center">
          <p>{ru.journal.loadError}</p>
          <Button variant="outline" onClick={() => void lines.refetch()}>
            {ru.journal.retry}
          </Button>
        </div>
      ) : isEmptyJournal(lines.data) ? (
        <div className="panel space-y-3 p-4">
          <h2 className="type-heading">{ru.journal.emptyFirst.title}</h2>
          <p className="max-w-[46ch] text-sm text-muted-foreground">{ru.journal.emptyFirst.text}</p>
          <Button onClick={() => setForm({ open: true })}>{ru.journal.emptyFirst.action}</Button>
        </div>
      ) : lines.data.lines.length === 0 ? (
        <p className="py-8 text-muted-foreground">{ru.journal.emptyFilter[status]}</p>
      ) : (
        // Снизу место под кнопку «Новая цель» во всю ширину: последняя карточка не прячется под ней.
        // На компьютере — сетка в две колонки, последняя ячейка — плитка «Новая цель» (макет журнала).
        <ul className="space-y-3 pb-16 lg:grid lg:grid-cols-2 lg:gap-3.5 lg:space-y-0 lg:pb-0">
          {lines.data.lines.map((line) => (
            <li key={line.id}>
              <LineCard
                line={line}
                today={today}
                onEdit={() => setForm({ open: true, line })}
                onChange={(action) =>
                  action === 'delete' ? setDeleting(line) : lineChange.mutate({ line, action })
                }
              />
            </li>
          ))}
          <li className="hidden lg:block">
            <button
              type="button"
              onClick={() => setForm({ open: true })}
              className="flex size-full min-h-36 flex-col items-center justify-center gap-1.5 rounded-[3px] border border-dashed border-border-strong text-center text-[0.9375rem] text-gold-text outline-none hover:bg-surface-2/50 focus-visible:outline-2 focus-visible:outline-ring"
            >
              <PlusIcon className="text-gold" />
              {ru.journal.newLine}
              <small className="text-xs text-muted-foreground">{ru.journal.newLineHint}</small>
            </button>
          </li>
        </ul>
      )}

      {/* Только телефон: во всю ширину в нижней трети, над вкладками (docs/ux.md, принцип 5). */}
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-30 lg:hidden">
        <div className="mx-auto flex max-w-[640px] px-4">
          <Button size="lg" className="pointer-events-auto w-full drop-shadow-[0_8px_20px_#0008]" onClick={() => setForm({ open: true })}>
            <PlusIcon />
            {ru.journal.newLine}
          </Button>
        </div>
      </div>

      <LineFormSheet
        open={form.open}
        line={form.line}
        onOpenChange={(open) => setForm((current) => ({ ...current, open }))}
      />
      {deleting && (
        <DeleteLineDialog
          line={deleting}
          open
          onOpenChange={(open) => !open && setDeleting(null)}
          onConfirm={() => {
            lineChange.mutate({ line: deleting, action: 'delete' });
            setDeleting(null);
          }}
        />
      )}
    </div>
  );
}

function isEmptyJournal(data: LinesResponse): boolean {
  return Object.values(data.counts).every((count) => count === 0);
}

function JournalSkeleton() {
  return (
    <ul className="space-y-3 lg:grid lg:grid-cols-2 lg:gap-3.5 lg:space-y-0" aria-hidden>
      {[0, 1, 2].map((key) => (
        <li key={key}>
          <Skeleton className="h-36" />
        </li>
      ))}
    </ul>
  );
}
