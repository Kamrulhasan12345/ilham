import { createFileRoute } from '@tanstack/react-router';
import { DashboardPage } from '../app/Dashboard';
import { Landing } from '../app/Landing';
import { Shell } from '../app/Shell';
import { useAuth } from '../auth/AuthContext';

// '/' serves two audiences: signed-out visitors get the landing page, signed-in
// users get their dashboard inside the app shell.
export const Route = createFileRoute('/')({
  beforeLoad: async ({ context }) => {
    if (context.auth.state.status === 'loading') await context.auth.ready;
  },
  component: HomePage,
});

function HomePage() {
  const { state } = useAuth();
  if (state.status === 'loading') return null;
  if (state.status === 'signed-out') return <Landing />;
  return (
    <Shell>
      <DashboardPage />
    </Shell>
  );
}
