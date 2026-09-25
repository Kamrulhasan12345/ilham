import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@/components/ui/empty';
import { Link, Outlet, createRootRouteWithContext, useRouterState } from '@tanstack/react-router';
import { useEffect } from 'react';
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
    document.getElementById('main')?.focus({ preventScroll: true });
  }, [pathname]);
  // The app chrome (Shell) lives in the _authed layout; signed-out pages own theirs.
  return <Outlet />;
}

function NotFound() {
  return <ErrorState title="That page does not exist" message="Nothing lives at this address." />;
}

export function RouteError({ error }: { error: Error }) {
  const message = error instanceof ApiError ? error.message : 'Something went wrong.';
  return <ErrorState title="Something went wrong" message={message} />;
}

function ErrorState({ title, message }: { title: string; message: string }) {
  return (
    <Empty id="main" tabIndex={-1} className="min-h-svh outline-none">
      <EmptyHeader>
        <EmptyTitle>
          <h1>{title}</h1>
        </EmptyTitle>
        <EmptyDescription>{message}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button variant="outline" asChild>
          <Link to="/collections">Return to the collections.</Link>
        </Button>
      </EmptyContent>
    </Empty>
  );
}
