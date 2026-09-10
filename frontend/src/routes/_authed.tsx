import { Outlet, createFileRoute, redirect } from '@tanstack/react-router';
import { evaluateGuard } from '../auth/guards';

export const Route = createFileRoute('/_authed')({
  beforeLoad: async ({ context, location }) => {
    const resolvedState =
      context.auth.state.status === 'loading' ? await context.auth.ready : context.auth.state;
    if (evaluateGuard(resolvedState, 'signedIn') === 'redirect-login') {
      throw redirect({ to: '/login', search: { redirect: location.href } });
    }
  },
  component: () => <Outlet />,
});
