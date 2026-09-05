import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/collections/$slug')({
  component: () => <p>Hadith detail page (Task 8)</p>,
});
