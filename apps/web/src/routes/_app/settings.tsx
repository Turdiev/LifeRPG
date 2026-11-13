import { createFileRoute } from '@tanstack/react-router';
import { SettingsPage } from '@/features/auth/SettingsPage';

// Пока только аккаунт и выход; вибрация и звук появятся вместе с `GET/PATCH /me/settings`.
export const Route = createFileRoute('/_app/settings')({
  component: SettingsPage,
});
