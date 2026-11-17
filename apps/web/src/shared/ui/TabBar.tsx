import { Link } from '@tanstack/react-router';
import { ru } from '@/shared/strings/ru';
import { BookIcon, TodayIcon } from '@/shared/ui/icons';

const tabs = [
  { to: '/today', label: ru.tabs.today, Icon: TodayIcon },
  { to: '/journal', label: ru.tabs.journal, Icon: BookIcon },
] as const;

/** Нижняя панель: основные действия — в нижней трети экрана, под большим пальцем (docs/ux.md). */
export function TabBar() {
  return (
    <nav
      aria-label={ru.tabs.label}
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-linear-to-b from-background/80 to-background to-40% pb-[env(safe-area-inset-bottom)] backdrop-blur-sm"
    >
      <ul className="mx-auto flex max-w-[640px]">
        {tabs.map(({ to, label, Icon }) => (
          <li key={to} className="flex-1">
            <Link
              to={to}
              className="group/tab relative flex h-16 flex-col items-center justify-center gap-0.75 text-xs text-muted-foreground outline-none focus-visible:bg-surface-2 data-[status=active]:text-gold"
            >
              {/* Активную вкладку отличает и форма: разница только в оттенке текста не видна при дальтонизме и на солнце. */}
              <span
                aria-hidden
                className="absolute -top-px mx-auto hidden h-0.5 w-11 bg-gold shadow-[0_0_12px_var(--glow)] group-data-[status=active]/tab:block"
              />
              <Icon className="size-6" />
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
