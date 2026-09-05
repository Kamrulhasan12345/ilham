import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/collections/$slug/$seq')({
  component: () => <p>Coming next.</p>,
});
