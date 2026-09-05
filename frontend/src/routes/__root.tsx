import { Outlet, createRootRouteWithContext, useRouterState } from '@tanstack/react-router';
import { useEffect } from 'react';
import { Shell } from '../app/Shell';
import type { AuthContextValue } from '../auth/AuthContext';
import { ApiError } from '../lib/apiClient';

export interface RouterContext {
  auth: AuthContextValue;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootComponent,
  notFoundComponent: NotFound,
  errorComponent: RouteError,
});

function RootComponent() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  // docs/frontend-prd.md §6: move focus to #main on every route change so a
  // screen reader announces the new page. `pathname` drives re-firing this
  // effect; the focus call itself does not read it.
  // biome-ignore lint/correctness/useExhaustiveDependencies: pathname is an intentional re-run trigger, not a value the effect body reads
  useEffect(() => {
    document.getElementById('main')?.focus();
  }, [pathname]);
  return (
    <Shell>
      <Outlet />
    </Shell>
  );
}

function NotFound() {
  return (
    <div>
      <h1>That page does not exist</h1>
      <p>
        <a href="/">Return home.</a>
      </p>
    </div>
  );
}

export function RouteError({ error }: { error: Error }) {
  const message = error instanceof ApiError ? error.message : 'Something went wrong.';
  return (
    <div>
      <h1>Something went wrong</h1>
      <p>{message}</p>
      <p>
        <a href="/">Return home.</a>
      </p>
    </div>
  );
}
