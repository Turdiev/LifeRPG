import type { TodayResponse } from '@life-rpg/shared';
import { cn } from '@/shared/lib/utils';
import { ru } from '@/shared/strings/ru';
import { ChevronRightIcon, QuestIcon } from '@/shared/ui/icons';

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
        <h2 id="pick-quest" className="type-heading">
          {ru.today.pick.title}
        </h2>
        <p className="text-sm text-muted-foreground">{ru.today.pick.text}</p>
      </div>
      {/* Одна карточка со строками, а не три карточки (docs/ux.md: «Карточка „Выбери квест“ с тремя предложениями»).
          Выбор — золотое кольцо по краю строки, фокус — контур чуть глубже: оба внутри строки (снаружи их
          обрезал бы overflow-hidden) и не перекрывают друг друга, когда квест взят с клавиатуры. */}
      <ul className="panel divide-y overflow-hidden">
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
                  'flex min-h-14 w-full items-center gap-3 px-3 py-2 text-left outline-none transition-colors focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-ring focus-visible:outline-solid not-aria-disabled:hover:bg-surface-3/50 aria-disabled:cursor-default',
                  taking && 'bg-linear-to-r from-halo to-transparent ring-1 ring-gold ring-inset',
                  takingId !== null && !taking && 'opacity-60',
                )}
              >
                <QuestIcon className="text-gold" />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium break-words">{suggestion.title}</span>
                  <span className="block text-sm text-muted-foreground break-words">{suggestion.lineTitle}</span>
                </span>
                <ChevronRightIcon className="size-4 text-muted-foreground" />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
