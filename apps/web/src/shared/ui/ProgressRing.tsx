import { cn } from '@/shared/lib/utils';

const RADIUS = 14;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * Кольцо прогресса задания с этапами и счётом «3/8» внутри (docs/ux.md, «Компоненты»).
 * Декоративное: подпись с цифрами даёт кнопка вокруг.
 */
export function ProgressRing({ done, total, muted = false }: { done: number; total: number; muted?: boolean }) {
  const share = total > 0 ? done / total : 0;
  return (
    <span aria-hidden className="relative grid size-9 place-items-center">
      <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90">
        <circle cx="18" cy="18" r={RADIUS} fill="none" strokeWidth="3" className="stroke-border" />
        <circle
          cx="18"
          cy="18"
          r={RADIUS}
          fill="none"
          strokeWidth="3"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - share)}
          className={cn(
            'transition-[stroke-dashoffset] duration-300 motion-reduce:transition-none',
            muted ? 'stroke-paused' : 'stroke-gold',
            share === 0 && 'opacity-0',
          )}
        />
      </svg>
      <span className={cn('relative text-[0.625rem] font-semibold tabular-nums', muted && 'text-muted-foreground')}>
        {done}/{total}
      </span>
    </span>
  );
}
