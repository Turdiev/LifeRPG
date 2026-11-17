import { useRouter } from '@tanstack/react-router';
import { ru } from '@/shared/strings/ru';
import { Button } from '@/shared/ui/button';
import { Crest } from '@/shared/ui/icons';

/**
 * Маршрут не загрузился: чаще всего проверка сессии не достучалась до сервера (нет сети, 5xx).
 * docs/ux.md, «Общие состояния»: короткое сообщение и «Повторить». `invalidate`, а не `reset`:
 * `reset` только сбрасывает границу ошибки и не запускает `beforeLoad` заново.
 * Раскладка — как у `NotFound`: служебные экраны вне вкладок собраны по центру с гербом.
 */
export function RouteError() {
  const router = useRouter();
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-96 flex-col items-center justify-center px-5 pb-[max(2rem,env(safe-area-inset-bottom))] text-center">
      <Crest className="mb-4 size-16 text-gold drop-shadow-[0_0_18px_var(--glow)]" />
      <p role="alert">{ru.routeError.text}</p>
      <Button className="mt-6" onClick={() => void router.invalidate()}>
        {ru.routeError.retry}
      </Button>
    </main>
  );
}
