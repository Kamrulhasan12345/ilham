import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createMemoryHistory, createRouter } from '@tanstack/react-router';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { AuthContextValue } from './auth/AuthContext';
import type { AuthState } from './auth/guards';
import { routeTree } from './routeTree.gen';

vi.mock('./lib/apiClient', async () => {
  const actual = await vi.importActual<typeof import('./lib/apiClient')>('./lib/apiClient');
  return { ...actual, apiFetch: vi.fn() };
});

import { apiFetch } from './lib/apiClient';

// The signed-in home ('/') redirects to /collections (Task 7), which fetches
// real collections data. These tests only exercise routing/auth/focus
// behavior, not the Collections page's own data states (that's
// collections/index.test.tsx's job) — so mock a stable, minimal response.
const FAKE_COLLECTIONS = [
  {
    collection_id: 1,
    slug: 'sahih-al-bukhari',
    title_ar: 'صحيح البخاري',
    title_en: 'Sahih al-Bukhari',
  },
];

function fakeAuth(state: AuthState): AuthContextValue {
  return {
    state,
    ready: Promise.resolve(state),
    signIn: async () => {},
    signOut: async () => {},
  };
}

// The Collections page (reachable via '/') uses useQuery, so every render in
// this file needs a QueryClientProvider, not just an auth-aware router.
function renderRouter(router: Parameters<typeof RouterProvider>[0]['router']) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe('the signedIn guard', () => {
  it('redirects an unauthenticated visitor from / to /login', async () => {
    const history = createMemoryHistory({ initialEntries: ['/'] });
    const router = createRouter({
      routeTree,
      history,
      context: { auth: fakeAuth({ status: 'signed-out' }) },
    });
    renderRouter(router);

    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('lets a signed-in visitor reach the authenticated home', async () => {
    vi.mocked(apiFetch).mockResolvedValue(FAKE_COLLECTIONS);
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
    renderRouter(router);

    // '/' redirects to /collections (Task 7); a signed-in visitor lands on
    // the real Collections page, not a stub — assert its actual content.
    await waitFor(() => expect(router.state.location.pathname).toBe('/collections'));
    expect(await screen.findByText('صحيح البخاري')).toBeInTheDocument();
  });

  it('shows the not-found page for an unknown path', async () => {
    const history = createMemoryHistory({ initialEntries: ['/nowhere'] });
    const router = createRouter({
      routeTree,
      history,
      context: { auth: fakeAuth({ status: 'signed-out' }) },
    });
    renderRouter(router);

    expect(await screen.findByText('That page does not exist')).toBeInTheDocument();
  });
});

describe('focus management on route change', () => {
  it('moves focus to the #main landmark after a route change', async () => {
    vi.mocked(apiFetch).mockResolvedValue(FAKE_COLLECTIONS);
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
    renderRouter(router);
    await screen.findByRole('heading', { name: 'Sign in' });
    focusSpy.mockClear();

    await router.navigate({ to: '/' });
    await waitFor(() => expect(screen.getByText('صحيح البخاري')).toBeInTheDocument());

    const focusedMain = focusSpy.mock.instances.some(
      (instance) => (instance as unknown as HTMLElement).id === 'main',
    );
    expect(focusedMain).toBe(true);

    focusSpy.mockRestore();
  });
});
