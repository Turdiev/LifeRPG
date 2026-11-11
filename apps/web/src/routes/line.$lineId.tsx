import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { ChevronLeft } from 'lucide-react';
import { percent } from '@/features/journal/journal-model';
import { ApiError } from '@/shared/api/client';
import { queryKeys } from '@/shared/api/keys';
import { fetchTree } from '@/shared/api/quests-api';
import { ru } from '@/shared/strings/ru';
import { Progress } from '@/shared/ui/progress';

// Заглушка экрана линии: дерево, «+ Добавить …» и отметки появятся в шаге 4b.
export const Route = createFileRoute('/line/$lineId')({
  component: function LineRoute() {
    const { lineId } = Route.useParams();
    const tree = useQuery({ queryKey: queryKeys.tree(lineId), queryFn: () => fetchTree(lineId) });
    const line = tree.data?.nodes.find((node) => node.id === lineId);

    return (
      <div className="space-y-4">
        <Link
          to="/journal"
          search={{ status: 'open' }}
          className="-ml-2 inline-flex h-11 items-center gap-1 rounded-lg px-2 text-sm text-muted-foreground"
        >
          <ChevronLeft className="size-4" aria-hidden />
          {ru.line.back}
        </Link>
        {tree.isError && (
          <p>
            {tree.error instanceof ApiError && tree.error.status === 404 ? ru.line.notFound : ru.line.loadError}
          </p>
        )}
        {line && (
          <>
            <h1 className="text-2xl">{line.title}</h1>
            <Progress value={percent(line.progress)} aria-label={ru.journal.progressLabel(line.title)} />
            <p className="text-muted-foreground">{ru.line.stub}</p>
          </>
        )}
      </div>
    );
  },
});
