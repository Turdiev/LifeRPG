import { useCallback, useSyncExternalStore } from 'react';

/**
 * Совпадение медиазапроса с подпиской на изменения. `useSyncExternalStore`, а не эффект
 * с состоянием: значение известно с первого рендера, без кадра с неверной раскладкой.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    [query],
  );
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches);
}

/**
 * docs/ux.md, «Карта экранов»: от 1024 px «Сегодня» — постоянная колонка слева. Порог тот же,
 * что у Tailwind `lg` (`--breakpoint-lg: 64rem`), и в тех же единицах: с крупным шрифтом
 * браузера rem больше 16 px, и JS-разметка не должна включиться раньше CSS-классов `lg:`.
 */
export function useIsDesktop(): boolean {
  return useMediaQuery('(min-width: 64rem)');
}
