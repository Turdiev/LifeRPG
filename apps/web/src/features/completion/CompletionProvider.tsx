import { useState, type ReactNode } from 'react';
import { ShowCompletionContext } from './completion-context';
import type { CompletionView } from './completion-model';
import { CompletionOverlay } from './CompletionOverlay';

export function CompletionProvider({ children }: { children: ReactNode }) {
  const [view, setView] = useState<CompletionView | null>(null);
  return (
    <ShowCompletionContext.Provider value={setView}>
      {children}
      {/* Ключ по закрытому узлу: новое завершение — новый экран со своей анимацией с начала. */}
      {view && <CompletionOverlay key={view.id} view={view} onClose={() => setView(null)} />}
    </ShowCompletionContext.Provider>
  );
}
