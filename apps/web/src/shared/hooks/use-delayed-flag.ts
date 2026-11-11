import { useEffect, useState } from 'react';

/**
 * docs/ux.md: скелетон показывается, только если загрузка дольше 300 мс, —
 * так быстрый ответ не мигает заглушкой.
 */
export function useDelayedFlag(active: boolean, delayMs: number): boolean {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (!active) return;
    const timer = setTimeout(() => setShown(true), delayMs);
    return () => {
      clearTimeout(timer);
      setShown(false);
    };
  }, [active, delayMs]);

  return active && shown;
}
