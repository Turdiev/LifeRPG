import { cn } from '@/shared/lib/utils';

const RADIUS = 9;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** Кольцо прогресса задания с этапами (docs/ux.md, «Компоненты»); подпись даёт кнопка вокруг. */
export function ProgressRing({ value, muted = false }: { value: number; muted?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="size-6 -rotate-90" aria-hidden>
      <circle cx="12" cy="12" r={RADIUS} fill="none" strokeWidth="3" className="stroke-muted" />
      <circle
        cx="12"
        cy="12"
        r={RADIUS}
        fill="none"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={CIRCUMFERENCE}
        strokeDashoffset={CIRCUMFERENCE * (1 - value / 100)}
        className={cn(
          'transition-[stroke-dashoffset] duration-300 motion-reduce:transition-none',
          muted ? 'stroke-muted-foreground/50' : 'stroke-success',
          value === 0 && 'opacity-0',
        )}
      />
    </svg>
  );
}
