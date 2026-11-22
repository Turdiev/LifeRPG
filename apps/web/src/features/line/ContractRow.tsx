import { localToday } from '@/shared/lib/format';
import { plural } from '@/shared/lib/plural';
import { cn } from '@/shared/lib/utils';
import { ru } from '@/shared/strings/ru';
import { Button } from '@/shared/ui/button';
import { Checkbox } from '@/shared/ui/checkbox';
import { ChevronRightIcon, HourglassIcon, ScrollIcon } from '@/shared/ui/icons';
import { ProgressRing } from '@/shared/ui/ProgressRing';
import { dayLabel, scheduleText, weekLabel } from './contract-format';
import { contractView } from './contract-model';
import { DoneGroup } from './DoneGroup';
import { isPending, useLineActions } from './line-actions';
import type { QuestView, TreeNode } from './line-model';
import { StepRow } from './StepRow';

type ContractRowProps = { quest: QuestView; expanded: boolean; onToggleExpanded: () => void };

/**
 * Контракт в дереве (docs/ux.md, «Контракт в дереве»): вместо десятков строк дней — неделя ромбами
 * и свёрнутые группы. Строки «+ Добавить этап» нет: дни создаёт только расписание.
 */
export function ContractRow({ quest, expanded, onToggleExpanded }: ContractRowProps) {
  const { toggle, run, openDetails, askFinish } = useLineActions();
  const { node } = quest;
  const today = localToday();
  const view = contractView(node, [...quest.steps.items, ...quest.steps.done].map((step) => step.node), today);
  const done = node.status === 'done';
  const disabled = quest.locked || isPending(node);
  // Кольцо завершает контракт, пока есть что засчитать; у выполненного оно не нажимается (docs/ux.md).
  const canFinish = !disabled && node.status === 'open' && view.marked > 0;
  const daysId = `days-${node.id}`;
  const subtitle = done
    ? ru.contract.marked(view.marked, plural(view.marked, ru.contract.days))
    : scheduleText(node.schedule!, today);
  const dayRow = (day: TreeNode) => (
    <StepRow
      key={day.id}
      step={{ node: day, locked: quest.locked || day.status === 'cancelled' }}
      label={dayLabel(day.scheduledOn!, today)}
    />
  );

  return (
    <div className="border-t first:border-t-0">
      <div className="flex min-h-14 items-center gap-1">
        {/* Отменённый контракт — ромб с крестом без кольца, как отменённое задание (docs/ux.md). */}
        {node.status === 'cancelled' ? (
          <Checkbox checked={false} cancelled disabled aria-label={node.title} />
        ) : (
          <button
            type="button"
            disabled={!canFinish}
            onClick={() => askFinish(node)}
            aria-label={(canFinish ? ru.contract.finishLabel : ru.contract.progressLabel)(
              node.title,
              quest.progress.done,
              quest.progress.total,
            )}
            className="grid size-11 shrink-0 place-items-center rounded-full outline-none focus-visible:outline-2 focus-visible:outline-ring disabled:cursor-default"
          >
            <ProgressRing done={quest.progress.done} total={quest.progress.total} muted={quest.locked} />
          </button>
        )}
        <button
          type="button"
          onClick={expanded ? () => openDetails(node.id) : onToggleExpanded}
          // Подпись кнопки заменяет её текст — расписание и «Срок вышел» дописаны, чтобы скринридер их прочёл.
          aria-label={[
            expanded ? ru.line.openDetails(node.title) : ru.contract.expand(node.title),
            subtitle,
            view.expired && ru.contract.expired,
          ]
            .filter(Boolean)
            .join(', ')}
          className={cn(
            'min-h-11 min-w-0 flex-1 py-2 text-left leading-snug outline-none focus-visible:outline-2 focus-visible:outline-ring',
            (done || quest.locked) && 'text-muted-foreground',
          )}
        >
          <span className="flex items-start gap-1.5 font-medium">
            <ScrollIcon className={cn('mt-0.5 size-4', quest.locked ? 'text-muted-foreground' : 'text-gold')} />
            <span
              className={cn(
                'min-w-0 break-words',
                done && 'line-through decoration-gold-dim',
                node.status === 'cancelled' && 'line-through',
              )}
            >
              {node.title}
            </span>
          </span>
          <span className="mt-0.5 block text-xs text-muted-foreground">{subtitle}</span>
          {view.expired && (
            <span className="mt-0.5 flex items-center gap-1 text-xs font-medium text-overdue">
              <HourglassIcon className="size-3.5" />
              {ru.contract.expired}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={onToggleExpanded}
          aria-expanded={expanded}
          aria-controls={daysId}
          aria-label={expanded ? ru.contract.collapse(node.title) : ru.contract.expand(node.title)}
          className="grid size-11 shrink-0 place-items-center rounded-full text-muted-foreground outline-none focus-visible:outline-2 focus-visible:outline-ring"
        >
          <ChevronRightIcon className={cn('size-4 transition-transform', expanded && 'rotate-90')} />
        </button>
      </div>

      {/* Без отмеченных дней завершать нечего — вышедший срок предлагает отменить контракт (docs/ux.md, «Сегодня»). */}
      {view.expired && !disabled && (
        <div className="pb-2.5 pl-12">
          {canFinish ? (
            <Button variant="outline" onClick={() => askFinish(node)}>
              {ru.contract.finish}
            </Button>
          ) : (
            <Button variant="outline" onClick={() => run(node, 'cancel')}>
              {ru.contract.cancelContract}
            </Button>
          )}
        </div>
      )}

      {expanded && (
        <div id={daysId} className="mb-1 ml-5 border-l border-dashed border-border-strong pl-1.5">
          {/* Неделя — семь пазов с понедельника: дни расписания ромбами, остальные — пустыми пазами,
              чтобы ритм «пн, ср, пт» читался сразу, а сегодняшний день стоял на своём месте. */}
          {view.week.some((slot) => slot.day !== null) && (
            <ul aria-label={ru.contract.thisWeek} className="grid grid-cols-7 pt-1 pb-1.5">
              {view.week.map(({ date, day, future }) => {
                const isToday = date === today;
                const labelTone = isToday ? 'font-medium text-gold-text' : 'text-muted-foreground';
                if (day === null) {
                  return (
                    // Пустой паз — только ритм недели; скринридеру в нём читать нечего.
                    <li key={date} aria-hidden className="flex flex-col items-center">
                      <span className="grid size-10 place-items-center">
                        <span className="size-1.5 rotate-45 border border-border-strong" />
                      </span>
                      <span className={cn('-mt-1 min-h-6 text-xs whitespace-nowrap tabular-nums opacity-60', labelTone)}>
                        {weekLabel(date)}
                      </span>
                    </li>
                  );
                }
                const label = dayLabel(date, today);
                return (
                  <li key={date} className="flex flex-col items-center">
                    {/* 40 px вместо 44: семь колонок должны уместиться в 288 px строки на телефоне. */}
                    <Checkbox
                      checked={day.status === 'done'}
                      cancelled={day.status === 'cancelled'}
                      // Будущий день ещё не наступил, отменённый возвращают из его деталей.
                      disabled={future || quest.locked || isPending(day) || day.status === 'cancelled'}
                      onCheckedChange={() => toggle(day)}
                      aria-label={day.status === 'done' ? ru.line.reopen(label) : ru.line.complete(label)}
                      className="size-10"
                    />
                    <button
                      type="button"
                      onClick={() => openDetails(day.id)}
                      aria-label={ru.line.openDetails(label)}
                      className={cn(
                        // Подпись — единственный вход в детали дня этой недели: зона касания растянута вниз.
                        'relative -mt-1 min-h-6 rounded-sm px-0.5 text-xs whitespace-nowrap tabular-nums outline-none after:absolute after:-inset-x-0.5 after:-inset-y-2.5 focus-visible:outline-2 focus-visible:outline-ring',
                        labelTone,
                      )}
                    >
                      {weekLabel(date)}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <DoneGroup count={view.unmarked.length} label={ru.contract.unmarked(view.unmarked.length)}>
            {view.unmarked.map(dayRow)}
          </DoneGroup>
          {view.ahead > 0 && (
            <p className="flex min-h-11 items-center pl-6 text-[0.8125rem] text-muted-foreground">
              {ru.contract.ahead(view.ahead, plural(view.ahead, ru.contract.days))}
            </p>
          )}
          <DoneGroup count={view.doneBefore.length}>{view.doneBefore.map(dayRow)}</DoneGroup>
          <DoneGroup count={view.notCounted.length} label={ru.contract.notCounted(view.notCounted.length)}>
            {view.notCounted.map(dayRow)}
          </DoneGroup>
        </div>
      )}
    </div>
  );
}
