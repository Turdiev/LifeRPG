import type { LineSummary } from '@/shared/api/quests-api';
import { Link } from '@tanstack/react-router';
import type { Progress as ProgressValue } from '@life-rpg/domain';
import { percent } from '@/shared/lib/format';
import { ru } from '@/shared/strings/ru';
import { LineIcon } from '@/shared/ui/icons';
import { Progress } from '@/shared/ui/progress';

const rowLink = 'outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';

/** Цель активного квеста под карточкой: название и шкала; тап открывает линию (docs/ux.md, «Сегодня»). */
export function GoalLink({ line, progress }: { line: { id: string; title: string }; progress: ProgressValue }) {
  const value = percent(progress);
  return (
    <Link
      to="/line/$lineId"
      params={{ lineId: line.id }}
      aria-label={ru.today.openGoal(line.title, value)}
      className={`${rowLink} mt-2 block border-t px-1 pt-3 pb-1`}
    >
      <span className="block text-sm break-words">{line.title}</span>
      <span className="mt-1 flex items-center gap-3">
        <Progress value={value} className="flex-1" aria-hidden />
        <Percent value={value} />
      </span>
    </Link>
  );
}

/** Компактный список линий в работе: только название и прогресс, остальное — в журнале. */
export function TodayLines({ title, lines }: { title: string; lines: LineSummary[] }) {
  if (lines.length === 0) return null;
  return (
    <section aria-labelledby="today-lines">
      <h2 id="today-lines" className="mx-1 text-xs font-medium text-muted-foreground">
        {title}
      </h2>
      <ul>
        {lines.map((line) => {
          const value = percent(line.progress);
          return (
            <li key={line.id} className="border-b last:border-b-0">
              <Link
                to="/line/$lineId"
                params={{ lineId: line.id }}
                aria-label={ru.today.openGoal(line.title, value)}
                className={`${rowLink} flex min-h-13.5 items-center gap-3 px-1 py-2`}
              >
                <LineIcon className="text-gold" />
                <span className="min-w-0 flex-1 text-[0.9375rem] break-words">{line.title}</span>
                <Progress value={value} className="w-16 shrink-0" aria-hidden />
                <Percent value={value} small />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Процент — гравированной цифрой Forum, как в шапке цели. */
function Percent({ value, small = false }: { value: number; small?: boolean }) {
  return (
    <span
      className={`min-w-9.5 shrink-0 text-right font-heading tabular-nums leading-none tracking-[0.04em] text-gold-text ${small ? 'text-[0.9375rem]' : 'text-lg'}`}
    >
      {ru.journal.progress(value)}
    </span>
  );
}
