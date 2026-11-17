import type { QueryClient } from '@tanstack/react-query';
import { createRootRouteWithContext, Outlet } from '@tanstack/react-router';
import { CheckboxDefs } from '@/shared/ui/checkbox';

/**
 * Каркас приложения с вкладками — в `_app.tsx`: экрану входа он не нужен. Градиент ромбов — здесь:
 * отмеченный ромб есть и в примере цели на экране входа.
 */
export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: function Root() {
    return (
      <>
        <CheckboxDefs />
        <Outlet />
      </>
    );
  },
});
