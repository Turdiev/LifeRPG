import { isContract } from '@life-rpg/domain';
import { cn } from '@/shared/lib/utils';
import { ru } from '@/shared/strings/ru';
import { Checkbox } from '@/shared/ui/checkbox';
import { ChevronRightIcon, FlagIcon } from '@/shared/ui/icons';
import { ProgressRing } from '@/shared/ui/ProgressRing';
import { ContractRow } from './ContractRow';
import { DoneGroup } from './DoneGroup';
import { InlineAdd } from './InlineAdd';
import { isPending, useLineActions } from './line-actions';
import type { QuestView } from './line-model';
import { StepRow } from './StepRow';

type QuestRowProps = { quest: QuestView; expanded: boolean; onToggleExpanded: () => void };

/** Контракт — та же строка задания, но со своим видом: неделя и группы дней вместо этапов. */
export function QuestRow(props: QuestRowProps) {
  return isContract(props.quest.node) ? <ContractRow {...props} /> : <PlainQuestRow {...props} />;
}

/**
 * Задание: кольцо прогресса, если есть этапы, иначе чекбокс. Тап по названию раскрывает
 * этапы, в раскрытом виде — открывает лист деталей (docs/ux.md, «Экран сюжетной линии»).
 */
function PlainQuestRow({ quest, expanded, onToggleExpanded }: QuestRowProps) {
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
    // Строки заданий отделены линией; активное — золотая кромка слева и мягкий свет (docs/ux.md).
    <div className="border-t first:border-t-0">
      <div
        className={cn(
          'flex min-h-14 items-center gap-1',
          quest.isActive && '-mx-3.5 border-l-2 border-l-gold bg-linear-to-r from-halo to-transparent to-85% pr-3.5 pl-3',
        )}
      >
        {/* Отменённое задание — ромб с крестом и без кольца, даже если у него есть этапы (docs/ux.md). */}
        {hasSteps && node.status !== 'cancelled' ? (
          <button
            type="button"
            disabled={disabled}
            onClick={() => toggle(node)}
            aria-label={checkLabel}
            className="grid size-11 shrink-0 place-items-center rounded-full outline-none focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50"
          >
            <ProgressRing
              done={done ? quest.progress.total : quest.progress.done}
              total={quest.progress.total}
              muted={quest.locked}
            />
          </button>
        ) : (
          <Checkbox
            checked={done}
            cancelled={node.status === 'cancelled'}
            disabled={disabled}
            onCheckedChange={() => toggle(node)}
            aria-label={checkLabel}
          />
        )}
        <button
          type="button"
          onClick={expanded ? () => openDetails(node.id) : onToggleExpanded}
          // В раскрытом виде кнопка уже не сворачивает, а открывает детали — aria-expanded только у шеврона.
          aria-label={withMarker(expanded ? ru.line.openDetails(node.title) : ru.line.expand(node.title))}
          className={cn(
            'min-h-11 min-w-0 flex-1 py-2 text-left leading-snug font-medium outline-none focus-visible:outline-2 focus-visible:outline-ring',
            (done || quest.locked) && 'text-muted-foreground',
          )}
        >
          <span
            className={cn(
              'block break-words',
              done && 'line-through decoration-gold-dim',
              node.status === 'cancelled' && 'line-through',
            )}
          >
            {node.title}
          </span>
          {quest.isActive && (
            <span aria-hidden className="mt-0.5 flex items-center gap-1.25 text-xs font-normal text-gold-text">
              <FlagIcon className="size-3.5" />
              {ru.line.activeMarker}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={onToggleExpanded}
          aria-expanded={expanded}
          aria-controls={stepsId}
          aria-label={expanded ? ru.line.collapse(node.title) : ru.line.expand(node.title)}
          className="grid size-11 shrink-0 place-items-center rounded-full text-muted-foreground outline-none focus-visible:outline-2 focus-visible:outline-ring"
        >
          <ChevronRightIcon className={cn('size-4 transition-transform', expanded && 'rotate-90')} />
        </button>
      </div>

      {expanded && (
        // Этапы — на пунктирной золотой нити под кольцом задания.
        <div id={stepsId} className="mb-1 ml-5 border-l border-dashed border-border-strong pl-1.5">
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
