import { Link } from '@tanstack/react-router';
import { ru } from '@/shared/strings/ru';
import { Button } from '@/shared/ui/button';
import { Crest } from '@/shared/ui/icons';

/** Адрес не совпал ни с одним маршрутом: устаревшая закладка или опечатка в ссылке.
 * docs/ux.md, «Общие состояния»: одна фраза и одно действие. «/» сам ведёт на «Сегодня» или на вход.
 * Вкладок здесь нет, поэтому экран собран по центру с гербом, как вход: видно, что это всё ещё LIFE RPG. */
export function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-96 flex-col items-center justify-center px-5 pb-[max(2rem,env(safe-area-inset-bottom))] text-center">
      <Crest className="mb-4 size-16 text-gold drop-shadow-[0_0_18px_var(--glow)]" />
      <h1 className="type-heading">{ru.notFound.title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{ru.notFound.text}</p>
      <Button asChild className="mt-6">
        <Link to="/">{ru.notFound.home}</Link>
      </Button>
    </main>
  );
}
