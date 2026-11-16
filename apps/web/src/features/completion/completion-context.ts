import { createContext, useContext } from 'react';
import type { CompletionView } from './completion-model';

/**
 * Показать экран завершения. Context вместо стора: одно состояние «показать или скрыть» на всё
 * приложение — как provide/inject во Vue; поставщик — CompletionProvider в корневом layout.
 */
export const ShowCompletionContext = createContext<(view: CompletionView) => void>(() => {});

export function useShowCompletion() {
  return useContext(ShowCompletionContext);
}
