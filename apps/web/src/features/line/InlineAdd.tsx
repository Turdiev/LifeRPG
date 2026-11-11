import { Plus } from 'lucide-react';
import { useState, type KeyboardEvent } from 'react';
import { cn } from '@/shared/lib/utils';
import { ru } from '@/shared/strings/ru';
import { Input } from '@/shared/ui/input';

type InlineAddProps = {
  kind: 'chapter' | 'quest' | 'step';
  onCreate: (title: string) => void;
  className?: string;
};

/**
 * «+ Добавить …»: поле на месте строки; Enter создаёт элемент и оставляет поле открытым
 * для следующего, пустой Enter или Esc закрывает (docs/ux.md, «Взаимодействия»).
 */
export function InlineAdd({ kind, onCreate, className }: InlineAddProps) {
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
    onCreate(title);
    setValue('');
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
        onBlur={() => !value.trim() && close(false)}
        className="h-11"
      />
    </div>
  );
}
