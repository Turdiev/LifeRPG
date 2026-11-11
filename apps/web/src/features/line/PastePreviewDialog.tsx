import { countDrafts, kindAtDepth, type DraftKind, type ParsedList, type QuestDraft } from '@life-rpg/domain';
import { BATCH_MAX } from '@life-rpg/shared';
import { Flag, ListChecks, Swords } from 'lucide-react';
import { ru } from '@/shared/strings/ru';
import { Button } from '@/shared/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog';
import { pasteSummary } from './paste-summary';

type PastePreviewDialogProps = {
  kind: DraftKind;
  parsed: ParsedList;
  returnFocus: HTMLElement;
  onCancel: () => void;
  onCreate: () => void;
};

const icons = { chapter: Flag, quest: Swords, step: ListChecks } as const;

/** Предпросмотр «Будет создано: …» перед созданием (docs/ux.md); в v2 его же заполнит ИИ. */
export function PastePreviewDialog({ kind, parsed, returnFocus, onCancel, onCreate }: PastePreviewDialogProps) {
  const count = countDrafts(parsed.drafts, kind);
  const tooMany = count.total > BATCH_MAX;

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      {/* Предупреждения — часть описания: скринридер зачитает их при открытии. */}
      <DialogContent
        aria-describedby="paste-description paste-warnings"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          returnFocus.focus();
        }}
        className="max-h-[85dvh] grid-rows-[auto_minmax(0,1fr)_auto]"
      >
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">{pasteSummary(count)}</DialogTitle>
          <DialogDescription id="paste-description">{ru.paste.description}</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 space-y-3 overflow-y-auto">
          {(parsed.flattened || parsed.truncated || tooMany) && (
            <ul id="paste-warnings" className="space-y-1 text-sm text-overdue">
              {parsed.flattened && <li>{ru.paste.flattened}</li>}
              {parsed.truncated && <li>{ru.paste.truncated}</li>}
              {tooMany && <li>{ru.paste.tooMany(BATCH_MAX, count.total)}</li>}
            </ul>
          )}
          <DraftTree drafts={parsed.drafts} top={kind} depth={0} label={ru.paste.previewLabel} />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            {ru.paste.cancel}
          </Button>
          <Button onClick={onCreate} disabled={tooMany}>
            {ru.paste.create}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DraftTree({ drafts, top, depth, label }: { drafts: QuestDraft[]; top: DraftKind; depth: number; label?: string }) {
  const kind = kindAtDepth(top, depth);
  if (!kind || drafts.length === 0) return null;
  const Icon = icons[kind];

  return (
    <ul aria-label={label} className={depth > 0 ? 'ml-3 border-l pl-3' : undefined}>
      {drafts.map((draft, index) => (
        <li key={index}>
          <span className="flex items-start gap-2 py-1">
            <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className="min-w-0 break-words">{draft.title}</span>
          </span>
          <DraftTree drafts={draft.children} top={top} depth={depth + 1} />
        </li>
      ))}
    </ul>
  );
}
