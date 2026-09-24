import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createMemoryHistory, createRouter } from '@tanstack/react-router';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { AuthContextValue } from '../../auth/AuthContext';
import { AuthContext } from '../../auth/AuthContext';
import { routeTree } from '../../routeTree.gen';

function renderSettings() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const auth: AuthContextValue = {
    state: {
      status: 'signed-in',
      user: { user_id: 1, role: 'student', full_name: 'Amina', email: 'a@example.com' },
    },
    ready: Promise.resolve({
      status: 'signed-in',
      user: { user_id: 1, role: 'student', full_name: 'Amina', email: 'a@example.com' },
    }),
    signIn: async () => {},
    signOut: async () => {},
  };
  const history = createMemoryHistory({ initialEntries: ['/settings'] });
  const router = createRouter({ routeTree, history, context: { auth } });
  return render(
    <AuthContext.Provider value={auth}>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </AuthContext.Provider>,
  );
}

describe('Settings page', () => {
  it('renders the Settings title and the theme switch', async () => {
    renderSettings();
    expect(await screen.findByRole('heading', { level: 1, name: 'Settings' })).toBeInTheDocument();
    // One toggle button, not the old two-ground segmented control. Scoped
    // out of necessity: the shell header holds its own ThemeSwitch, so an
    // unscoped query would match both copies.
    const card = (await screen.findByText('Light or dark. The app remembers your choice.')).closest(
      '[data-slot="card"]',
    );
    expect(card).not.toBeNull();
    expect(
      within(card as HTMLElement).getByRole('button', { name: /switch to (light|dark) theme/i }),
    ).toBeInTheDocument();
  });
});
