import { cn } from '@/shared/lib/utils';

/** Больше ромбов в строку не помещается — дальше полоса (решение автора, 2026-11-17). */
export const MAX_PIPS = 12;

/** Этапы задания ромбами: пройденные светятся золотом. Декоративные — счёт «3 из 8» пишется рядом. */
export function StepPips({ done, total }: { done: number; total: number }) {
  return (
    <span aria-hidden className="flex items-center gap-2.25 px-0.75 py-0.5">
      {Array.from({ length: total }, (_, index) => (
        <span
          key={index}
          className={cn(
            'size-2.25 rotate-45 border',
            index < done ? 'border-gold-bright bg-gold shadow-[0_0_6px_var(--glow)]' : 'border-gold-dim',
          )}
        />
      ))}
    </span>
  );
}
