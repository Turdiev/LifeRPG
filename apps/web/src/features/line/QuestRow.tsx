import { ChevronRight, Swords } from 'lucide-react';
import { percent } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';
import { ru } from '@/shared/strings/ru';
import { Checkbox } from '@/shared/ui/checkbox';
import { ProgressRing } from '@/shared/ui/ProgressRing';
import { DoneGroup } from './DoneGroup';
import { InlineAdd } from './InlineAdd';
import { isPending, useLineActions } from './line-actions';
import type { QuestView } from './line-model';
import { StepRow } from './StepRow';

type QuestRowProps = { quest: QuestView; expanded: boolean; onToggleExpanded: () => void };

/**
 * Задание: кольцо прогресса, если есть этапы, иначе чекбокс. Тап по названию раскрывает
 * этапы, в раскрытом виде — открывает лист деталей (docs/ux.md, «Экран сюжетной линии»).
 */
export function QuestRow({ quest, expanded, onToggleExpanded }: QuestRowProps) {
  const { toggle, openDetails } = useLineActions();
  const { node } = quest;
  const done = node.status === 'done';
  const disabled = quest.locked || isPending(node);
  // Задание, у которого все этапы отменены, — лист: отмечается чекбоксом (решение PRD).
  const hasSteps = [...quest.steps.items, ...quest.steps.done].some((step) => step.node.status !== 'cancelled');
  const checkLabel = done ? ru.line.reopen(node.title) : ru.line.complete(node.title);
  const stepsId = `steps-${node.id}`;
  // Маркер активного квеста виден иконкой; в подписи кнопки он нужен для скринридера.
  const withMarker = (label: string) => (quest.isActive ? `${label}, ${ru.line.activeMarker.toLowerCase()}` : label);

  return (
    <div>
      <div className="flex min-h-11 items-center gap-1 pl-1">
        {hasSteps ? (
          <button
            type="button"
            disabled={disabled}
            onClick={() => toggle(node)}
            aria-label={checkLabel}
            className="grid size-11 shrink-0 place-items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            <ProgressRing value={done ? 100 : percent(quest.progress)} muted={quest.locked} />
          </button>
        ) : (
          <span className="grid size-11 shrink-0 place-items-center">
            <Checkbox
              checked={done}
              disabled={disabled}
              onCheckedChange={() => toggle(node)}
              aria-label={checkLabel}
            />
          </span>
        )}
        <button
          type="button"
          onClick={expanded ? () => openDetails(node.id) : onToggleExpanded}
          // В раскрытом виде кнопка уже не сворачивает, а открывает детали — aria-expanded только у шеврона.
          aria-label={withMarker(expanded ? ru.line.openDetails(node.title) : ru.line.expand(node.title))}
          className={cn(
            'flex min-h-11 flex-1 items-center gap-2 rounded-md py-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring',
            (done || quest.locked) && 'text-muted-foreground',
            node.status === 'cancelled' && 'line-through',
          )}
        >
          <span className="min-w-0 flex-1 break-words">{node.title}</span>
          {quest.isActive && (
            <Swords className="size-4 shrink-0 text-quest" aria-hidden />
          )}
        </button>
        <button
          type="button"
          onClick={onToggleExpanded}
          aria-expanded={expanded}
          aria-controls={stepsId}
          aria-label={expanded ? ru.line.collapse(node.title) : ru.line.expand(node.title)}
          className="grid size-11 shrink-0 place-items-center rounded-md text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronRight className={cn('size-4 transition-transform', expanded && 'rotate-90')} aria-hidden />
        </button>
      </div>

      {expanded && (
        <div id={stepsId} className="ml-6 border-l pl-2">
          {quest.steps.items.map((step) => (
            <StepRow key={step.node.id} step={step} />
          ))}
          <DoneGroup count={quest.steps.done.length}>
            {quest.steps.done.map((step) => (
              <StepRow key={step.node.id} step={step} />
            ))}
          </DoneGroup>
          {!disabled && (
            <InlineAdd parentId={node.id} kind="step" />
          )}
        </div>
      )}
    </div>
  );
}
