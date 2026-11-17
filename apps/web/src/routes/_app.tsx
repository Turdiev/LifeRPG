import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import { CompletionProvider } from '@/features/completion/CompletionProvider';
import { TodayPage } from '@/features/today/TodayPage';
import { sessionQuery } from '@/shared/api/auth';
import { useIsDesktop } from '@/shared/hooks/use-media-query';
import { ru } from '@/shared/strings/ru';
import { LineIcon } from '@/shared/ui/icons';
import { TabBar } from '@/shared/ui/TabBar';
import { Toaster } from '@/shared/ui/sonner';

/**
 * Всё приложение, кроме входа: без сессии — на `/login` (tech-spec, «Маршруты»: «С сессией»).
 * Сессия берётся из кеша TanStack Query: переходы между экранами не ходят за ней на сервер.
 */
export const Route = createFileRoute('/_app')({
  beforeLoad: async ({ context }) => {
    const user = await context.queryClient.ensureQueryData(sessionQuery);
    if (!user) throw redirect({ to: '/login', replace: true });
  },
  component: AppLayout,
});

/**
 * Телефон — один экран и нижние вкладки. От 1024 px «Сегодня» — постоянная колонка слева,
 * рядом журнал или линия (docs/ux.md, «Карта экранов»). Колонку не прячем стилями, а не
 * рендерим: иначе на `/today` экран был бы смонтирован дважды, с двойными запросами и id.
 *
 * Отступ снизу у контента и тостов — высота панели вкладок (64 px) плюс поле 16–24 px.
 * Тосты по одному, кнопка «Вернуть» — 44 px (docs/ux.md, «Общие состояния», «Основа»);
 * `!` перебивает собственные стили sonner.
 */
function AppLayout() {
  const isDesktop = useIsDesktop();

  return (
    // Экран завершения — над обеими колонками: главу можно закрыть и с «Сегодня», и с экрана линии.
    <CompletionProvider>
      <div className="lg:flex">
        {isDesktop && (
          <aside
            aria-label={ru.tabs.today}
            // На 1024–1279 px уже: с открытой панелью деталей колонке линии остаётся 384 px — как телефон.
            className="sticky top-0 h-dvh w-80 shrink-0 overflow-y-auto border-r bg-linear-to-r from-black/20 to-transparent px-5 pt-5 pb-8 xl:w-96 xl:px-6"
          >
            <p className="mb-4 flex items-center gap-3 font-heading text-lg tracking-[0.3em] text-gold-text">
              <LineIcon className="size-7.5 text-gold" />
              {ru.common.brand}
            </p>
            <TodayPage />
          </aside>
        )}
        {/* На компьютере колонка прижата к «Сегодня», а не центрирована: читается слева направо, от дела к
            плану, а свободное место — справа, под панель деталей. Ширина контента до 720 px (max-w — вместе
            с полями). Открытая панель (fixed справа) резервирует 20rem отступом: где места хватает
            (от ~1500 px), колонка не двигается, где нет — сжимается. */}
        <main className="mx-auto w-full max-w-160 min-w-0 px-4 pt-6 pb-28 lg:mx-0 lg:max-w-188 lg:pb-10 lg:has-[[data-details-panel]]:mr-80 xl:max-w-200 xl:px-10">
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
        // Тост — тихая плашка с золотой кромкой слева; ошибка — янтарной (макет docs/design/rpg-mockups.html).
        toastOptions={{
          classNames: {
            toast: '!border-l-3 !border-l-gold !shadow-[0_10px_30px_#0008] !text-[0.9375rem]',
            error: '!border-l-overdue',
            actionButton: '!h-11 !px-3 !text-sm !bg-transparent !text-gold !font-medium',
          },
        }}
      />
    </CompletionProvider>
  );
}
