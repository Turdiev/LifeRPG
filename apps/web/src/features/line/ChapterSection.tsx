import { percent } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';
import { ru } from '@/shared/strings/ru';
import { ChapterIcon, ChevronRightIcon, PauseIcon } from '@/shared/ui/icons';
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
  const Icon = node.status === 'paused' ? PauseIcon : ChapterIcon;
  // Своя отмена — серым; заморозка от предка или своя пауза — холодной штриховкой (docs/ux.md).
  const tone = node.status === 'cancelled' ? 'cancelled' : chapter.locked ? 'paused' : 'active';
  const contentId = `chapter-${node.id}`;

  return (
    // Секция-панель (docs/ux.md: «раскрываемая секция»): заголовок, тонкая шкала, задания строками.
    <section className="panel px-3.5 pb-1.5">
      <div className="-mr-2 flex items-center gap-1">
        {/* Глава — пункт под шапкой цели: 19 px, мельче названия цели. */}
        <h2 className="min-w-0 flex-1 type-chapter">
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={open}
            aria-controls={contentId}
            className="flex min-h-14 w-full items-center gap-2.5 text-left outline-none focus-visible:outline-2 focus-visible:outline-ring"
          >
            <Icon className={tone === 'active' ? 'text-gold' : tone === 'paused' ? 'text-paused' : 'text-muted-foreground'} />
            <span
              className={cn(
                'min-w-0 flex-1 break-words',
                muted && 'text-muted-foreground',
                node.status === 'done' && 'line-through decoration-gold-dim',
                node.status === 'cancelled' && 'line-through',
              )}
            >
              {node.title}
            </span>
            <span className="shrink-0 font-sans text-[0.8125rem] tracking-normal tabular-nums text-muted-foreground">
              {ru.line.questCount(chapter.questCount.done, chapter.questCount.total)}
            </span>
            <ChevronRightIcon className={cn('size-4 text-muted-foreground transition-transform', open && 'rotate-90')} />
          </button>
        </h2>
        <NodeMenu node={node} locked={chapter.branchLocked} />
      </div>
      <Progress
        value={percent(progress)}
        aria-label={ru.line.progressLabel(node.title)}
        className="mb-1 h-0.75 border-0"
        tone={tone}
      />

      {open && (
        <div id={contentId}>
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
