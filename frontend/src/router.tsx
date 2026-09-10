import { createRouter } from '@tanstack/react-router';
import type { AuthContextValue } from './auth/AuthContext';
import { routeTree } from './routeTree.gen';

export const router = createRouter({
  routeTree,
  context: { auth: undefined as unknown as AuthContextValue },
  defaultPreload: 'intent',
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
