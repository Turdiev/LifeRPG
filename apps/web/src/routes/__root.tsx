import { createRootRoute, Outlet } from '@tanstack/react-router';
import { TodayPage } from '@/features/today/TodayPage';
import { useIsDesktop } from '@/shared/hooks/use-media-query';
import { ru } from '@/shared/strings/ru';
import { TabBar } from '@/shared/ui/TabBar';
import { Toaster } from '@/shared/ui/sonner';

// Отступ снизу у контента и тостов — высота панели вкладок (64 px) плюс поле 16–24 px.
// Тосты по одному, кнопка «Вернуть» — 44 px (docs/ux.md, «Общие состояния», «Основа»);
// `!` перебивает собственные стили sonner.
export const Route = createRootRoute({
  component: RootLayout,
});

/**
 * Телефон — один экран и нижние вкладки. От 1024 px «Сегодня» — постоянная колонка слева,
 * рядом журнал или линия (docs/ux.md, «Карта экранов»). Колонку не прячем стилями, а не
 * рендерим: иначе на `/today` экран был бы смонтирован дважды, с двойными запросами и id.
 */
function RootLayout() {
  const isDesktop = useIsDesktop();

  return (
    <>
      <div className="lg:flex">
        {isDesktop && (
          <aside
            aria-label={ru.tabs.today}
            // На 1024–1279 px уже: с открытой панелью деталей колонке линии остаётся 384 px — как телефон.
            className="sticky top-0 h-dvh w-80 shrink-0 overflow-y-auto border-r px-4 pt-6 pb-8 xl:w-88"
          >
            <TodayPage />
          </aside>
        )}
        {/* Открытая панель деталей линии (fixed справа) забирает у колонки 20rem. */}
        <main className="mx-auto w-full max-w-160 min-w-0 px-4 pt-6 pb-28 lg:pb-10 lg:has-[[data-details-panel]]:mr-80">
          <Outlet />
        </main>
      </div>
      {!isDesktop && <TabBar />}
      <Toaster
        position="bottom-center"
        offset={{ bottom: isDesktop ? 24 : 88 }}
        mobileOffset={{ bottom: 88 }}
        duration={5000}
        visibleToasts={1}
        containerAriaLabel={ru.toasts.region}
        toastOptions={{ classNames: { actionButton: '!h-11 !px-3 !text-sm' } }}
      />
    </>
  );
}
