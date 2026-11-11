import type { DraftKind } from '@life-rpg/domain';
import { Plus } from 'lucide-react';
import { useState, type ClipboardEvent, type KeyboardEvent } from 'react';
import { cn } from '@/shared/lib/utils';
import { ru } from '@/shared/strings/ru';
import { Input } from '@/shared/ui/input';
import { useLineActions } from './line-actions';

type InlineAddProps = {
  parentId: string;
  kind: DraftKind;
  className?: string;
};

/**
 * «+ Добавить …»: поле на месте строки; Enter создаёт элемент и оставляет поле открытым
 * для следующего, пустой Enter или Esc закрывает. Вставка нескольких строк открывает
 * предпросмотр (docs/ux.md, «Взаимодействия», «Быстрый ввод большого дерева»).
 */
export function InlineAdd({ parentId, kind, className }: InlineAddProps) {
  const { create, pasteList } = useLineActions();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  // После Esc или пустого Enter фокус возвращается на «+ Добавить …», а не теряется в странице.
  const [refocus, setRefocus] = useState(false);

  function close(returnFocus: boolean) {
    setOpen(false);
    setValue('');
    setRefocus(returnFocus);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') return close(true);
    if (event.key !== 'Enter') return;
    event.preventDefault();
    const title = value.trim();
    if (!title) return close(true);
    create({ parentId, kind, title });
    setValue('');
  }

  function onPaste(event: ClipboardEvent<HTMLInputElement>) {
    const text = event.clipboardData.getData('text/plain');
    // Одна строка вставляется в поле как обычно; список — через предпросмотр. Поле остаётся
    // открытым: после диалога фокус вернётся в него, а набранный текст не пропадёт.
    if (text.split(/\r?\n/).filter((line) => line.trim()).length < 2) return;
    event.preventDefault();
    pasteList(parentId, kind, text, event.currentTarget);
  }

  if (!open) {
    return (
      <button
        type="button"
        autoFocus={refocus}
        onClick={() => setOpen(true)}
        className={cn(
          'flex min-h-11 w-full items-center gap-2 rounded-lg px-2 text-left text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring',
          className,
        )}
      >
        <Plus className="size-4" aria-hidden />
        {ru.line.add[kind]}
      </button>
    );
  }

  return (
    <div className={cn('px-1 py-1', className)}>
      <Input
        autoFocus
        value={value}
        maxLength={120}
        aria-label={ru.line.add[kind]}
        placeholder={ru.line.addPlaceholder[kind]}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        onBlur={(event) => {
          // Фокус ушёл в предпросмотр вставки — поле нужно, чтобы вернуть его туда после диалога.
          const toDialog = event.relatedTarget instanceof Element && event.relatedTarget.closest('[role="dialog"]');
          if (!value.trim() && !toDialog) close(false);
        }}
        className="h-11"
      />
    </div>
  );
}
