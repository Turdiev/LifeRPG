import { buildTree, canBeActive, isBranchLocked } from '@life-rpg/domain';
import { XIcon } from 'lucide-react';
import { useEffect, useEffectEvent, useRef, useState, type ReactNode } from 'react';
import { useIsDesktop } from '@/shared/hooks/use-media-query';
import { ru } from '@/shared/strings/ru';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/shared/ui/sheet';
import { Textarea } from '@/shared/ui/textarea';
import { isPending, useLineActions } from './line-actions';
import type { TreeNode } from './line-model';

type NodeDetailsSheetProps = {
  node: TreeNode | undefined;
  nodes: readonly TreeNode[];
  activeQuestId: string | null;
  onClose: () => void;
  onSave: (id: string, body: FieldsBody) => void;
  onMakeActive: (id: string) => void;
};

/**
 * Детали открываются по адресу `?quest=` — работают «Назад» и ссылки (tech-spec, «Маршруты»).
 * Правка на месте, сохранение при потере фокуса (docs/ux.md, «Взаимодействия»). На телефоне —
 * лист снизу, на компьютере — панель справа от дерева (docs/ux.md, «Карта экранов»).
 */
export function NodeDetailsSheet({ node, nodes, activeQuestId, onClose, onSave, onMakeActive }: NodeDetailsSheetProps) {
  const isDesktop = useIsDesktop();
  // key пересоздаёт поля, когда детали переключают на другой узел.
  const details = (variant: DetailsVariant, current: TreeNode) => (
    <Details
      key={current.id}
      variant={variant}
      node={current}
      nodes={nodes}
      activeQuestId={activeQuestId}
      onSave={onSave}
      onMakeActive={onMakeActive}
    />
  );

  if (isDesktop) return node ? <DetailsPanel key={node.id} onClose={onClose}>{details('panel', node)}</DetailsPanel> : null;
  return (
    <Sheet open={node !== undefined} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="mx-auto max-h-[90dvh] max-w-[640px] overflow-y-auto rounded-t-xl">
        {node && details('sheet', node)}
      </SheetContent>
    </Sheet>
  );
}

/**
 * Немодальная панель: дерево рядом остаётся доступным. `data-details-panel` — сигнал корневому
 * layout освободить под панель место справа. Фокус переходит в панель при открытии и возвращается
 * туда, откуда её открыли, — как у листа, где это делает Radix.
 */
function DetailsPanel({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  // Ref, а не локальная переменная эффекта: в StrictMode эффект запускается дважды, и второй
  // запуск увидел бы фокус уже в самой панели.
  const opener = useRef<Element | null>(null);
  useEffect(() => {
    opener.current ??= document.activeElement;
    ref.current?.focus();
    return () => {
      // Esc, «Закрыть» или «Назад» уносят фокус вместе с панелью. Если пользователь сам кликнул
      // в дерево (переключение на другой узел), фокус уже там — не трогаем.
      if (document.activeElement !== document.body) return;
      if (opener.current instanceof HTMLElement && opener.current.isConnected) opener.current.focus();
    };
  }, []);
  return (
    <aside
      ref={ref}
      data-details-panel
      tabIndex={-1}
      aria-labelledby={DETAILS_TITLE_ID}
      onKeyDown={(event) => event.key === 'Escape' && onClose()}
      className="fixed inset-y-0 right-0 z-30 flex w-80 flex-col gap-4 overflow-y-auto border-l bg-popover pt-4 text-sm text-popover-foreground outline-none"
    >
      {children}
      <Button variant="ghost" size="icon" className="absolute top-3 right-3" onClick={onClose}>
        <XIcon aria-hidden />
        <span className="sr-only">{ru.common.close}</span>
      </Button>
    </aside>
  );
}

const DETAILS_TITLE_ID = 'node-details-title';
type DetailsVariant = 'sheet' | 'panel';
type FieldsBody = { title?: string; description?: string | null; deadline?: string | null };

type DetailsProps = Omit<NodeDetailsSheetProps, 'onClose' | 'node'> & { node: TreeNode; variant: DetailsVariant };

function Details({ node, nodes, activeQuestId, onSave, onMakeActive, variant }: DetailsProps) {
  const { run, askDelete } = useLineActions();
  const [title, setTitle] = useState(node.title);
  const [description, setDescription] = useState(node.description ?? '');
  const [deadline, setDeadline] = useState(node.deadline ?? '');
  const tree = buildTree(nodes);
  const branchLocked = isBranchLocked(tree, node.id);
  // Правка в замороженной ветке — 409 по правилу 3; несохранённый узел сервер ещё не знает.
  const readOnly = branchLocked || isPending(node);
  const path = ancestorsTitles(nodes, node);

  function save() {
    if (readOnly) return;
    const body: FieldsBody = {};
    const trimmedTitle = title.trim();
    if (trimmedTitle && trimmedTitle !== node.title) body.title = trimmedTitle;
    const trimmedDescription = description.trim();
    if (trimmedDescription !== (node.description ?? '')) body.description = trimmedDescription || null;
    if (deadline !== (node.deadline ?? '')) body.deadline = deadline || null;
    if (Object.keys(body).length > 0) onSave(node.id, body);
  }

  // Esc и «Назад» закрывают лист без потери фокуса — несохранённое дописываем при закрытии.
  const saveOnClose = useEffectEvent(save);
  useEffect(() => () => saveOnClose(), []);

  const canPause = !readOnly && (node.kind === 'line' || node.kind === 'chapter');
  const showMakeActive =
    !isPending(node) && node.kind === 'quest' && node.id !== activeQuestId && canBeActive(tree, node.id);

  const meta = (
    <>
      {ru.line.details.kind[node.kind]}
      {path.length > 0 && <span className="block">{path.join(' › ')}</span>}
    </>
  );

  return (
    <>
      {/* Заголовок листа — часть Radix Dialog и вне диалога не работает; у панели — обычный header. */}
      {variant === 'sheet' ? (
        <SheetHeader>
          <SheetDescription>{meta}</SheetDescription>
          <SheetTitle className="sr-only">{node.title}</SheetTitle>
        </SheetHeader>
      ) : (
        <header className="px-4 pr-14 text-muted-foreground">
          <h2 id={DETAILS_TITLE_ID} className="sr-only">
            {node.title}
          </h2>
          <p>{meta}</p>
        </header>
      )}

      <div className="grid gap-4 px-4 pb-4">
        <div className="grid gap-2">
          <Label htmlFor="node-title">{ru.line.details.title}</Label>
          <Input
            id="node-title"
            value={title}
            maxLength={120}
            readOnly={readOnly}
            onChange={(event) => setTitle(event.target.value)}
            onBlur={() => (title.trim() ? save() : setTitle(node.title))}
            onKeyDown={(event) => event.key === 'Enter' && event.currentTarget.blur()}
            className="h-11 font-heading text-xl"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="node-description">{ru.line.details.description}</Label>
          <Textarea
            id="node-description"
            value={description}
            rows={3}
            readOnly={readOnly}
            placeholder={ru.line.details.descriptionPlaceholder}
            onChange={(event) => setDescription(event.target.value)}
            onBlur={save}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="node-deadline">{ru.line.details.deadline}</Label>
          {/* Не onChange: при наборе года браузер шлёт промежуточные даты вроде 0002-05-01. */}
          <Input
            id="node-deadline"
            type="date"
            value={deadline}
            readOnly={readOnly}
            onChange={(event) => setDeadline(event.target.value)}
            onBlur={save}
            className="h-11 w-fit"
          />
        </div>

        {!isPending(node) && (
          <div className="grid gap-2 pt-2">
            {showMakeActive && <Button onClick={() => onMakeActive(node.id)}>{ru.line.actions.makeActive}</Button>}
            {canPause && node.status === 'open' && (
              <Button variant="outline" onClick={() => run(node, 'pause')}>
                {ru.line.actions.pause}
              </Button>
            )}
            {canPause && node.status === 'paused' && (
              <Button variant="outline" onClick={() => run(node, 'resume')}>
                {ru.line.actions.resume}
              </Button>
            )}
            {!branchLocked && node.status !== 'cancelled' && node.status !== 'done' && (
              <Button variant="outline" onClick={() => run(node, 'cancel')}>
                {ru.line.actions.cancel}
              </Button>
            )}
            {!branchLocked && node.status === 'cancelled' && (
              <Button variant="outline" onClick={() => run(node, 'restore')}>
                {ru.line.actions.restore}
              </Button>
            )}
            <Button variant="destructive" onClick={() => askDelete(node)}>
              {ru.line.actions.delete}
            </Button>
          </div>
        )}
      </div>
    </>
  );
}

function ancestorsTitles(nodes: readonly TreeNode[], node: TreeNode): string[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const titles: string[] = [];
  let parent = node.parentId ? byId.get(node.parentId) : undefined;
  while (parent) {
    titles.unshift(parent.title);
    parent = parent.parentId ? byId.get(parent.parentId) : undefined;
  }
  return titles;
}
