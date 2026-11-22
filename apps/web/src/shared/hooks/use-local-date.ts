import { useSyncExternalStore } from 'react';
import { localToday } from '@/shared/lib/format';

/**
 * Дата устройства, которая сама меняется после полуночи. Открытая PWA может пролежать в фоне до утра:
 * без этого экран «Сегодня» показал бы вчерашние дни контрактов, а отметка ушла бы с новой датой
 * и молча закрыла бы вчерашний день. Дата перечитывается при возвращении в приложение и раз в минуту.
 */
export function useLocalDate(): string {
  return useSyncExternalStore(subscribe, localToday);
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener('focus', onChange);
  document.addEventListener('visibilitychange', onChange);
  const timer = window.setInterval(onChange, 60_000);
  return () => {
    window.removeEventListener('focus', onChange);
    document.removeEventListener('visibilitychange', onChange);
    window.clearInterval(timer);
  };
}
