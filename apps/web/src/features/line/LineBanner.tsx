import { formatDeadline, localDate } from '@/shared/lib/format';
import { ru } from '@/shared/strings/ru';
import { Button } from '@/shared/ui/button';
import { useLineActions } from './line-actions';
import type { TreeNode } from './line-model';

/** Состояния линии из docs/ux.md: пауза, достигнута, отменена — с главным действием. */
export function LineBanner({ line, today }: { line: TreeNode; today: string }) {
  const { run } = useLineActions();

  if (line.status === 'open') return null;
  if (line.status === 'done') {
    return (
      <p role="status" className="rounded-xl border border-success/40 px-4 py-3 text-sm">
        {line.completedAt
          ? ru.line.banners.done(formatDeadline(localDate(line.completedAt), today))
          : ru.line.banners.doneUndated}
      </p>
    );
  }

  const paused = line.status === 'paused';
  return (
    <div role="status" className="flex items-center justify-between gap-3 rounded-xl border bg-muted px-4 py-2">
      <p className="text-sm">{paused ? ru.line.banners.paused : ru.line.banners.cancelled}</p>
      <Button variant="outline" onClick={() => run(line, paused ? 'resume' : 'restore')}>
        {paused ? ru.line.actions.resume : ru.line.actions.restore}
      </Button>
    </div>
  );
}
