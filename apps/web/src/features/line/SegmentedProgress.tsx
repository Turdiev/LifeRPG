import { cn } from '@/shared/lib/utils';
import { ru } from '@/shared/strings/ru';
import type { ProgressSegment } from './line-model';

type SegmentedProgressProps = {
  segments: ProgressSegment[];
  lineId: string;
  value: number;
  label: string;
  muted: boolean;
  /** Подписи глав под вехами — на экране линии; в узких местах их нет. */
  labels?: boolean;
  className?: string;
};

/**
 * «Дорога» цели: главы — отрезки золотой нити, в конце каждого — веха-ромб, которая загорается,
 * когда глава пройдена. Ширина отрезка — доля главы в листьях цели: видно не только «сколько», но и
 * «где я в сюжете». Глава активного квеста выделена золотой подписью и контуром вехи.
 */
export function SegmentedProgress({ segments, lineId, value, label, muted, labels = false, className }: SegmentedProgressProps) {
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
      className={cn('flex min-w-0 flex-1 pr-2', className)}
    >
      {segments.length === 0 ? (
        <span className="my-2.25 h-1 flex-1 bg-track outline outline-border" />
      ) : (
        segments.map((segment) => {
          const passed = segment.done === segment.total;
          const title = segment.id === lineId ? ru.line.directQuests : segment.title;
          return (
            <span
              key={segment.id}
              title={`${title}: ${segment.done} / ${segment.total}`}
              style={{ flexGrow: segment.total, flexBasis: 0 }}
              className="relative min-w-6"
            >
              <span className="relative my-2.25 mr-2.75 block h-1 bg-track outline outline-border">
                <span
                  className={cn(
                    'absolute inset-y-0 left-0 transition-[width] duration-300 motion-reduce:transition-none',
                    muted
                      ? 'bg-[repeating-linear-gradient(135deg,var(--paused)_0_4px,transparent_4px_7px)]'
                      : 'bg-linear-to-r from-gold-dim to-gold-bright shadow-[0_0_8px_var(--glow)]',
                  )}
                  style={{ width: `${(segment.done / segment.total) * 100}%` }}
                />
              </span>
              <span
                aria-hidden
                className={cn(
                  'absolute top-1 right-px z-1 size-3.25 rotate-45 border-[1.5px] transition-colors duration-300',
                  passed && !muted
                    ? 'border-gold-bright bg-gold shadow-[0_0_8px_var(--glow)]'
                    : cn('bg-background', segment.active ? 'border-gold' : 'border-gold-dim'),
                )}
              />
              {labels && (
                <span
                  aria-hidden
                  className={cn(
                    'block truncate pr-3 text-xs',
                    segment.active ? 'text-gold-text' : 'text-muted-foreground',
                  )}
                >
                  {title}
                </span>
              )}
            </span>
          );
        })
      )}
    </div>
  );
}
