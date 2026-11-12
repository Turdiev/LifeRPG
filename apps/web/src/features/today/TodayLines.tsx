import type { LineSummary } from '@/shared/api/quests-api';
import { Link } from '@tanstack/react-router';
import { ChevronRight, Scroll } from 'lucide-react';
import type { Progress as ProgressValue } from '@life-rpg/domain';
import { percent } from '@/shared/lib/format';
import { ru } from '@/shared/strings/ru';
import { Progress } from '@/shared/ui/progress';

const rowLink =
  'flex min-h-11 items-center gap-3 rounded-lg px-1 outline-none focus-visible:ring-2 focus-visible:ring-ring';

/** «Полумарафон к маю · 34%» под карточкой квеста; тап открывает линию (docs/ux.md, «Сегодня»). */
export function GoalLink({ line, progress }: { line: { id: string; title: string }; progress: ProgressValue }) {
  const value = percent(progress);
  return (
    <Link to="/line/$lineId" params={{ lineId: line.id }} aria-label={ru.today.openGoal(line.title, value)} className={rowLink}>
      <Scroll className="size-5 shrink-0 text-muted-foreground" aria-hidden />
      <span className="min-w-0 flex-1 break-words">{ru.today.goal(line.title, value)}</span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
    </Link>
  );
}

/** Компактный список линий в работе: только название и прогресс, остальное — в журнале. */
export function TodayLines({ title, lines }: { title: string; lines: LineSummary[] }) {
  if (lines.length === 0) return null;
  return (
    <section aria-labelledby="today-lines" className="space-y-2">
      <h2 id="today-lines" className="text-lg">
        {title}
      </h2>
      <ul>
        {lines.map((line) => {
          const value = percent(line.progress);
          return (
            <li key={line.id}>
              <Link
                to="/line/$lineId"
                params={{ lineId: line.id }}
                aria-label={ru.today.openGoal(line.title, value)}
                className={`${rowLink} py-2`}
              >
                <span className="min-w-0 flex-1 space-y-1.5">
                  <span className="flex items-baseline gap-3">
                    <span className="min-w-0 flex-1 break-words">{line.title}</span>
                    <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                      {ru.journal.progress(value)}
                    </span>
                  </span>
                  <Progress value={value} className="h-1" aria-hidden />
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
