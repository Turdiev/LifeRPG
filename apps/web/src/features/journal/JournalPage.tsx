import type { LinesResponse } from '@life-rpg/shared';
import { useNavigate } from '@tanstack/react-router';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import type { LineSummary, QuestStatus } from '@/shared/api/quests-api';
import { useDelayedFlag } from '@/shared/hooks/use-delayed-flag';
import { ru } from '@/shared/strings/ru';
import { Button } from '@/shared/ui/button';
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
    <div className="space-y-5">
      <h1 className="text-2xl">{ru.journal.title}</h1>

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
            className="shrink-0 gap-1.5 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
          >
            {ru.journal.filters[value]}
            {lines.data && <span className="tabular-nums opacity-70">{lines.data.counts[value]}</span>}
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
        <div className="space-y-3 py-10">
          <h2 className="text-xl">{ru.journal.emptyFirst.title}</h2>
          <p className="max-w-[46ch] text-muted-foreground">{ru.journal.emptyFirst.text}</p>
          <Button onClick={() => setForm({ open: true })}>{ru.journal.emptyFirst.action}</Button>
        </div>
      ) : lines.data.lines.length === 0 ? (
        <p className="py-8 text-muted-foreground">{ru.journal.emptyFilter[status]}</p>
      ) : (
        <ul className="space-y-3">
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
        </ul>
      )}

      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-30">
        <div className="mx-auto flex max-w-[640px] justify-end px-4">
          <Button className="pointer-events-auto rounded-full px-5 shadow-md" onClick={() => setForm({ open: true })}>
            <Plus data-icon="inline-start" aria-hidden />
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
    <ul className="space-y-3" aria-hidden>
      {[0, 1, 2].map((key) => (
        <li key={key}>
          <Skeleton className="h-32 rounded-xl" />
        </li>
      ))}
    </ul>
  );
}
