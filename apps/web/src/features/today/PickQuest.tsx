import type { TodayResponse } from '@life-rpg/shared';
import { Swords } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { ru } from '@/shared/strings/ru';

type Suggestion = TodayResponse['suggestions'][number];
type PickQuestProps = {
  suggestions: Suggestion[];
  /** Выбранное, пока сервер не ответил: остальные ждут, чтобы не взять два квеста подряд. */
  takingId: string | null;
  onTake: (suggestion: Suggestion) => void;
};

/** «Выбери квест»: тап по предложению делает его активным (docs/ux.md, «Сегодня», «Состояния»). */
export function PickQuest({ suggestions, takingId, onTake }: PickQuestProps) {
  return (
    <section aria-labelledby="pick-quest" className="space-y-3">
      <div className="space-y-1">
        <h2 id="pick-quest" className="text-xl">
          {ru.today.pick.title}
        </h2>
        <p className="text-muted-foreground">{ru.today.pick.text}</p>
      </div>
      <ul className="space-y-2">
        {suggestions.map((suggestion) => {
          const taking = suggestion.id === takingId;
          return (
            <li key={suggestion.id}>
              <button
                type="button"
                // aria-disabled, а не disabled: кнопка с фокусом не теряет его, пока ждёт ответа,
                // и после ошибки с клавиатуры можно выбрать снова.
                aria-disabled={takingId !== null}
                aria-busy={taking}
                aria-label={ru.today.pick.take(suggestion.title, suggestion.lineTitle)}
                onClick={() => takingId === null && onTake(suggestion)}
                className={cn(
                  'flex min-h-14 w-full items-center gap-3 rounded-lg border bg-card px-3 py-2 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring not-aria-disabled:hover:border-quest/60 aria-disabled:cursor-default',
                  taking && 'border-quest ring-1 ring-quest',
                  takingId !== null && !taking && 'opacity-60',
                )}
              >
                <Swords className={cn('size-5 shrink-0', taking ? 'text-quest' : 'text-muted-foreground')} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium break-words">{suggestion.title}</span>
                  <span className="block text-sm text-muted-foreground break-words">{suggestion.lineTitle}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
