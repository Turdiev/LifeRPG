import { Dialog as DialogPrimitive } from 'radix-ui';
import { useEffect, useState } from 'react';
import { SegmentedProgress } from '@/features/line/SegmentedProgress';
import { percent } from '@/shared/lib/format';
import { plural } from '@/shared/lib/plural';
import { ru } from '@/shared/strings/ru';
import { Button } from '@/shared/ui/button';
import type { CompletionView } from './completion-model';

/**
 * Сцена: свиток разворачивается (800 мс), текст проявляется (с 800 мс), затем заливается шкала и
 * проходит блик. Разворот и проявление — keyframes в globals.css; меняя их, меняй и это число.
 */
const FILL_DELAY_MS = 1100;

/**
 * Экран завершения главы или цели (F-16; docs/ux.md, «Атмосфера»): развёрнутый свиток с итогами и
 * одним золотым бликом. Единственная громкая сцена в приложении — остальное намеренно тихое.
 * Radix Dialog даёт фокус на «Дальше», Esc и возврат фокуса туда, где он был до показа.
 */
export function CompletionOverlay({ view, onClose }: { view: CompletionView; onClose: () => void }) {
  // При «уменьшенном движении» разворота нет — шкала сразу заполнена, без кадра с пустой.
  const [filled, setFilled] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    if (filled) return;
    const timer = setTimeout(() => setFilled(true), FILL_DELAY_MS);
    return () => clearTimeout(timer);
  }, [filled]);
  const segments = view.segments.map((segment) =>
    view.filling.includes(segment.id) && !filled ? { ...segment, done: 0 } : segment,
  );
  const value = percent({
    done: view.segments.reduce((sum, s) => sum + s.done, 0),
    total: view.segments.reduce((sum, s) => sum + s.total, 0),
  });

  return (
    <DialogPrimitive.Root open onOpenChange={(open) => !open && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm motion-safe:animate-in motion-safe:fade-in-0" />
        <DialogPrimitive.Content className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 outline-none motion-reduce:animate-in motion-reduce:fade-in-0">
          <Roller />
          <div className="grid motion-safe:animate-scroll-unroll">
            <div className="relative min-h-0 overflow-hidden bg-card px-6 shadow-lg">
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-linear-to-r from-transparent via-quest/20 to-transparent motion-safe:animate-quest-shimmer motion-safe:[animation-delay:1100ms] motion-reduce:hidden"
              />
              <div className="relative space-y-5 py-7 motion-safe:animate-scroll-text">
                <DialogPrimitive.Title className="space-y-1">
                  <span className="block type-heading text-muted-foreground">
                    {view.kind === 'line' ? ru.completion.line : ru.completion.chapter}
                  </span>
                  <span className="block type-display break-words">{view.title}</span>
                </DialogPrimitive.Title>
                {view.segments.length > 0 && (
                  <SegmentedProgress
                    segments={segments}
                    lineId={view.lineId}
                    value={value}
                    label={view.title}
                    muted={false}
                  />
                )}
                <DialogPrimitive.Description asChild>
                  <div>
                    <p>{ru.completion.days(view.days, plural(view.days, ru.completion.daysNoun))}</p>
                    {/* Пустую главу можно закрыть вручную (PRD, «Прогресс») — «выполнено 0» не поздравление. */}
                    {view.questsDone > 0 && (
                      <p>{ru.completion.quests(view.questsDone, plural(view.questsDone, ru.completion.questsNoun))}</p>
                    )}
                  </div>
                </DialogPrimitive.Description>
                <DialogPrimitive.Close asChild>
                  <Button className="h-11 w-full">{ru.completion.next}</Button>
                </DialogPrimitive.Close>
              </div>
            </div>
          </div>
          <Roller />
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/** Валик свитка: шире листа, чтобы читался как ось, на которую он намотан. */
function Roller() {
  return <span aria-hidden className="-mx-2 block h-3.5 rounded-full bg-track shadow-sm" />;
}
