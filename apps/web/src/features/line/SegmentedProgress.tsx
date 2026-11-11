import { cn } from '@/shared/lib/utils';
import { ru } from '@/shared/strings/ru';
import type { ProgressSegment } from './line-model';

type SegmentedProgressProps = {
  segments: ProgressSegment[];
  lineId: string;
  value: number;
  label: string;
  muted: boolean;
};

/**
 * Шкала цели, разбитая на главы: ширина отрезка — доля главы в листьях цели. Видно не только
 * «сколько сделано», но и где ты в сюжете; золотом обведена глава активного квеста.
 */
export function SegmentedProgress({ segments, lineId, value, label, muted }: SegmentedProgressProps) {
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
      className="flex h-3 flex-1 gap-1"
    >
      {segments.length === 0 ? (
        <span className="h-full flex-1 rounded-full bg-muted" />
      ) : (
        segments.map((segment) => (
          <span
            key={segment.id}
            title={`${segment.id === lineId ? ru.line.directQuests : segment.title}: ${segment.done} / ${segment.total}`}
            style={{ flexGrow: segment.total, flexBasis: 0 }}
            className={cn(
              'relative h-full min-w-2 overflow-hidden rounded-full bg-muted',
              segment.active && 'ring-2 ring-quest ring-offset-2 ring-offset-background',
            )}
          >
            <span
              className={cn(
                'absolute inset-y-0 left-0 transition-[width] duration-300 motion-reduce:transition-none',
                muted ? 'bg-muted-foreground/50' : 'bg-success',
              )}
              style={{ width: `${(segment.done / segment.total) * 100}%` }}
            />
          </span>
        ))
      )}
    </div>
  );
}
