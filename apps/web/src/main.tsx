import '@fontsource/philosopher/700.css';
import './styles/globals.css';
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRouter, RouterProvider } from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { routeTree } from './routeTree.gen';
import { ApiError } from './shared/api/client';
import { RouteError } from './shared/ui/RouteError';

/**
 * Сессия истекла или её отозвали: кеш с данными прошлого входа стираем целиком (на устройстве
 * может войти другой человек) и уводим на вход. Сюда приходят ошибки всех запросов и мутаций.
 */
function onApiError(error: Error) {
  if (!(error instanceof ApiError) || error.status !== 401) return;
  // Первый `clear` — до перехода, иначе `/login` возьмёт сессию из кеша и вернёт обратно. Второй —
  // после: откат оптимистичной мутации срабатывает уже после этого обработчика и вернул бы в кеш снимок.
  queryClient.clear();
  void router.navigate({ to: '/login', replace: true }).then(() => queryClient.clear());
}

const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: onApiError }),
  mutationCache: new MutationCache({ onError: onApiError }),
  defaultOptions: {
    queries: {
      // Ответ 4xx при повторе не изменится; сбой сети или 5xx — повторяем один раз.
      retry: (failureCount, error) => failureCount < 1 && !(error instanceof ApiError && error.status < 500),
      staleTime: 30_000,
    },
  },
});
// queryClient — в контексте роутера: защищённые маршруты проверяют сессию в beforeLoad через тот же кеш.
const router = createRouter({ routeTree, context: { queryClient }, defaultErrorComponent: RouteError });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

// Открытая вкладка ещё на старой сборке, а после деплоя новый сервис-воркер уже удалил её ленивые
// чанки: экран линии или настроек не загрузится. Перезагрузка подтянет новую сборку целиком —
// так советует Vite («Load Error Handling»); в PWA на iOS кнопки перезагрузки нет.
window.addEventListener('vite:preloadError', () => window.location.reload());

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Root element #root not found');

createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
