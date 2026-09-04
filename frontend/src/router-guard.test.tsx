import { RouterProvider, createMemoryHistory, createRouter } from '@tanstack/react-router';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { AuthContextValue } from './auth/AuthContext';
import type { AuthState } from './auth/guards';
import { routeTree } from './routeTree.gen';

function fakeAuth(state: AuthState): AuthContextValue {
  return {
    state,
    ready: Promise.resolve(state),
    signIn: async () => {},
    signOut: async () => {},
  };
}

describe('the signedIn guard', () => {
  it('redirects an unauthenticated visitor from / to /login', async () => {
    const history = createMemoryHistory({ initialEntries: ['/'] });
    const router = createRouter({
      routeTree,
      history,
      context: { auth: fakeAuth({ status: 'signed-out' }) },
    });
    render(<RouterProvider router={router} />);

    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('lets a signed-in visitor reach the authenticated home', async () => {
    const history = createMemoryHistory({ initialEntries: ['/'] });
    const router = createRouter({
      routeTree,
      history,
      context: {
        auth: fakeAuth({
          status: 'signed-in',
          user: { userId: 1, role: 'student', name: 'Amina', email: 'a@example.com' },
        }),
      },
    });
    render(<RouterProvider router={router} />);

    expect(await screen.findByText(/you are signed in/i)).toBeInTheDocument();
  });

  it('shows the not-found page for an unknown path', async () => {
    const history = createMemoryHistory({ initialEntries: ['/nowhere'] });
    const router = createRouter({
      routeTree,
      history,
      context: { auth: fakeAuth({ status: 'signed-out' }) },
    });
    render(<RouterProvider router={router} />);

    expect(await screen.findByText('That page does not exist')).toBeInTheDocument();
  });
});
