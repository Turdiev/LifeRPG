import { Dialog as DialogPrimitive } from 'radix-ui';
import { plural } from '@/shared/lib/plural';
import { ru } from '@/shared/strings/ru';
import { Button } from '@/shared/ui/button';
import { RuneDivider } from '@/shared/ui/icons';
import type { CompletionView } from './completion-model';

/** Подпись и итоги поднимаются, когда баннер уже раскрылся (keyframes в globals.css). */
const rise = 'motion-safe:animate-finale-rise';

/**
 * Экран завершения главы или цели (F-16; docs/ux.md, «Атмосфера»): вспышка, медленные лучи,
 * баннер с раскрывающейся разрядкой и итоги. Единственная громкая сцена в приложении — остальное
 * намеренно тихое. При «уменьшенном движении» вспышки, лучей и разрядки нет: экран сразу в покое.
 * Radix Dialog даёт фокус на «Дальше», Esc и возврат фокуса туда, где он был до показа.
 */
export function CompletionOverlay({ view, onClose }: { view: CompletionView; onClose: () => void }) {
  return (
    <DialogPrimitive.Root open onOpenChange={(open) => !open && onClose()}>
      <DialogPrimitive.Portal>
        {/* Колонка с прокруткой и кнопкой в потоке: на низком экране или с длинным названием итоги не
            уходят под «Дальше». Свет и лучи — fixed, они не прокручиваются вместе с текстом. */}
        <DialogPrimitive.Content className="fixed inset-0 z-50 flex flex-col items-center overflow-x-hidden overflow-y-auto bg-background px-7 pt-10 pb-[max(2.125rem,env(safe-area-inset-bottom))] text-center outline-none">
          {/* Свет в центре и затемнение по краям. */}
          <span
            aria-hidden
            className="fixed inset-0 bg-[radial-gradient(70%_45%_at_50%_46%,rgb(244_215_140/0.22),transparent_70%),radial-gradient(120%_90%_at_50%_50%,transparent_40%,rgb(0_0_0/0.85))] in-data-[theme=light]:bg-[radial-gradient(70%_45%_at_50%_46%,rgb(255_248_225/0.7),transparent_70%),radial-gradient(120%_90%_at_50%_50%,transparent_40%,rgb(110_75_25/0.45))]"
          />
          <span
            aria-hidden
            className="fixed top-[46%] left-1/2 -mt-[340px] -ml-[340px] size-[680px] bg-[repeating-conic-gradient(from_0deg,rgb(244_215_140/0.1)_0_4deg,transparent_4deg_18deg)] [mask-image:radial-gradient(circle,#000,transparent_62%)] in-data-[theme=light]:bg-[repeating-conic-gradient(from_0deg,rgb(168_115_28/0.12)_0_4deg,transparent_4deg_18deg)] motion-safe:animate-finale-rays"
          />
          <span
            aria-hidden
            className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_50%_46%,#fff7dc,rgb(244_215_140/0.7)_22%,transparent_62%)] opacity-0 motion-safe:animate-finale-flash"
          />

          <div className="relative my-auto flex w-full max-w-sm flex-col items-center">
            <p aria-hidden className={`pl-[0.5em] font-heading text-sm tracking-[0.5em] text-gold ${rise}`}>
              {ru.common.brand}
            </p>
            <DialogPrimitive.Title className="mt-3.5">
              <span className="block pl-[0.38em] font-heading text-[2.375rem] leading-[1.15] tracking-[0.38em] text-gold-text uppercase [text-shadow:0_0_28px_var(--glow)] motion-safe:animate-finale-banner max-[380px]:text-[2rem]">
                {view.kind === 'line' ? ru.completion.line : ru.completion.chapter}
              </span>
              <RuneDivider className={`my-4.5 w-full max-w-75 ${rise}`} />
              <span className={`block type-display text-[1.875rem] break-words ${rise}`}>{view.title}</span>
              {view.lineTitle && (
                <span className={`mt-1 block font-sans text-base text-muted-foreground break-words ${rise}`}>
                  {view.lineTitle}
                </span>
              )}
            </DialogPrimitive.Title>
            <DialogPrimitive.Description asChild>
              <dl className={`mt-8.5 flex justify-center gap-8.5 ${rise}`}>
                <div className="flex flex-col-reverse">
                  <dt className="text-[0.8125rem] text-muted-foreground">{ru.completion.daysCaption}</dt>
                  <dd className="font-heading text-[2.125rem] leading-[1.1] tracking-[0.03em]">
                    {ru.completion.days(view.days, plural(view.days, ru.completion.daysNoun))}
                  </dd>
                </div>
                {/* Пустую главу можно закрыть вручную (PRD, «Прогресс») — «0 выполнено» не поздравление. */}
                {view.questsDone > 0 && (
                  <div className="flex flex-col-reverse">
                    <dt className="text-[0.8125rem] text-muted-foreground">
                      {plural(view.questsDone, ru.completion.questsCaption)}
                    </dt>
                    <dd className="font-heading text-[2.125rem] leading-[1.1] tracking-[0.03em]">{view.questsDone}</dd>
                  </div>
                )}
              </dl>
            </DialogPrimitive.Description>
          </div>

          <div className={`relative mt-10 w-full max-w-sm ${rise}`}>
            <DialogPrimitive.Close asChild>
              <Button size="lg" className="w-full">
                {ru.completion.next}
              </Button>
            </DialogPrimitive.Close>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
