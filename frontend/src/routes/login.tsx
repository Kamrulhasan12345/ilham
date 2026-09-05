import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';

export const Route = createFileRoute('/login')({
  validateSearch: z.object({ redirect: z.string().optional() }),
  component: LoginPage,
});

function LoginPage() {
  const { redirect } = Route.useSearch();
  return (
    <div>
      <h1>Sign in</h1>
      <p>The sign-in form lands in the Authentication phase.</p>
      {redirect ? <p>After you sign in, you return to {redirect}.</p> : null}
    </div>
  );
}
