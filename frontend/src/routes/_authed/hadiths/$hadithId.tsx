import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/hadiths/$hadithId')({
  component: () => <p>Coming next.</p>,
});
