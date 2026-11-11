import { useNavigate } from '@tanstack/react-router';
import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import type { LineSummary } from '@/shared/api/quests-api';
import { ru } from '@/shared/strings/ru';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/shared/ui/sheet';
import { Textarea } from '@/shared/ui/textarea';
import { useCreateLine, useUpdateLine } from './use-journal';

type LineFormSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Есть — правка этой линии, нет — создание новой. */
  line?: LineSummary;
};

/** Лист снизу, чтобы не терять из виду журнал (docs/ux.md, «Карта экранов»). */
export function LineFormSheet({ open, onOpenChange, line }: LineFormSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="mx-auto max-h-[90dvh] max-w-[640px] overflow-y-auto rounded-t-xl">
        <SheetHeader>
          <SheetTitle className="text-xl">
            {line ? ru.lineForm.editTitle : ru.lineForm.createTitle}
          </SheetTitle>
          <SheetDescription>{line ? ru.lineForm.editDescription : ru.lineForm.createDescription}</SheetDescription>
        </SheetHeader>
        {/* key сбрасывает поля, когда лист открывают для другой линии. */}
        {open && <LineForm key={line?.id ?? 'new'} line={line} onDone={() => onOpenChange(false)} />}
      </SheetContent>
    </Sheet>
  );
}

function LineForm({ line, onDone }: { line?: LineSummary; onDone: () => void }) {
  const [title, setTitle] = useState(line?.title ?? '');
  const [description, setDescription] = useState(line?.description ?? '');
  const [deadline, setDeadline] = useState(line?.deadline ?? '');
  const createLine = useCreateLine();
  const updateLine = useUpdateLine();
  const navigate = useNavigate();

  const pending = createLine.isPending || updateLine.isPending;
  const canSubmit = title.trim().length > 0 && !pending;
  const onError = () => toast.error(ru.toasts.saveFailed);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;
    const trimmedDescription = description.trim();

    if (line) {
      updateLine.mutate(
        {
          id: line.id,
          body: { title: title.trim(), description: trimmedDescription || null, deadline: deadline || null },
        },
        { onSuccess: onDone, onError },
      );
      return;
    }
    createLine.mutate(
      {
        title: title.trim(),
        ...(trimmedDescription ? { description: trimmedDescription } : {}),
        ...(deadline ? { deadline } : {}),
      },
      {
        onSuccess: ({ changed }) => {
          onDone();
          void navigate({ to: '/line/$lineId', params: { lineId: changed[0]!.id } });
        },
        onError,
      },
    );
  }

  return (
    <form onSubmit={submit} className="grid gap-4 px-4">
      <div className="grid gap-2">
        <Label htmlFor="line-title">{ru.lineForm.title}</Label>
        <Input
          id="line-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder={ru.lineForm.titlePlaceholder}
          maxLength={120}
          required
          autoFocus
          className="h-11"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="line-description">{ru.lineForm.description}</Label>
        <Textarea
          id="line-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={3}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="line-deadline">{ru.lineForm.deadline}</Label>
        <Input
          id="line-deadline"
          type="date"
          value={deadline}
          onChange={(event) => setDeadline(event.target.value)}
          className="h-11 w-fit"
        />
      </div>
      <SheetFooter className="px-0">
        <Button type="submit" disabled={!canSubmit}>
          {line ? ru.lineForm.save : ru.lineForm.create}
        </Button>
      </SheetFooter>
    </form>
  );
}
