import { Link, useLocation } from '@tanstack/react-router';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { LineFormSheet } from '@/features/journal/LineFormSheet';
import type { TreeNode } from '@/features/line/line-model';
import { useNodeStatus } from '@/features/line/use-line';
import { useDelayedFlag } from '@/shared/hooks/use-delayed-flag';
import { useIsDesktop } from '@/shared/hooks/use-media-query';
import { ru } from '@/shared/strings/ru';
import { Button } from '@/shared/ui/button';
import { Skeleton } from '@/shared/ui/skeleton';
import { PickQuest } from './PickQuest';
import { QuestCard } from './QuestCard';
import { NextQuestCard } from './NextQuestCard';
import { buildTodayView, closedByComplete, greeting, nextQuestView, todayState, type TodayState } from './today-model';
import { GoalLink, TodayLines } from './TodayLines';
import { useActiveLineTree, useTakeQuest, useToday } from './use-today';

type QuestRef = { questId: string; lineId: string };

export function TodayPage() {
  const today = useToday();
  const take = useTakeQuest();
  const showSkeleton = useDelayedFlag(today.isPending, 300);
  // Квест, закрытый на этом экране: сервер снимает его с активных, а карточка остаётся
  // с галочками, пока не появится новый активный квест или пользователь не уйдёт с экрана.
  const [closed, setClosed] = useState<QuestRef | null>(null);
  // Квест, который взяли кнопкой на этом экране: кнопка исчезает вместе со старой карточкой,
  // поэтому фокус переходит на заголовок новой.
  const [takenId, setTakenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  // На телефоне уход с экрана размонтирует его вместе с карточкой; постоянная колонка на компьютере
  // сбрасывает её при переходе в соседней колонке — поведение раскладок одно.
  const pathname = useLocation({ select: (location) => location.pathname });
  const [visitPath, setVisitPath] = useState(pathname);
  if (pathname !== visitPath) {
    setVisitPath(pathname);
    setClosed(null);
  }

  if (today.isPending) return showSkeleton ? <TodaySkeleton /> : null;
  // Неудачный фоновый перезапрос при данных в кеше экран не прячет.
  if (!today.data) {
    return (
      <div className="space-y-4">
        <TodayHeader />
        <p>{ru.today.loadError}</p>
        <Button variant="outline" onClick={() => void today.refetch()}>
          {ru.today.retry}
        </Button>
      </div>
    );
  }

  const data = today.data;
  const active = data.active && { questId: data.active.questId, lineId: data.active.lineId };
  // Новый активный квест (взятый здесь, через «Повторить» в тосте или на другом экране) важнее
  // закрытого. Состояние правится прямо в рендере, без эффекта — как `watch` во Vue, но без
  // лишнего кадра со старой карточкой (React, «Adjusting state when a prop changes»).
  if (active && closed && active.questId !== closed.questId) setClosed(null);
  const shown = active ?? closed;
  const takingId = take.isPending ? take.variables.questId : null;
  const takeQuest = (questId: string, lineId: string) => {
    setTakenId(questId);
    take.mutate({ questId, lineId });
  };
  const noActive = data.active ? null : (
    <NoActiveQuest
      state={todayState(data)}
      data={data}
      takingId={takingId}
      onTake={({ id, lineId }) => takeQuest(id, lineId)}
      onCreate={() => setCreating(true)}
    />
  );

  return (
    <div className="space-y-8">
      <TodayHeader />

      {/* После закрытия квеста карточка сама решает, когда показать «Выбери квест»: сначала — «Следующий квест». */}
      {shown ? (
        <ActiveQuest
          key={shown.questId}
          quest={shown}
          isActive={active?.questId === shown.questId}
          closedHere={closed?.questId === shown.questId}
          onClosed={() => setClosed(shown)}
          takenHere={takenId === shown.questId}
          takingId={takingId}
          onTake={(questId) => takeQuest(questId, shown.lineId)}
          noActive={noActive}
        />
      ) : (
        noActive
      )}

      {/* Цель карточки уже видна под ней строкой прогресса — в списке её не повторяем. */}
      <TodayLines
        title={data.active ? ru.today.otherLines : ru.today.linesInProgress}
        lines={data.otherLines.filter((line) => line.id !== shown?.lineId)}
      />

      <LineFormSheet open={creating} onOpenChange={setCreating} />
    </div>
  );
}

function TodayHeader() {
  // На компьютере «Сегодня» — колонка рядом с журналом или линией: главный заголовок страницы у них.
  const Heading = useIsDesktop() ? 'h2' : 'h1';
  const now = new Date();
  const date = new Intl.DateTimeFormat('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' }).format(now);
  return (
    <header className="space-y-1">
      <p className="text-sm text-muted-foreground first-letter:uppercase">{date}</p>
      <Heading className="text-2xl">{ru.today.greeting[greeting(now.getHours())]}</Heading>
    </header>
  );
}

type ActiveQuestProps = {
  quest: QuestRef;
  /** Сервер считает квест активным (ответ `/today`). */
  isActive: boolean;
  /** Квест закрыт отметкой на этом экране. */
  closedHere: boolean;
  onClosed: () => void;
  /** Квест взят кнопкой на этом экране — фокус на его заголовок. */
  takenHere: boolean;
  takingId: string | null;
  /** Взять следующий квест — он всегда из той же линии. */
  onTake: (questId: string) => void;
  /** «Выбери квест» или пустое состояние; есть, только когда у сервера нет активного квеста. */
  noActive: ReactNode;
};

function ActiveQuest({ quest, isActive, closedHere, onClosed, takenHere, takingId, onTake, noActive }: ActiveQuestProps) {
  const tree = useActiveLineTree(quest.lineId);
  const status = useNodeStatus(quest.lineId);
  // Отмеченное здесь остаётся на месте с галочкой «до следующего открытия экрана» (docs/ux.md,
  // «Решения по UX»). На телефоне экран и так закрывается при переходе; на компьютере колонка
  // постоянная, поэтому «новое открытие» — переход в соседней колонке.
  const [justDone, setJustDone] = useState<ReadonlySet<string>>(new Set());
  const pathname = useLocation({ select: (location) => location.pathname });
  const [donePath, setDonePath] = useState(pathname);
  if (pathname !== donePath) {
    setDonePath(pathname);
    setJustDone(new Set());
  }
  const [choosingOther, setChoosingOther] = useState(false);
  const view = useMemo(
    () => (tree.data ? buildTodayView(tree.data.nodes, quest.questId, justDone) : null),
    [tree.data, quest.questId, justDone],
  );
  // Дерева нет только при ошибке загрузки или если кеш устарел и задание ещё не пришло: ждём перезапрос.
  if (!tree.data || !view) return noActive;
  const data = tree.data;
  // «Пройден» — по статусу в кеше дерева, а не по колбэкам мутации: откат ошибки и «Повторить»
  // меняют кеш, и карточка следует за ним сама.
  const finished = closedHere && view.quest.status === 'done';
  if (!isActive && !finished) return noActive;
  // Откат вернул квест в работу: после «Повторить» снова сначала «Следующий квест».
  if (!finished && choosingOther) setChoosingOther(false);
  const next = finished ? nextQuestView(data.nodes, quest.questId) : null;

  const toggle = (node: TreeNode) => {
    if (node.status === 'done') return status.mutate({ node, action: 'reopen' });
    const closed = closedByComplete(data, node.id, new Date().toISOString());
    setJustDone((set) => new Set([...set, ...closed]));
    if (closed.includes(quest.questId)) onClosed();
    status.mutate({ node, action: 'complete' });
  };

  return (
    <>
      <div className="space-y-2">
        <QuestCard view={view} finished={finished} focusTitle={takenHere} onToggle={toggle} />
        <GoalLink line={view.line} progress={view.lineProgress} />
        {next && !choosingOther && (
          <NextQuestCard
            next={next}
            taking={takingId === next.quest.id}
            onTake={() => onTake(next.quest.id)}
            // Список предложений приходит с ответом `/today` после отметки — до него выбирать не из чего.
            onChooseOther={noActive ? () => setChoosingOther(true) : null}
          />
        )}
      </div>
      {finished && (!next || choosingOther) && (choosingOther ? <FocusOnMount>{noActive}</FocusOnMount> : noActive)}
    </>
  );
}

/** После «Выбрать другой» карточка исчезает — фокус переходит на список, который её сменил. */
function FocusOnMount({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => ref.current?.focus(), []);
  return (
    <div ref={ref} tabIndex={-1} className="outline-none">
      {children}
    </div>
  );
}

type NoActiveQuestProps = {
  state: TodayState;
  data: NonNullable<ReturnType<typeof useToday>['data']>;
  takingId: string | null;
  onTake: (suggestion: { id: string; lineId: string }) => void;
  onCreate: () => void;
};

function NoActiveQuest({ state, data, takingId, onTake, onCreate }: NoActiveQuestProps) {
  if (state === 'pick') return <PickQuest suggestions={data.suggestions} takingId={takingId} onTake={onTake} />;
  if (state === 'first') {
    return (
      <EmptyState title={ru.journal.emptyFirst.title} text={ru.journal.emptyFirst.text}>
        <Button onClick={onCreate}>{ru.journal.emptyFirst.action}</Button>
      </EmptyState>
    );
  }
  if (state === 'noQuests') {
    const line = data.otherLines[0]!;
    return (
      <EmptyState title={ru.today.noQuests.title} text={ru.today.noQuests.text}>
        <Button asChild>
          <Link to="/line/$lineId" params={{ lineId: line.id }}>
            {ru.today.noQuests.action}
          </Link>
        </Button>
      </EmptyState>
    );
  }
  const copy = state === 'allPaused' ? ru.today.allPaused : ru.today.nothingOpen;
  // Журнал открывается на фильтре, где цели есть: фильтр «В работе» здесь заведомо пуст.
  const filter = state === 'allPaused' ? 'paused' : data.counts.done > 0 ? 'done' : 'cancelled';
  return (
    <EmptyState title={copy.title} text={copy.text}>
      <Button asChild variant="outline">
        <Link to="/journal" search={{ status: filter }}>
          {ru.today.openJournal}
        </Link>
      </Button>
    </EmptyState>
  );
}

function EmptyState({ title, text, children }: { title: string; text: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl">{title}</h2>
      <p className="max-w-[46ch] text-muted-foreground">{text}</p>
      {children}
    </section>
  );
}

function TodaySkeleton() {
  return (
    <div className="space-y-8" aria-hidden>
      <div className="space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-7 w-48" />
      </div>
      <Skeleton className="h-56 rounded-xl" />
      <Skeleton className="h-24 rounded-xl" />
    </div>
  );
}
