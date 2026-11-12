import { ru } from '@/shared/strings/ru';
import { Button } from '@/shared/ui/button';
import type { NextQuestView } from './today-model';

type NextQuestCardProps = {
  next: NextQuestView;
  /** «Взять» ждёт ответа сервера: повторное нажатие игнорируется. */
  taking: boolean;
  onTake: () => void;
  /** Нет, пока `/today` не прислал список предложений: иначе «Выбрать другой» открыл бы пустоту. */
  onChooseOther: (() => void) | null;
};

/**
 * «Следующий квест: …» после закрытия активного (F-13; docs/ux.md, «Сегодня», «Состояния»).
 * Появляется в ответ на отметку — поэтому с короткой анимацией, а не статично.
 */
export function NextQuestCard({ next, taking, onTake, onChooseOther }: NextQuestCardProps) {
  return (
    <section
      aria-labelledby="next-quest"
      className="rounded-xl border bg-card p-4 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:animation-duration-300"
    >
      <h2 id="next-quest" className="text-lg break-words">
        {ru.today.next.title(next.quest.title)}
      </h2>
      {next.chapter && <p className="mt-1 text-sm text-muted-foreground break-words">{next.chapter.title}</p>}
      <div className="mt-4 flex flex-wrap gap-2">
        {/* aria-disabled, а не disabled: фокус остаётся на кнопке, пока сервер отвечает. */}
        <Button
          className="h-11 aria-disabled:opacity-60"
          aria-disabled={taking}
          aria-busy={taking}
          onClick={() => !taking && onTake()}
        >
          {ru.today.next.take}
        </Button>
        {onChooseOther && (
          <Button variant="outline" className="h-11" onClick={onChooseOther}>
            {ru.today.next.other}
          </Button>
        )}
      </div>
    </section>
  );
}

