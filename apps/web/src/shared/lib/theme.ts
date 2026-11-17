import { useSyncExternalStore } from 'react';

export type ThemePreference = 'system' | 'light' | 'dark';
export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'life-rpg:theme';
const DARK_QUERY = '(prefers-color-scheme: dark)';
/** Фон каждой темы (globals.css, --background) — цвет системной панели и заставки. */
const BACKGROUND: Record<Theme, string> = { light: '#e6d9b8', dark: '#0d0b09' };

const listeners = new Set<() => void>();
let preference = readPreference();

/**
 * Выбор темы — настройка этого устройства, а не аккаунта (docs/ux.md, «Выбор темы»), поэтому в localStorage.
 * Хранилище может быть недоступно (приватный режим) — тогда просто следуем системе.
 */
function readPreference(): ThemePreference {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : 'system';
  } catch {
    return 'system';
  }
}

function resolve(value: ThemePreference): Theme {
  if (value !== 'system') return value;
  return window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light';
}

function apply() {
  const theme = resolve(preference);
  document.documentElement.dataset.theme = theme;
  // У каждого meta theme-color свой media: при «как в системе» он остаётся своим, при явном выборе
  // оба показывают выбранную тему.
  for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
    const own: Theme = meta.media.includes('dark') ? 'dark' : 'light';
    meta.content = BACKGROUND[preference === 'system' ? own : theme];
  }
  for (const listener of listeners) listener();
}

/** Вызывается в main.tsx до рендера: иначе первый кадр был бы в теме системы, а не в выбранной. */
export function initTheme() {
  apply();
  window.matchMedia(DARK_QUERY).addEventListener('change', () => preference === 'system' && apply());
}

export function setThemePreference(value: ThemePreference) {
  preference = value;
  try {
    if (value === 'system') localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // Без хранилища выбор живёт до перезагрузки — этого достаточно.
  }
  apply();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Выбор пользователя; хук — как `ref` из модуля во Vue: одно значение на всё приложение. */
export function useThemePreference(): ThemePreference {
  return useSyncExternalStore(subscribe, () => preference);
}

/** Тема, которая сейчас на экране: нужна тостам sonner, у них своя палитра. */
export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, () => resolve(preference));
}
