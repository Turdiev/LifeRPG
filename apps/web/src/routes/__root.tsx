import { createRootRoute, Outlet } from '@tanstack/react-router';
import { ru } from '@/shared/strings/ru';
import { TabBar } from '@/shared/ui/TabBar';
import { Toaster } from '@/shared/ui/sonner';

// Отступ снизу у контента и тостов — высота панели вкладок (64 px) плюс поле 16–24 px.
// Тосты по одному, кнопка «Вернуть» — 44 px (docs/ux.md, «Общие состояния», «Основа»);
// `!` перебивает собственные стили sonner.
export const Route = createRootRoute({
  component: () => (
    <>
      <main className="mx-auto w-full max-w-160 px-4 pt-6 pb-28">
        <Outlet />
      </main>
      <TabBar />
      <Toaster
        position="bottom-center"
        offset={{ bottom: 88 }}
        mobileOffset={{ bottom: 88 }}
        duration={5000}
        visibleToasts={1}
        containerAriaLabel={ru.toasts.region}
        toastOptions={{ classNames: { actionButton: '!h-11 !px-3 !text-sm' } }}
      />
    </>
  ),
});
