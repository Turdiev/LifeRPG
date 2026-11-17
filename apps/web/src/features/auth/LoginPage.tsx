import { useMutation } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { SegmentedProgress } from '@/features/line/SegmentedProgress';
import { signInWithGoogle } from '@/shared/api/auth';
import { cn } from '@/shared/lib/utils';
import { ru } from '@/shared/strings/ru';
import { Button } from '@/shared/ui/button';
import { CheckDiamond } from '@/shared/ui/checkbox';
import { Crest, FlagIcon, RuneDivider } from '@/shared/ui/icons';
import { ProgressRing } from '@/shared/ui/ProgressRing';

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
    <main className="mx-auto flex min-h-dvh w-full max-w-96 flex-col px-5 pt-[6dvh] pb-[max(2rem,env(safe-area-inset-bottom))] lg:justify-center lg:py-0">
      {/* Герб — тот же, что на иконке приложения: вход начинается с узнаваемого знака. */}
      <Crest className="mx-auto mb-1.5 size-21.5 text-gold drop-shadow-[0_0_18px_var(--glow)]" />
      <h1 className="pl-[0.34em] text-center font-heading text-[2.125rem] leading-none tracking-[0.34em] text-gold-text">
        {ru.login.title}
      </h1>
      <p className="mx-auto mt-3 max-w-[30ch] text-center text-muted-foreground">{ru.login.text}</p>
      <RuneDivider className="my-4" />

      <ExampleGoal />

      <div className="mt-auto space-y-3 pt-12 lg:mt-0">
        {error && (
          <p role="alert" className="text-sm">
            {error}
          </p>
        )}
        <Button size="lg" className="w-full" disabled={pending} onClick={() => signIn.mutate()}>
          {/* Знак Google — привычная подсказка, куда ведёт кнопка; подпись уже называет его. */}
          <span aria-hidden className="grid size-5.5 place-items-center rounded-full bg-white text-[0.8125rem] font-bold text-[#3c4043]">
            G
          </span>
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
 * Мини-копия экрана линии: цель, дорога по главам и раскрытое активное задание с этапами — механика
 * видна до входа, без объяснений словами. Декоративная: смысл уже несёт фраза над ней, скринридеру
 * повтор не нужен; ромбы — без кнопок, фокус в пример не заходит.
 */
function ExampleGoal() {
  // Шкала, кольцо и первый ромб сначала пустые и заполняются сразу после первой отрисовки — единственная
  // анимация экрана. Плавность дают transition компонентов; при «уменьшенном движении» они выключены.
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

  const active = exampleChapters.find((chapter) => chapter.active)!;
  return (
    <div aria-hidden className="panel px-3.5 pt-3 pb-1">
      <div className="flex items-baseline gap-3">
        <p className="min-w-0 flex-1 font-heading text-[1.0625rem] tracking-[0.03em]">{example.goal}</p>
        <span className="font-heading text-[0.9375rem] tabular-nums text-gold-text">{ru.journal.progress(examplePercent)}</span>
      </div>
      <SegmentedProgress segments={segments} lineId="" value={examplePercent} label={example.goal} muted={false} labels className="mt-2" />
      {/* Активное задание — как на экране линии: золотая кромка слева, флаг, этапы на пунктирной нити. */}
      <div className="mt-1 -mx-3.5 flex min-h-13 items-center gap-2.5 border-t border-l-2 border-l-gold bg-linear-to-r from-halo to-transparent to-85% pr-3.5 pl-3">
        <ProgressRing done={filled ? active.done : 0} total={active.total} />
        <span className="min-w-0 flex-1 text-[0.9375rem] font-medium">{example.quest}</span>
        <FlagIcon className="size-4 text-gold" />
      </div>
      <ul className="mb-1 ml-4.5 border-l border-dashed border-border-strong pl-1">
        {example.steps.map((step, index) => {
          const done = filled && index < active.done;
          return (
            <li key={step} className="flex min-h-10.5 items-center gap-1 border-b last:border-b-0">
              <CheckDiamond checked={done} className="size-10" />
              <span className={cn('text-sm', done && 'text-muted-foreground line-through decoration-gold-dim')}>{step}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
