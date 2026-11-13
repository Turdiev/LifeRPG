import { createFileRoute } from '@tanstack/react-router';
import { LinePage } from '@/features/line/LinePage';

// `?quest=` открывает лист деталей узла (tech-spec, «Маршруты»).
export const Route = createFileRoute('/_app/line/$lineId')({
  validateSearch: (search: Record<string, unknown>): { quest?: string } =>
    typeof search['quest'] === 'string' ? { quest: search['quest'] } : {},
  component: function LineRoute() {
    const { lineId } = Route.useParams();
    const { quest } = Route.useSearch();
    // key: при переходе на другую линию раскрытые главы и отметки сессии не переносятся.
    return <LinePage key={lineId} lineId={lineId} detailsId={quest} />;
  },
});
