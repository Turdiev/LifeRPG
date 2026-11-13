import { useMutation } from '@tanstack/react-query';
import { Scroll } from 'lucide-react';
import { useEffect } from 'react';
import { signInWithGoogle } from '@/shared/api/auth';
import { ru } from '@/shared/strings/ru';
import { Button } from '@/shared/ui/button';

/**
 * Экран входа: название, одна фраза о сути и одна кнопка. Кнопка — в нижней трети экрана,
 * под большим пальцем (docs/ux.md, принцип 5); на компьютере всё собрано по центру окна.
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
    <main className="mx-auto flex min-h-dvh w-full max-w-96 flex-col px-4 pt-[18dvh] pb-[max(2rem,env(safe-area-inset-bottom))] lg:justify-center lg:py-0">
      {/* Свиток — иконка сюжетной линии (docs/ux.md, «Атмосфера»); золото оставлено активному квесту. */}
      <Scroll className="size-8 text-muted-foreground" aria-hidden />
      <h1 className="mt-4 text-2xl">{ru.login.title}</h1>
      <p className="mt-2 max-w-[36ch] text-muted-foreground">{ru.login.text}</p>

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
