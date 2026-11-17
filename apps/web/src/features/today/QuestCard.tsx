import { Link } from '@tanstack/react-router';
import { useEffect, useRef } from 'react';
import { isPending } from '@/features/line/line-actions';
import type { TreeNode } from '@/features/line/line-model';
import { percent } from '@/shared/lib/format';
import { plural } from '@/shared/lib/plural';
import { cn } from '@/shared/lib/utils';
import { ru } from '@/shared/strings/ru';
import { Button } from '@/shared/ui/button';
import { Checkbox } from '@/shared/ui/checkbox';
import { FlagIcon, LineIcon, SparksIcon, StepIcon } from '@/shared/ui/icons';
import { Progress } from '@/shared/ui/progress';
import { MAX_PIPS, StepPips } from '@/shared/ui/StepPips';
import type { TodayQuestView } from './today-model';

type QuestCardProps = {
  view: TodayQuestView;
  /** Квест только что закрыт на этом экране: карточка остаётся с галочками, но уже не отмечается. */
  finished: boolean;
  /** Квест только что взят кнопкой, которая исчезла вместе с прошлой карточкой: фокус — на заголовок. */
  focusTitle: boolean;
  onToggle: (node: TreeNode) => void;
};

/**
 * Карточка активного квеста — единственная карточка с золотыми уголками на экране (docs/ux.md,
 * «Атмосфера»). Следующий этап — крупно, в подсвеченной полосе под большим пальцем.
 */
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
      className="panel ornate relative px-4 pt-4 pb-1.5"
    >
      {/* Блик появляется вместе с «Квест пройден» и проходит по карточке один раз. Начальный сдвиг
          задаёт fill-mode `both` анимации: класс `-translate-x-full` в Tailwind v4 — отдельное
          свойство `translate`, оно сложилось бы с `transform` из keyframes, и блик застыл бы на карточке. */}
      {/* Обрезка — у слоя блика, а не у карточки: overflow-hidden на ней срезал бы золотые уголки на рамке. */}
      {finished && (
        <span aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden motion-reduce:hidden">
          <span className="absolute inset-0 bg-linear-to-r from-transparent via-gold/20 to-transparent motion-safe:animate-quest-shimmer" />
        </span>
      )}
      <p className="flex items-start gap-2 text-[0.8125rem] text-muted-foreground">
        <LineIcon className="mt-px size-4 text-gold" />
        <span className="min-w-0 break-words">{chapter ? ru.today.path(line.title, chapter.title) : line.title}</span>
      </p>
      {/* Метка видна глазами; скринридер слышит её в начале заголовка. */}
      {!finished && (
        <p aria-hidden className="mt-3 mb-0.5 flex items-center gap-1.5 text-[0.8125rem] font-medium text-gold-text">
          <FlagIcon className="size-4" />
          {ru.today.activeQuest}
        </p>
      )}
      <h2 ref={titleRef} tabIndex={-1} id={`quest-${quest.id}`} className={cn('type-title break-words outline-none', finished && 'mt-3')}>
        {!finished && <span className="sr-only">{ru.today.activeQuest}: </span>}
        {quest.title}
      </h2>

      {steps && (
        <div className="mt-2.5 flex items-center gap-3 text-[0.8125rem] text-muted-foreground">
          {steps.total <= MAX_PIPS ? (
            <StepPips done={steps.done} total={steps.total} />
          ) : (
            <Progress value={percent(steps)} aria-label={ru.line.progressLabel(quest.title)} className="w-28" />
          )}
          <span className="tabular-nums">{ru.today.steps(steps.done, steps.total, plural(steps.total, ru.today.stepsNoun))}</span>
        </div>
      )}

      {view.shown.length > 0 && (
        <ul aria-label={ru.today.stepsLabel(quest.title)} className="mt-2">
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
          className="ml-11 inline-flex min-h-9 items-center rounded-full px-1 text-[0.8125rem] text-muted-foreground outline-none focus-visible:outline-2 focus-visible:outline-ring"
        >
          {ru.today.more(view.moreCount, plural(view.moreCount, ru.today.moreNoun))}
        </Link>
      )}

      {finished ? (
        <p ref={doneRef} tabIndex={-1} className="mt-3 mb-2.5 flex items-center gap-2 font-medium text-gold-text outline-none" role="status">
          <SparksIcon className="text-gold" />
          {ru.today.questDone}
        </p>
      ) : (
        !steps && (
          <Button className="mt-4 mb-2.5 w-full" disabled={isPending(quest)} onClick={() => onToggle(quest)}>
            <StepIcon />
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
        'flex cursor-pointer items-center gap-1.5 has-disabled:cursor-default',
        next
          ? '-mx-4 mt-2.5 border-t border-border-strong bg-linear-to-r from-halo to-transparent to-80% py-2.5 pr-3.5 pl-2.5'
          : 'min-h-12 border-t',
        done && 'text-muted-foreground',
      )}
    >
      <Checkbox
        checked={done}
        large={next}
        disabled={disabled || isPending(step)}
        onCheckedChange={() => onToggle(step)}
        className={cn(disabled && 'disabled:opacity-100')}
      />
      <span className="min-w-0 flex-1 py-1.5 break-words">
        {next && <span className="block text-xs text-muted-foreground">{ru.today.nextStep}</span>}
        <span
          className={cn(
            next ? 'block text-lg leading-snug font-medium' : 'text-[0.9375rem] leading-snug',
            done && 'line-through decoration-gold-dim',
          )}
        >
          {step.title}
        </span>
      </span>
    </label>
  );
}
