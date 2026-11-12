import { Link } from '@tanstack/react-router';
import { Check, Swords } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { isPending } from '@/features/line/line-actions';
import type { TreeNode } from '@/features/line/line-model';
import { percent } from '@/shared/lib/format';
import { plural } from '@/shared/lib/plural';
import { cn } from '@/shared/lib/utils';
import { ru } from '@/shared/strings/ru';
import { Button } from '@/shared/ui/button';
import { Checkbox } from '@/shared/ui/checkbox';
import { Progress } from '@/shared/ui/progress';
import type { TodayQuestView } from './today-model';

type QuestCardProps = {
  view: TodayQuestView;
  /** Квест только что закрыт на этом экране: карточка остаётся с галочками, но уже не отмечается. */
  finished: boolean;
  /** Квест только что взят кнопкой, которая исчезла вместе с прошлой карточкой: фокус — на заголовок. */
  focusTitle: boolean;
  onToggle: (node: TreeNode) => void;
};

/** Карточка активного квеста — единственное место с золотом на экране (docs/ux.md, «Цвета статусов»). */
export function QuestCard({ view, finished, focusTitle, onToggle }: QuestCardProps) {
  const { quest, line, chapter, steps } = view;
  const cardRef = useRef<HTMLElement>(null);
  const doneRef = useRef<HTMLParagraphElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);

  // `focusTitle` у карточки не меняется (она пересоздаётся по ключу квеста), поэтому эффект
  // срабатывает только при появлении — и только если фокус потерялся вместе с прошлой карточкой.
  useEffect(() => {
    if (focusTitle && document.activeElement === document.body) titleRef.current?.focus();
  }, [focusTitle]);

  // Отмеченный с клавиатуры чекбокс становится неактивным, а кнопка «Квест выполнен» исчезает —
  // фокус ушёл бы в никуда. Переводим его на «Квест пройден», только если он был в карточке.
  useEffect(() => {
    if (!finished) return;
    const focused = document.activeElement;
    if (focused === document.body || cardRef.current?.contains(focused)) doneRef.current?.focus();
  }, [finished]);

  return (
    <article
      ref={cardRef}
      aria-labelledby={`quest-${quest.id}`}
      className={cn(
        'relative overflow-hidden rounded-xl border bg-card p-4 transition-colors duration-500 motion-reduce:transition-none',
        finished ? 'border-success/60' : 'border-quest ring-1 ring-quest',
      )}
    >
      {/* Блик появляется вместе с «Квест пройден» и проходит по карточке один раз. Начальный сдвиг
          задаёт fill-mode `both` анимации: класс `-translate-x-full` в Tailwind v4 — отдельное
          свойство `translate`, оно сложилось бы с `transform` из keyframes, и блик застыл бы на карточке. */}
      {finished && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-linear-to-r from-transparent via-quest/20 to-transparent motion-safe:animate-quest-shimmer motion-reduce:hidden"
        />
      )}
      <p className="text-sm text-muted-foreground">{chapter ? ru.today.path(line.title, chapter.title) : line.title}</p>
      <h2 ref={titleRef} tabIndex={-1} id={`quest-${quest.id}`} className="mt-1 flex items-start gap-2 text-xl break-words outline-none">
        <Swords className={cn('mt-1 size-5 shrink-0', finished ? 'text-muted-foreground' : 'text-quest')} aria-hidden />
        {!finished && <span className="sr-only">{ru.today.activeQuest}: </span>}
        <span className="min-w-0 flex-1">{quest.title}</span>
      </h2>

      {steps && (
        <div className="mt-3 flex items-center gap-3">
          <Progress value={percent(steps)} aria-label={ru.line.progressLabel(quest.title)} className="flex-1" />
          <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
            {ru.today.steps(steps.done, steps.total, plural(steps.total, ru.today.stepsNoun))}
          </span>
        </div>
      )}

      {view.shown.length > 0 && (
        <ul aria-label={ru.today.stepsLabel(quest.title)} className="mt-3 -mx-1">
          {view.shown.map((step) => (
            <li key={step.id}>
              <StepLine step={step} next={step.id === view.nextStepId} disabled={finished} onToggle={onToggle} />
            </li>
          ))}
        </ul>
      )}
      {view.moreCount > 0 && (
        <Link
          to="/line/$lineId"
          params={{ lineId: line.id }}
          className="ml-10 inline-flex min-h-11 items-center rounded-md px-1 text-sm text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {ru.today.more(view.moreCount, plural(view.moreCount, ru.today.moreNoun))}
        </Link>
      )}

      {finished ? (
        <p ref={doneRef} tabIndex={-1} className="mt-3 flex items-center gap-2 font-medium outline-none" role="status">
          <Check className="size-5 text-success" aria-hidden />
          {ru.today.questDone}
        </p>
      ) : (
        !steps && (
          <Button className="mt-4 h-11 w-full" disabled={isPending(quest)} onClick={() => onToggle(quest)}>
            <Check data-icon="inline-start" aria-hidden />
            {ru.today.completeQuest}
          </Button>
        )
      )}
    </article>
  );
}

type StepLineProps = { step: TreeNode; next: boolean; disabled: boolean; onToggle: (node: TreeNode) => void };

/**
 * Вся строка — подпись чекбокса: отметка за одно касание по любому месту строки (docs/ux.md,
 * принцип 2). Следующий этап крупнее остальных — это ответ на «что сделать сейчас».
 */
function StepLine({ step, next, disabled, onToggle }: StepLineProps) {
  const done = step.status === 'done';
  return (
    <label
      className={cn(
        'flex cursor-pointer items-center gap-3 rounded-lg px-1 has-disabled:cursor-default',
        next ? 'min-h-14 text-lg' : 'min-h-11',
        done && 'text-muted-foreground',
      )}
    >
      <span className="grid size-8 shrink-0 place-items-center">
        <Checkbox
          checked={done}
          disabled={disabled || isPending(step)}
          onCheckedChange={() => onToggle(step)}
          className={cn(next && 'size-6 [&_svg]:size-4!', disabled && 'disabled:opacity-100')}
        />
      </span>
      <span className="min-w-0 flex-1 py-2 break-words">{step.title}</span>
    </label>
  );
}
