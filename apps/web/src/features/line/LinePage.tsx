import { DomainError, parseQuestList, type DraftKind, type ParsedList } from '@life-rpg/domain';
import { Link, useNavigate } from '@tanstack/react-router';
import { ChevronLeft, Scroll } from 'lucide-react';
import { useMemo, useState } from 'react';
import { ApiError } from '@/shared/api/client';
import { useDelayedFlag } from '@/shared/hooks/use-delayed-flag';
import { formatDeadline, isOverdue, localToday, percent } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';
import { ru } from '@/shared/strings/ru';
import { Button } from '@/shared/ui/button';
import { Skeleton } from '@/shared/ui/skeleton';
import { ChapterSection } from './ChapterSection';
import { DoneGroup } from './DoneGroup';
import { InlineAdd } from './InlineAdd';
import { LineActionsContext, type LineActions } from './line-actions';
import { applyStatusLocally, buildLineView, descendantCount, withTempIds, type TreeNode } from './line-model';
import { LineBanner } from './LineBanner';
import { CompleteAllDialog, DeleteNodeDialog } from './LineDialogs';
import { NodeDetailsSheet } from './NodeDetailsSheet';
import { NodeMenu } from './NodeMenu';
import { PastePreviewDialog } from './PastePreviewDialog';
import { QuestRow } from './QuestRow';
import { SegmentedProgress } from './SegmentedProgress';
import { useCreateBatch, useCreateNode, useDeleteNode, useLineTree, useNodeStatus, useSetActiveQuest, useUpdateNode } from './use-line';

export function LinePage({ lineId, detailsId }: { lineId: string; detailsId: string | undefined }) {
  const navigate = useNavigate({ from: '/line/$lineId' });
  const tree = useLineTree(lineId);
  const status = useNodeStatus(lineId);
  const createNode = useCreateNode(lineId);
  const createBatch = useCreateBatch(lineId);
  const updateNode = useUpdateNode(lineId);
  const deleteNode = useDeleteNode(lineId);
  const setActive = useSetActiveQuest(lineId);
  const showSkeleton = useDelayedFlag(tree.isPending, 300);

  // Отмеченное сейчас остаётся на месте с галочкой — иначе элемент исчез бы в «Выполнено»
  // в момент касания, и отклика «галочка» пользователь не увидел бы (docs/ux.md).
  const [justDone, setJustDone] = useState<ReadonlySet<string>>(new Set());
  const view = useMemo(
    () => (tree.data ? buildLineView(tree.data.nodes, tree.data.activeQuestId, justDone) : null),
    [tree.data, justDone],
  );
  const [openChapters, setOpenChapters] = useState<Set<string> | null>(null);
  const [expandedQuests, setExpandedQuests] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState<TreeNode | null>(null);
  const [completingAll, setCompletingAll] = useState<TreeNode | null>(null);
  const [pasted, setPasted] = useState<{
    parentId: string;
    kind: DraftKind;
    parsed: ParsedList;
    returnFocus: HTMLElement;
  } | null>(null);
  const today = localToday();

  // Пока пользователь ничего не раскрывал, открыта глава с активным квестом (docs/ux.md).
  const chaptersOpen = openChapters ?? new Set(view?.defaultOpenChapterId ? [view.defaultOpenChapterId] : []);
  const toggleIn = (set: Set<string>, id: string) => {
    const next = new Set(set);
    if (!next.delete(id)) next.add(id);
    return next;
  };

  // Всё, что отметка закроет (сам узел и предки по каскаду), остаётся видимым на месте.
  const complete = (node: TreeNode, withChildren: boolean) => {
    if (!tree.data) return;
    const before = new Map(tree.data.nodes.map((n) => [n.id, n.status]));
    const after = applyStatusLocally(tree.data, node.id, 'complete', new Date().toISOString(), { withChildren });
    const closed = after.nodes.filter((n) => n.status === 'done' && before.get(n.id) !== 'done').map((n) => n.id);
    setJustDone((set) => new Set([...set, ...closed]));
    status.mutate({ node, action: 'complete', withChildren });
  };

  const actions: LineActions = {
    toggle: (node) => {
      if (node.status === 'done') return status.mutate({ node, action: 'reopen' });
      try {
        complete(node, false);
      } catch (error) {
        // Задание с открытыми этапами: сначала спрашиваем, потом отправляем (правило 4).
        if (error instanceof DomainError && error.code === 'has_open_children') setCompletingAll(node);
      }
    },
    run: (node, action) => status.mutate({ node, action }),
    create: (draft) => createNode.mutate({ ...draft, id: `temp-${crypto.randomUUID()}` }),
    pasteList: (parentId, kind, text, returnFocus) =>
      setPasted({ parentId, kind, parsed: parseQuestList(text, kind), returnFocus }),
    // Несохранённый узел сервер ещё не знает: его детали откроются после ответа.
    openDetails: (id) => !id.startsWith('temp-') && void navigate({ search: { quest: id } }),
    askDelete: (node) => setDeleting(node),
  };

  if (tree.isPending) return showSkeleton ? <LineSkeleton /> : null;
  const notFound = tree.error instanceof ApiError && tree.error.status === 404;
  // Неудачный фоновый перезапрос при данных в кеше не выкидывает из дерева; 404 — линию удалили.
  if (!tree.data || !view || notFound) {
    return (
      <div className="space-y-4">
        <BackLink />
        <p>{notFound ? ru.line.notFound : ru.line.loadError}</p>
        {!notFound && (
          <Button variant="outline" onClick={() => void tree.refetch()}>
            {ru.line.retry}
          </Button>
        )}
      </div>
    );
  }

  const { line } = view;
  const lineLocked = line.status === 'paused' || line.status === 'cancelled';
  const isEmpty =
    view.chapters.items.length + view.chapters.done.length + view.quests.items.length + view.quests.done.length === 0;
  const questRow = (quest: (typeof view.quests.items)[number]) => (
    <QuestRow
      key={quest.node.id}
      quest={quest}
      expanded={expandedQuests.has(quest.node.id)}
      onToggleExpanded={() => setExpandedQuests((set) => toggleIn(set, quest.node.id))}
    />
  );
  const chapterSection = (chapter: (typeof view.chapters.items)[number]) => (
    <ChapterSection
      key={chapter.node.id}
      chapter={chapter}
      open={chaptersOpen.has(chapter.node.id)}
      onToggle={() => setOpenChapters(toggleIn(chaptersOpen, chapter.node.id))}
      isQuestExpanded={(id) => expandedQuests.has(id)}
      onToggleQuest={(id) => setExpandedQuests((set) => toggleIn(set, id))}
    />
  );
  const detailsNode = detailsId ? tree.data.nodes.find((node) => node.id === detailsId) : undefined;

  return (
    <LineActionsContext.Provider value={actions}>
      <div className="space-y-5">
        <BackLink />

        <header className="space-y-3">
          <div className="flex items-start gap-2">
            <Scroll className="mt-1.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
            <h1 className={cn('min-w-0 flex-1 text-2xl break-words', lineLocked && 'text-muted-foreground')}>
              {line.title}
            </h1>
            <NodeMenu node={line} locked={false} className="-mt-1.5 -mr-2" />
          </div>
          <div className="flex items-center gap-3">
            <SegmentedProgress
              segments={view.segments}
              lineId={line.id}
              value={percent(view.progress)}
              label={ru.line.progressLabel(line.title)}
              muted={lineLocked}
            />
            <span className="w-10 text-right text-sm tabular-nums text-muted-foreground">
              {ru.journal.progress(percent(view.progress))}
            </span>
          </div>
          {line.deadline && (
            <p
              className={cn(
                'text-sm text-muted-foreground',
                !lineLocked && line.status !== 'done' && isOverdue(line.deadline, today) && 'font-medium text-overdue',
              )}
            >
              {ru.journal.deadline(formatDeadline(line.deadline, today))}
            </p>
          )}
        </header>

        <LineBanner line={line} today={today} />

        {isEmpty && !lineLocked && <p className="text-muted-foreground">{ru.line.empty}</p>}

        <div className="space-y-3">
          {view.chapters.items.map(chapterSection)}
          <DoneGroup count={view.chapters.done.length}>
            <div className="space-y-3">{view.chapters.done.map(chapterSection)}</div>
          </DoneGroup>
        </div>

        {view.quests.items.length + view.quests.done.length > 0 && (
          <div className="rounded-xl border bg-card px-1 py-1">
            {view.quests.items.map(questRow)}
            <DoneGroup count={view.quests.done.length}>{view.quests.done.map(questRow)}</DoneGroup>
          </div>
        )}

        {!lineLocked && (
          <div>
            <InlineAdd parentId={line.id} kind="chapter" />
            <InlineAdd parentId={line.id} kind="quest" />
          </div>
        )}
      </div>

      <NodeDetailsSheet
        node={detailsNode}
        nodes={tree.data.nodes}
        activeQuestId={tree.data.activeQuestId}
        onClose={() => void navigate({ search: {}, replace: true })}
        onSave={(id, body) => updateNode.mutate({ id, body })}
        onMakeActive={(questId) => setActive.mutate({ questId })}
      />
      {deleting && (
        <DeleteNodeDialog
          node={deleting}
          descendants={descendantCount(tree.data.nodes, deleting.id)}
          onOpenChange={(open) => !open && setDeleting(null)}
          onConfirm={() => {
            setDeleting(null);
            if (deleting.id === line.id) {
              // Сначала уходим в журнал: без линии экрану нечего показывать.
              void navigate({ to: '/journal', search: { status: 'open' } });
              deleteNode.mutate({ node: deleting });
              return;
            }
            if (deleting.id === detailsId) void navigate({ search: {}, replace: true });
            deleteNode.mutate({ node: deleting });
          }}
        />
      )}
      {pasted && (
        <PastePreviewDialog
          kind={pasted.kind}
          parsed={pasted.parsed}
          returnFocus={pasted.returnFocus}
          onCancel={() => setPasted(null)}
          onCreate={() => {
            createBatch.mutate({ parentId: pasted.parentId, kind: pasted.kind, drafts: withTempIds(pasted.parsed.drafts) });
            setPasted(null);
          }}
        />
      )}
      {completingAll && (
        <CompleteAllDialog
          node={completingAll}
          openSteps={tree.data.nodes.filter((n) => n.parentId === completingAll.id && n.status === 'open').length}
          onOpenChange={(open) => !open && setCompletingAll(null)}
          onConfirm={() => {
            complete(completingAll, true);
            setCompletingAll(null);
          }}
        />
      )}
    </LineActionsContext.Provider>
  );
}

function BackLink() {
  return (
    <Link
      to="/journal"
      search={{ status: 'open' }}
      className="-ml-2 inline-flex h-11 items-center gap-1 rounded-lg px-2 text-sm text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <ChevronLeft className="size-4" aria-hidden />
      {ru.line.back}
    </Link>
  );
}

function LineSkeleton() {
  return (
    <div className="space-y-4" aria-hidden>
      <Skeleton className="h-8 w-2/3" />
      <Skeleton className="h-2.5" />
      <Skeleton className="h-24 rounded-xl" />
      <Skeleton className="h-24 rounded-xl" />
    </div>
  );
}
