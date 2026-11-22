import { DomainError, parseQuestList, type DraftKind, type ParsedList } from '@life-rpg/domain';
import { Link, useNavigate } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { ApiError } from '@/shared/api/client';
import { useDelayedFlag } from '@/shared/hooks/use-delayed-flag';
import { daysOverdue, formatDeadline, isOverdue, localToday, percent } from '@/shared/lib/format';
import { plural } from '@/shared/lib/plural';
import { cn } from '@/shared/lib/utils';
import { ru } from '@/shared/strings/ru';
import { Button } from '@/shared/ui/button';
import { BackIcon } from '@/shared/ui/icons';
import { Skeleton } from '@/shared/ui/skeleton';
import { ChapterSection } from './ChapterSection';
import { DoneGroup } from './DoneGroup';
import { InlineAdd } from './InlineAdd';
import { LineActionsContext, type LineActions } from './line-actions';
import { applyStatusLocally, buildLineView, descendantCount, withTempIds, type TreeNode } from './line-model';
import { LineBanner } from './LineBanner';
import { CompleteAllDialog, DeleteNodeDialog, FinishContractDialog } from './LineDialogs';
import { NodeDetailsSheet } from './NodeDetailsSheet';
import { NodeMenu } from './NodeMenu';
import { PastePreviewDialog } from './PastePreviewDialog';
import { QuestRow } from './QuestRow';
import { SegmentedProgress } from './SegmentedProgress';
import {
  useCreateBatch,
  useCreateNode,
  useDeleteNode,
  useLineTree,
  useNodeStatus,
  useSchedule,
  useSetActiveQuest,
  useUpdateNode,
} from './use-line';

export function LinePage({ lineId, detailsId }: { lineId: string; detailsId: string | undefined }) {
  const navigate = useNavigate({ from: '/line/$lineId' });
  const tree = useLineTree(lineId);
  const status = useNodeStatus(lineId);
  const schedule = useSchedule(lineId);
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
  const [finishing, setFinishing] = useState<TreeNode | null>(null);
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
    const after = applyStatusLocally(tree.data, node.id, 'complete', new Date().toISOString(), {
      withChildren,
      today,
    });
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
    askFinish: (node) => setFinishing(node),
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
  // Пауза не отменяет срок — как в карточке журнала; у отменённой и достигнутой цели срока больше нет.
  const overdue = (line.status === 'open' || line.status === 'paused') && isOverdue(line.deadline, today);
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
      <div className="space-y-3">
        <header className="-mx-2 flex min-h-13 items-center gap-1.5">
          <BackLink />
          <h1 className={cn('min-w-0 flex-1 text-center type-heading break-words', lineLocked && 'text-muted-foreground')}>
            {line.title}
          </h1>
          <NodeMenu node={line} locked={false} />
        </header>

        {/* Шапка цели — единственная карточка с золотыми уголками на этом экране. */}
        {/* Без своей подписи: шкала внутри уже называется «Прогресс …», иначе скринридер прочтёт её дважды. */}
        <section className="panel ornate relative px-4 pt-3.5 pb-3">
          <div className="mb-1.5 flex items-baseline justify-between gap-3">
            <span className="font-heading text-[2.5rem] leading-none tabular-nums tracking-[0.02em] text-gold-text">
              {ru.journal.progress(percent(view.progress))}
            </span>
            {line.deadline && (
              <span
                className={cn(
                  'text-right text-[0.8125rem] text-muted-foreground',
                  overdue && 'font-medium text-overdue',
                )}
              >
                {/* Та же фраза, что в журнале: «Срок прошёл N дней назад» вместо даты. */}
                {overdue
                  ? ru.journal.overdue(daysOverdue(line.deadline, today), plural(daysOverdue(line.deadline, today), ru.journal.overdueNoun))
                  : ru.journal.deadline(formatDeadline(line.deadline, today))}
              </span>
            )}
          </div>
          <SegmentedProgress
            segments={view.segments}
            lineId={line.id}
            value={percent(view.progress)}
            label={ru.line.progressLabel(line.title)}
            muted={lineLocked}
            labels
          />
        </section>

        <LineBanner line={line} today={today} />

        {isEmpty && !lineLocked && <p className="text-muted-foreground">{ru.line.empty}</p>}

        {/* Главы — секции-панели, задания — строки внутри, этапы — на пунктирной нити (docs/ux.md,
            «Решения по UX»). Уголков у глав нет: они остаются у шапки цели. */}
        <div className="space-y-3">
          {view.chapters.items.map(chapterSection)}
          <DoneGroup count={view.chapters.done.length} className="px-0">
            <div className="space-y-3">{view.chapters.done.map(chapterSection)}</div>
          </DoneGroup>
          {view.quests.items.length + view.quests.done.length > 0 && (
            <div className="panel px-3.5 pb-1">
              {view.quests.items.map(questRow)}
              <DoneGroup count={view.quests.done.length}>{view.quests.done.map(questRow)}</DoneGroup>
            </div>
          )}
        </div>

        {!lineLocked && (
          <div className="space-y-2 pt-1">
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
        onSchedule={(id, body) => schedule.mutate({ id, body, enabling: detailsNode?.schedule === null })}
        scheduling={schedule.isPending}
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
      {finishing && (
        <FinishContractDialog
          marked={tree.data.nodes.filter((n) => n.parentId === finishing.id && n.status === 'done').length}
          total={tree.data.nodes.filter((n) => n.parentId === finishing.id && n.status !== 'cancelled').length}
          onOpenChange={(open) => !open && setFinishing(null)}
          onConfirm={() => {
            status.mutate({ node: finishing, action: 'finish' });
            setFinishing(null);
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
      aria-label={ru.line.back}
      className="grid size-11 shrink-0 place-items-center rounded-full text-foreground outline-none hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-ring"
    >
      <BackIcon />
    </Link>
  );
}

function LineSkeleton() {
  return (
    <div className="space-y-4" aria-hidden>
      <Skeleton className="h-8 w-2/3" />
      <Skeleton className="h-24" />
      <Skeleton className="h-14" />
      <Skeleton className="h-14" />
      <Skeleton className="h-14" />
    </div>
  );
}
