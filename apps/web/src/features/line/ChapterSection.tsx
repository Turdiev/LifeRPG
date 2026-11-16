import { ChevronRight, Flag, Pause } from 'lucide-react';
import { percent } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';
import { ru } from '@/shared/strings/ru';
import { Progress } from '@/shared/ui/progress';
import { DoneGroup } from './DoneGroup';
import { InlineAdd } from './InlineAdd';
import { isPending } from './line-actions';
import type { ChapterView } from './line-model';
import { NodeMenu } from './NodeMenu';
import { QuestRow } from './QuestRow';

type ChapterSectionProps = {
  chapter: ChapterView;
  open: boolean;
  onToggle: () => void;
  isQuestExpanded: (id: string) => boolean;
  onToggleQuest: (id: string) => void;
};

/** Глава — раскрываемая секция с прогрессом и счётчиком «3 / 8» (docs/ux.md). */
export function ChapterSection({ chapter, open, onToggle, isQuestExpanded, onToggleQuest }: ChapterSectionProps) {
  const { node, progress } = chapter;
  const muted = chapter.locked || node.status === 'done';
  const Icon = node.status === 'paused' ? Pause : Flag;
  const contentId = `chapter-${node.id}`;

  return (
    // Секция без рамки (docs/ux.md: «раскрываемая секция»): главы отделяет разделитель списка в LinePage.
    <section className="py-1">
      <div className="-mr-2 flex items-center gap-1">
        {/* Не type-heading: глава — пункт списка под заголовком цели, в 20 px она спорила бы с ним. */}
        <h2 className="min-w-0 flex-1 text-base font-semibold">
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={open}
            aria-controls={contentId}
            className="flex min-h-12 w-full items-center gap-2 rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ChevronRight className={cn('size-4 shrink-0 transition-transform', open && 'rotate-90')} aria-hidden />
            <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <span
              className={cn(
                'min-w-0 flex-1 break-words',
                muted && 'text-muted-foreground',
                node.status === 'cancelled' && 'line-through',
              )}
            >
              {node.title}
            </span>
            <span className="shrink-0 text-sm font-normal tabular-nums text-muted-foreground">
              {ru.line.questCount(chapter.questCount.done, chapter.questCount.total)}
            </span>
          </button>
        </h2>
        <NodeMenu node={node} locked={chapter.branchLocked} />
      </div>
      <Progress
        value={percent(progress)}
        aria-label={ru.line.progressLabel(node.title)}
        className="mb-3"
        indicatorClassName={chapter.locked ? 'bg-muted-foreground/50' : undefined}
      />

      {open && (
        <div id={contentId} className="pb-2 pl-2">
          {chapter.quests.items.map((quest) => (
            <QuestRow
              key={quest.node.id}
              quest={quest}
              expanded={isQuestExpanded(quest.node.id)}
              onToggleExpanded={() => onToggleQuest(quest.node.id)}
            />
          ))}
          <DoneGroup count={chapter.quests.done.length}>
            {chapter.quests.done.map((quest) => (
              <QuestRow
                key={quest.node.id}
                quest={quest}
                expanded={isQuestExpanded(quest.node.id)}
                onToggleExpanded={() => onToggleQuest(quest.node.id)}
              />
            ))}
          </DoneGroup>
          {!chapter.locked && !isPending(node) && (
            <InlineAdd parentId={node.id} kind="quest" />
          )}
        </div>
      )}
    </section>
  );
}
