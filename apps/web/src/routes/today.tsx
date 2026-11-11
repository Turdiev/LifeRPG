import { healthResponseSchema } from '@life-rpg/shared';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { ru } from '../shared/strings/ru';

async function fetchHealth() {
  const res = await fetch('/api/health');
  // Если база недоступна, API отвечает 503 с телом той же формы.
  return healthResponseSchema.parse(await res.json());
}

function TodayPage() {
  const health = useQuery({ queryKey: ['health'], queryFn: fetchHealth });

  return (
    <section className="space-y-3">
      <h1 className="text-2xl">{ru.today.title}</h1>
      <p>{ru.today.stub}</p>
      <p className="text-sm text-muted-foreground">
        {ru.health.label}:{' '}
        {health.isPending
          ? ru.health.checking
          : health.isError
            ? ru.health.unreachable
            : health.data.status === 'ok'
              ? ru.health.ok
              : ru.health.dbDown}
      </p>
    </section>
  );
}

export const Route = createFileRoute('/today')({
  component: TodayPage,
});
