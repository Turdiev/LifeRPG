import { healthResponseSchema } from '@life-rpg/shared';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { ru } from '../shared/strings/ru';

async function fetchHealth() {
  const res = await fetch('/api/health');
  // The API answers 503 with the same body shape when the database is down.
  return healthResponseSchema.parse(await res.json());
}

function TodayPage() {
  const health = useQuery({ queryKey: ['health'], queryFn: fetchHealth });

  return (
    <main>
      <h1>{ru.today.title}</h1>
      <p>{ru.today.stub}</p>
      <p>
        {ru.health.label}:{' '}
        {health.isPending
          ? ru.health.checking
          : health.isError
            ? ru.health.unreachable
            : health.data.status === 'ok'
              ? ru.health.ok
              : ru.health.dbDown}
      </p>
    </main>
  );
}

export const Route = createFileRoute('/today')({
  component: TodayPage,
});
