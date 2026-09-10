import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createMemoryHistory, createRouter } from '@tanstack/react-router';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { AuthContextValue } from '../auth/AuthContext';
import { AuthContext } from '../auth/AuthContext';
import type { AuthState } from '../auth/guards';
import { routeTree } from '../routeTree.gen';

vi.mock('../lib/apiClient', async () => {
  const actual = await vi.importActual<typeof import('../lib/apiClient')>('../lib/apiClient');
  return { ...actual, apiFetch: vi.fn() };
});

import { apiFetch } from '../lib/apiClient';

function fakeAuth(state: AuthState): AuthContextValue {
  return {
    state,
    ready: Promise.resolve(state),
    signIn: async () => {},
    signOut: async () => {},
  };
}

// Shell's nav now renders TanStack Router <Link>s (Task: nav-full-reload
// fix), and a <Link> throws without a real router in context. So, unlike
// before, this file renders Shell through a real RouterProvider — the same
// wiring routes/__root.tsx uses in production — instead of a bare <Shell>.
// Every _authed leaf page fetches through apiFetch on mount; the page body is
// not under test here (its own *.test.tsx covers that), so one shared
// empty-array stub satisfies every schema.
function renderShellAt(initialPath: string, state: AuthState) {
  vi.mocked(apiFetch).mockResolvedValue([]);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const history = createMemoryHistory({ initialEntries: [initialPath] });
  const auth = fakeAuth(state);
  const router = createRouter({ routeTree, history, context: { auth } });
  render(
    <AuthContext.Provider value={auth}>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </AuthContext.Provider>,
  );
  return router;
}

describe('role-aware shell', () => {
  it('shows the waiting banner to an unverified teacher', async () => {
    renderShellAt('/collections', {
      status: 'signed-in',
      user: {
        user_id: 2,
        role: 'teacher',
        full_name: 'Ustadh',
        email: 't@x.io',
        is_verified: false,
      },
    });
    expect(await screen.findByText(/waiting for review/i)).toBeInTheDocument();
  });

  it('shows no banner to a verified teacher', async () => {
    renderShellAt('/collections', {
      status: 'signed-in',
      user: {
        user_id: 2,
        role: 'teacher',
        full_name: 'Ustadh',
        email: 't@x.io',
        is_verified: true,
      },
    });
    await screen.findByRole('navigation', { name: 'Primary' });
    expect(screen.queryByText(/waiting for review/i)).not.toBeInTheDocument();
  });

  it('shows the signed-in name and role, and the verify link to an admin only', async () => {
    renderShellAt('/collections', {
      status: 'signed-in',
      user: { user_id: 9, role: 'admin', full_name: 'Root', email: 'a@x.io' },
    });
    expect(await screen.findByText(/root · admin/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Verify teachers' })).toBeInTheDocument();
  });

  it('hides the verify link from a student', async () => {
    renderShellAt('/collections', {
      status: 'signed-in',
      user: { user_id: 1, role: 'student', full_name: 'Amina', email: 's@x.io' },
    });
    await screen.findByRole('navigation', { name: 'Primary' });
    expect(screen.queryByRole('link', { name: 'Verify teachers' })).not.toBeInTheDocument();
  });

  it('shows the students link to a teacher but not to a student', async () => {
    renderShellAt('/collections', {
      status: 'signed-in',
      user: {
        user_id: 2,
        role: 'teacher',
        full_name: 'Ustadh',
        email: 't@x.io',
        is_verified: true,
      },
    });
    expect(await screen.findByRole('link', { name: 'Students' })).toBeInTheDocument();
  });

  it('hides the students link from a student', async () => {
    renderShellAt('/collections', {
      status: 'signed-in',
      user: { user_id: 1, role: 'student', full_name: 'Amina', email: 's@x.io' },
    });
    await screen.findByRole('navigation', { name: 'Primary' });
    expect(screen.queryByRole('link', { name: 'Students' })).not.toBeInTheDocument();
  });

  it('renders the nav as real router links: clicking one navigates client-side, not via a full reload', async () => {
    // A plain <a> would not update the router's own location in jsdom (a raw
    // anchor click either no-ops or hits jsdom's unimplemented-navigation
    // path). Only a TanStack Router <Link> intercepts the click, calls
    // preventDefault, and pushes the new location through the router itself
    // — so asserting the router's location changed is exactly the evidence
    // that this is a client-side SPA navigation, not a page reload.
    const router = renderShellAt('/collections', {
      status: 'signed-in',
      user: { user_id: 1, role: 'student', full_name: 'Amina', email: 's@x.io' },
    });
    const circlesLink = await screen.findByRole('link', { name: 'Circles' });
    fireEvent.click(circlesLink);
    await waitFor(() => expect(router.state.location.pathname).toBe('/circles'));
  });
});
