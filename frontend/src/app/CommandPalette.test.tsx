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

const SIGNED_IN: AuthState = {
  status: 'signed-in',
  user: { user_id: 1, role: 'student', full_name: 'Amina', email: 's@x.io' },
};

function renderShellAt(initialPath: string) {
  vi.mocked(apiFetch).mockResolvedValue([]);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const history = createMemoryHistory({ initialEntries: [initialPath] });
  const auth: AuthContextValue = {
    state: SIGNED_IN,
    ready: Promise.resolve(SIGNED_IN),
    signIn: async () => {},
    signOut: async () => {},
  };
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

describe('command palette', () => {
  it('searches the corpus for the typed words', async () => {
    const router = renderShellAt('/collections');
    fireEvent.click(await screen.findByRole('button', { name: /search hadiths/i }));
    fireEvent.change(await screen.findByPlaceholderText(/search the arabic text/i), {
      target: { value: 'النية' },
    });
    fireEvent.click(await screen.findByRole('option', { name: /search for/i }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/search'));
    expect(router.state.location.search).toMatchObject({ q: 'النية' });
  });

  it('navigates to a page from the Go to group', async () => {
    const router = renderShellAt('/collections');
    fireEvent.click(await screen.findByRole('button', { name: /search hadiths/i }));
    fireEvent.click(await screen.findByRole('option', { name: 'Notes' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/notes'));
  });
});
