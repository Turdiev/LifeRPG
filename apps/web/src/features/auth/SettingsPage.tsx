import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { ChevronLeft } from 'lucide-react';
import { sessionQuery, signOut } from '@/shared/api/auth';
import { ru } from '@/shared/strings/ru';
import { Button } from '@/shared/ui/button';

export function SettingsPage() {
  const session = useQuery(sessionQuery);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const exit = useMutation({
    mutationFn: signOut,
    onSuccess: () => {
      // На этом устройстве может войти другой человек: кеш прошлого аккаунта стираем целиком.
      queryClient.clear();
      void navigate({ to: '/login', replace: true });
    },
  });
  const user = session.data;

  return (
    <div className="space-y-6">
      <Link
        to="/journal"
        search={{ status: 'open' }}
        className="-ml-2 inline-flex h-11 items-center gap-1 rounded-lg px-2 text-sm text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ChevronLeft className="size-4" aria-hidden />
        {ru.settings.back}
      </Link>
      <h1 className="text-2xl">{ru.settings.title}</h1>

      {user && (
        <section aria-labelledby="settings-account" className="space-y-1">
          <h2 id="settings-account" className="text-sm text-muted-foreground font-sans">
            {ru.settings.account}
          </h2>
          <p className="font-medium break-words">{user.name}</p>
          <p className="text-muted-foreground break-words">{user.email}</p>
        </section>
      )}

      <div className="space-y-2">
        {/* Выход не удаляет данные и обратим входом — поэтому без подтверждения (docs/ux.md, «Подтверждения»). */}
        <Button variant="outline" className="h-11" disabled={exit.isPending} onClick={() => exit.mutate()}>
          {exit.isPending ? ru.settings.signingOut : ru.settings.signOut}
        </Button>
        {exit.isError && (
          <p role="alert" className="text-sm">
            {ru.settings.signOutFailed}
          </p>
        )}
      </div>
    </div>
  );
}
