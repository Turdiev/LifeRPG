import { formatDeadline, localDate } from '@/shared/lib/format';
import { ru } from '@/shared/strings/ru';
import { Button } from '@/shared/ui/button';
import { PauseIcon, SparksIcon } from '@/shared/ui/icons';
import { useLineActions } from './line-actions';
import type { TreeNode } from './line-model';

/** Состояния линии из docs/ux.md: пауза, достигнута, отменена — с главным действием. */
export function LineBanner({ line, today }: { line: TreeNode; today: string }) {
  const { run } = useLineActions();

  if (line.status === 'open') return null;
  if (line.status === 'done') {
    return (
      <p role="status" className="panel flex items-center gap-2 border-border-strong px-4 py-3 text-sm text-gold-text">
        <SparksIcon className="text-gold" />
        {line.completedAt
          ? ru.line.banners.done(formatDeadline(localDate(line.completedAt), today))
          : ru.line.banners.doneUndated}
      </p>
    );
  }

  const paused = line.status === 'paused';
  return (
    <div
      role="status"
      className={`panel flex items-center justify-between gap-3 px-4 py-2 ${paused ? 'border-paused/60' : ''}`}
    >
      <p className={`flex items-center gap-2 text-sm ${paused ? 'text-paused' : 'text-muted-foreground'}`}>
        {paused && <PauseIcon className="size-4" />}
        {paused ? ru.line.banners.paused : ru.line.banners.cancelled}
      </p>
      <Button variant="outline" onClick={() => run(line, paused ? 'resume' : 'restore')}>
        {paused ? ru.line.actions.resume : ru.line.actions.restore}
      </Button>
    </div>
  );
}
