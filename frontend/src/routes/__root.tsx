import { Outlet, createRootRouteWithContext } from '@tanstack/react-router';
import { Shell } from '../app/Shell';
import type { AuthContextValue } from '../auth/AuthContext';

export interface RouterContext {
  auth: AuthContextValue;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootComponent,
  notFoundComponent: NotFound,
});

function RootComponent() {
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
