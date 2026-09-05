import { RouterProvider, createMemoryHistory, createRouter } from '@tanstack/react-router';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
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
          user: { user_id: 1, role: 'student', full_name: 'Amina', email: 'a@example.com' },
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

describe('focus management on route change', () => {
  it('moves focus to the #main landmark after a route change', async () => {
    const focusSpy = vi.spyOn(HTMLElement.prototype, 'focus');
    const history = createMemoryHistory({ initialEntries: ['/login'] });
    const router = createRouter({
      routeTree,
      history,
      context: {
        auth: fakeAuth({
          status: 'signed-in',
          user: { user_id: 1, role: 'student', full_name: 'Amina', email: 'a@example.com' },
        }),
      },
    });
    render(<RouterProvider router={router} />);
    await screen.findByRole('heading', { name: 'Sign in' });
    focusSpy.mockClear();

    await router.navigate({ to: '/' });
    await waitFor(() => expect(screen.getByText(/you are signed in/i)).toBeInTheDocument());

    const focusedMain = focusSpy.mock.instances.some(
      (instance) => (instance as unknown as HTMLElement).id === 'main',
    );
    expect(focusedMain).toBe(true);

    focusSpy.mockRestore();
  });
});
