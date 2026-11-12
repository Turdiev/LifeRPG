import { createFileRoute, Navigate } from '@tanstack/react-router';
import { TodayPage } from '@/features/today/TodayPage';
import { useIsDesktop } from '@/shared/hooks/use-media-query';

export const Route = createFileRoute('/today')({
  component: TodayRoute,
});

/**
 * На компьютере «Сегодня» уже в колонке слева, а рядом — журнал или линия (docs/ux.md,
 * «Карта экранов»): закладка или запуск PWA с `/today` открывают журнал.
 */
function TodayRoute() {
  const isDesktop = useIsDesktop();
  return isDesktop ? <Navigate to="/journal" search={{ status: 'open' }} replace /> : <TodayPage />;
}
