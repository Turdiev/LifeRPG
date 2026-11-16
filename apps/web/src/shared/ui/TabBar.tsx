import { Link } from '@tanstack/react-router';
import { BookOpen, Sunrise } from 'lucide-react';
import { ru } from '@/shared/strings/ru';

const tabs = [
  { to: '/today', label: ru.tabs.today, Icon: Sunrise },
  { to: '/journal', label: ru.tabs.journal, Icon: BookOpen },
] as const;

/** Нижняя панель: основные действия — в нижней трети экрана, под большим пальцем (docs/ux.md). */
export function TabBar() {
  return (
    <nav
      aria-label={ru.tabs.label}
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      <ul className="mx-auto flex max-w-[640px]">
        {tabs.map(({ to, label, Icon }) => (
          <li key={to} className="flex-1">
            <Link
              to={to}
              className="group/tab relative flex h-16 flex-col items-center justify-center gap-1 text-xs text-muted-foreground outline-none focus-visible:bg-muted data-[status=active]:text-foreground"
            >
              {/* Активную вкладку отличает и форма: разница только в оттенке текста не видна при дальтонизме и на солнце. */}
              <span
                aria-hidden
                className="absolute inset-x-0 top-0 mx-auto hidden h-0.5 w-12 rounded-b-full bg-foreground group-data-[status=active]/tab:block"
              />
              <Icon className="size-5" aria-hidden />
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
