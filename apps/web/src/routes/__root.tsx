import type { QueryClient } from '@tanstack/react-query';
import { createRootRouteWithContext, Outlet } from '@tanstack/react-router';

/** Каркас приложения с вкладками — в `_app.tsx`: экрану входа он не нужен. */
export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: Outlet,
});
