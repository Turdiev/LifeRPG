import { useMutation } from '@tanstack/react-query';
import { Check, Flag, Scroll, Swords } from 'lucide-react';
import { useEffect, useState } from 'react';
import { SegmentedProgress } from '@/features/line/SegmentedProgress';
import { signInWithGoogle } from '@/shared/api/auth';
import { cn } from '@/shared/lib/utils';
import { ru } from '@/shared/strings/ru';
import { Button } from '@/shared/ui/button';

/**
 * Экран входа: название, одна фраза о сути, пример цели и одна кнопка. Кнопка — в нижней трети
 * экрана, под большим пальцем (docs/ux.md, принцип 5); на компьютере всё собрано по центру окна.
 */
export function LoginPage({ failed }: { failed: boolean }) {
  // Успех — это уход со страницы на Google, поэтому ожидание держится до перехода.
  const signIn = useMutation({ mutationFn: signInWithGoogle });
  const pending = signIn.isPending || signIn.isSuccess;
  const { reset } = signIn;

  // «Назад» со страницы Google достаёт эту страницу из bfcache вместе с состоянием React —
  // кнопка так и осталась бы «Открываем Google…». `persisted` — именно такое восстановление.
  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => event.persisted && reset();
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, [reset]);
  const error = signIn.isError ? ru.login.startFailed : failed ? ru.login.failed : null;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-96 flex-col px-4 pt-[12dvh] pb-[max(2rem,env(safe-area-inset-bottom))] lg:justify-center lg:py-0">
      {/* Свиток — иконка сюжетной линии (docs/ux.md, «Атмосфера»); золото оставлено активному квесту. */}
      <Scroll className="size-8 text-muted-foreground" aria-hidden />
      <h1 className="mt-4 type-display">{ru.login.title}</h1>
      <p className="mt-2 max-w-[36ch] text-muted-foreground">{ru.login.text}</p>

      <ExampleGoal />

      <div className="mt-auto space-y-3 pt-12 lg:mt-0">
        {error && (
          <p role="alert" className="text-sm">
            {error}
          </p>
        )}
        <Button className="h-12 w-full text-base" disabled={pending} onClick={() => signIn.mutate()}>
          {pending ? ru.login.redirecting : ru.login.signIn}
        </Button>
      </div>
    </main>
  );
}

const example = ru.login.example;
const exampleChapters = [
  { id: 'grammar', title: example.chapters.grammar, done: 3, total: 3, active: false },
  { id: 'vocabulary', title: example.chapters.vocabulary, done: 1, total: 4, active: true },
  { id: 'speaking', title: example.chapters.speaking, done: 0, total: 3, active: false },
];
const examplePercent = Math.round(
  (100 * exampleChapters.reduce((sum, chapter) => sum + chapter.done, 0)) /
    exampleChapters.reduce((sum, chapter) => sum + chapter.total, 0),
);

/**
 * Мини-копия экрана линии: показывает механику — цель, главы, золотой следующий шаг — до входа,
 * без объяснений словами. Декоративная: смысл уже несёт фраза над ней, скринридеру повтор не нужен.
 */
function ExampleGoal() {
  // Шкала сначала пустая и заполняется сразу после первой отрисовки — единственная анимация экрана.
  // Плавность даёт transition у SegmentedProgress; при «уменьшенном движении» он выключен.
  const [filled, setFilled] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setFilled(true));
    return () => cancelAnimationFrame(frame);
  }, []);
  const segments = exampleChapters.map(({ id, title, done, total, active }) => ({
    id,
    title,
    done: filled ? done : 0,
    total,
    active,
  }));

  return (
    <div aria-hidden className="mt-8 space-y-3 rounded-xl bg-card p-4">
      <div className="flex items-baseline gap-3">
        <p className="min-w-0 flex-1 font-semibold">{example.goal}</p>
        <span className="text-sm tabular-nums text-muted-foreground">{ru.journal.progress(examplePercent)}</span>
      </div>
      <SegmentedProgress
        segments={segments}
        lineId=""
        value={examplePercent}
        label={example.goal}
        muted={false}
        className="*:ring-offset-card"
      />
      <ul className="space-y-1 pt-1 text-sm">
        {exampleChapters.map((chapter) => {
          const done = chapter.done === chapter.total;
          return (
            <li key={chapter.id}>
              <div className={cn('flex items-center gap-2 py-1', done && 'text-muted-foreground')}>
                <Flag className="size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1">{chapter.title}</span>
                {done && <Check className="size-4 shrink-0 text-success" />}
                <span className="tabular-nums text-muted-foreground">
                  {ru.line.questCount(chapter.done, chapter.total)}
                </span>
              </div>
              {chapter.active && (
                <div className="flex items-center gap-2 py-1 pl-6 font-medium">
                  <Swords className="size-4 shrink-0 text-quest" />
                  <span className="min-w-0 flex-1">{example.quest}</span>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
