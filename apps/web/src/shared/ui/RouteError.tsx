import { useRouter } from '@tanstack/react-router';
import { ru } from '@/shared/strings/ru';
import { Button } from '@/shared/ui/button';

/**
 * Маршрут не загрузился: чаще всего проверка сессии не достучалась до сервера (нет сети, 5xx).
 * docs/ux.md, «Общие состояния»: короткое сообщение и «Повторить». `invalidate`, а не `reset`:
 * `reset` только сбрасывает границу ошибки и не запускает `beforeLoad` заново.
 */
export function RouteError() {
  const router = useRouter();
  return (
    <main className="mx-auto w-full max-w-160 space-y-3 px-4 pt-6">
      <p role="alert">{ru.routeError.text}</p>
      <Button variant="outline" onClick={() => void router.invalidate()}>
        {ru.routeError.retry}
      </Button>
    </main>
  );
}
