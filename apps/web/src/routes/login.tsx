import { createFileRoute, redirect } from '@tanstack/react-router';
import { LoginPage } from '@/features/auth/LoginPage';
import { sessionQuery } from '@/shared/api/auth';

// `?error=` дописывает Better Auth, если Google вернул ошибку или вход отменили.
export const Route = createFileRoute('/login')({
  validateSearch: (search: Record<string, unknown>): { error?: string } =>
    typeof search['error'] === 'string' ? { error: search['error'] } : {},
  beforeLoad: async ({ context }) => {
    if (await context.queryClient.ensureQueryData(sessionQuery)) throw redirect({ to: '/today', replace: true });
  },
  component: function LoginRoute() {
    return <LoginPage failed={Route.useSearch().error !== undefined} />;
  },
});
