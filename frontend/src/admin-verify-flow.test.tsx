import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createMemoryHistory, createRouter } from '@tanstack/react-router';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { routeTree } from './routeTree.gen';

vi.mock('./lib/apiClient', async () => {
  const actual = await vi.importActual<typeof import('./lib/apiClient')>('./lib/apiClient');
  return { ...actual, apiFetch: vi.fn() };
});

import { ApiError, apiFetch } from './lib/apiClient';

const STUDENT = {
  user_id: 1,
  role: 'student',
  full_name: 'Amina',
  email: 'a@example.com',
};
const ADMIN = {
  user_id: 9,
  role: 'admin',
  full_name: 'Demo Admin',
  email: 'demo-admin@example.com',
};

// The live-app wiring from main.tsx: the router context comes from useAuth.
function renderAppWithAuth(initialPath: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const history = createMemoryHistory({ initialEntries: [initialPath] });
  const router = createRouter({ routeTree, history, context: { auth: undefined! } });
  function InnerApp() {
    const auth = useAuth();
    return <RouterProvider router={router} context={{ auth }} />;
  }
  render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <InnerApp />
      </AuthProvider>
    </QueryClientProvider>,
  );
  return router;
}

async function signInAs(email: string, password: string) {
  fireEvent.change(await screen.findByLabelText('Email'), { target: { value: email } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: password } });
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
}

describe('role switch in one tab', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows the admin queue after signing out as a student and in as an admin', async () => {
    // Startup restore (refreshAccessToken) uses raw fetch, not apiFetch.
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ data: { accessToken: 'tok-student' } })),
    );
    let me: unknown = STUDENT;
    vi.mocked(apiFetch).mockImplementation(async (path: string) => {
      if (path === '/auth/refresh') return { accessToken: 'tok-student' } as never;
      if (path === '/auth/login') return { accessToken: 'tok-latest' } as never;
      if (path === '/auth/logout') return null as never;
      if (path === '/auth/me') {
        if (me === null) throw new ApiError(401, 'unauthenticated', 'no session');
        return me as never;
      }
      if (path === '/teachers/unverified') return [] as never;
      if (path === '/collections') return [] as never;
      throw new Error(`unexpected apiFetch path in test: ${path}`);
    });

    // Startup restores the student session from the refresh cookie.
    const router = renderAppWithAuth('/collections');
    expect(
      await screen.findByText((_, el) => el?.textContent === 'Amina · student'),
    ).toBeInTheDocument();

    await router.navigate({ to: '/admin/verify' });
    expect(await screen.findByText(/does not hold that role/i)).toBeInTheDocument();

    // Switch accounts without reloading.
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    me = ADMIN;
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    await signInAs('demo-admin@example.com', 'password123');
    await waitFor(() => expect(router.state.location.pathname).toBe('/collections'));
    expect(
      await screen.findByText((_, el) => el?.textContent === 'Demo Admin · admin'),
    ).toBeInTheDocument();

    await router.navigate({ to: '/admin/verify' });
    expect(await screen.findByText(/no teacher waits for review/i)).toBeInTheDocument();
    expect(screen.queryByText(/does not hold that role/i)).not.toBeInTheDocument();
  });
});
