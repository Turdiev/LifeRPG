import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { sessionQuery, signOut } from '@/shared/api/auth';
import { leaveSession } from '@/shared/api/leave-session';
import { setThemePreference, useThemePreference, type ThemePreference } from '@/shared/lib/theme';
import { ru } from '@/shared/strings/ru';
import { Button } from '@/shared/ui/button';
import { BackIcon } from '@/shared/ui/icons';
import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group';

const themes: ThemePreference[] = ['system', 'light', 'dark'];

export function SettingsPage() {
  const session = useQuery(sessionQuery);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const theme = useThemePreference();
  const exit = useMutation({
    mutationFn: signOut,
    onSuccess: () => leaveSession(queryClient, () => navigate({ to: '/login', replace: true })),
  });
  const user = session.data;

  return (
    <div className="space-y-6">
      <Link
        to="/journal"
        search={{ status: 'open' }}
        className="-ml-2 inline-flex h-11 items-center gap-1 rounded-full px-2 text-sm text-muted-foreground outline-none focus-visible:outline-2 focus-visible:outline-ring"
      >
        <BackIcon className="size-4" />
        {ru.settings.back}
      </Link>
      <h1 className="type-banner">{ru.settings.title}</h1>

      {user && (
        <section aria-labelledby="settings-account" className="space-y-1">
          <h2 id="settings-account" className="text-sm text-muted-foreground">
            {ru.settings.account}
          </h2>
          <p className="font-medium break-words">{user.name}</p>
          <p className="text-muted-foreground break-words">{user.email}</p>
        </section>
      )}

      {/* По умолчанию — как в системе; выбор живёт на этом устройстве (shared/lib/theme.ts). */}
      <section aria-labelledby="settings-theme" className="space-y-2">
        <h2 id="settings-theme" className="text-sm text-muted-foreground">
          {ru.settings.theme.title}
        </h2>
        <ToggleGroup
          type="single"
          variant="outline"
          value={theme}
          // Снять выбор нельзя: пустое значение означает повторный клик по выбранной теме.
          onValueChange={(value) => value && setThemePreference(value as ThemePreference)}
          aria-labelledby="settings-theme"
          className="flex-wrap"
        >
          {themes.map((value) => (
            <ToggleGroupItem key={value} value={value}>
              {ru.settings.theme[value]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </section>

      <div className="space-y-2">
        {/* Выход не удаляет данные и обратим входом — поэтому без подтверждения (docs/ux.md, «Подтверждения»). */}
        <Button variant="outline" disabled={exit.isPending} onClick={() => exit.mutate()}>
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
