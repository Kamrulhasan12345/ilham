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
    // Scoped to the Appearance section: until Task 10 removes the shell's own
    // ThemeSwitch, an unscoped query would match both copies and fail with
    // "multiple elements found."
    const appearance = screen.getByRole('region', { name: 'Appearance' });
    expect(within(appearance).getByRole('group', { name: 'Ground' })).toBeInTheDocument();
  });
});
