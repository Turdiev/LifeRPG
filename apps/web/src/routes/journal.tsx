import { questStatusSchema } from '@life-rpg/shared';
import { createFileRoute } from '@tanstack/react-router';
import { JournalPage } from '@/features/journal/JournalPage';

// Фильтр живёт в адресе (`/journal?status=open`), чтобы работали закладки и «Назад».
export const Route = createFileRoute('/journal')({
  validateSearch: (search: Record<string, unknown>) => ({
    status: questStatusSchema.catch('open').parse(search['status']),
  }),
  component: function JournalRoute() {
    return <JournalPage status={Route.useSearch().status} />;
  },
});
