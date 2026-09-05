import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createMemoryHistory, createRouter } from '@tanstack/react-router';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { AuthContextValue } from '../../../auth/AuthContext';
import { AuthContext } from '../../../auth/AuthContext';
import { routeTree } from '../../../routeTree.gen';

vi.mock('../../../lib/apiClient', async () => {
  const actual =
    await vi.importActual<typeof import('../../../lib/apiClient')>('../../../lib/apiClient');
  return { ...actual, apiFetch: vi.fn() };
});

import { apiFetch } from '../../../lib/apiClient';

function renderCollections() {
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
  const history = createMemoryHistory({ initialEntries: ['/collections'] });
  const router = createRouter({ routeTree, history, context: { auth } });
  return render(
    <AuthContext.Provider value={auth}>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </AuthContext.Provider>,
  );
}

describe('Collections page', () => {
  it('renders each collection with its Arabic and English titles, linked to its slug', async () => {
    vi.mocked(apiFetch).mockResolvedValue([
      {
        collection_id: 1,
        slug: 'sahih-al-bukhari',
        title_ar: 'صحيح البخاري',
        title_en: 'Sahih al-Bukhari',
      },
      { collection_id: 2, slug: 'sahih-muslim', title_ar: 'صحيح مسلم', title_en: 'Sahih Muslim' },
    ]);
    renderCollections();
    expect(await screen.findByText('صحيح البخاري')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /صحيح مسلم/ })).toHaveAttribute(
      'href',
      '/collections/sahih-muslim',
    );
  });

  it('falls back to the Arabic title when English is absent', async () => {
    vi.mocked(apiFetch).mockResolvedValue([
      { collection_id: 3, slug: 'example', title_ar: 'مثال', title_en: null },
    ]);
    renderCollections();
    expect(await screen.findByText('مثال')).toBeInTheDocument();
  });

  it('shows a plain error message when the request fails', async () => {
    vi.mocked(apiFetch).mockRejectedValue(new Error('network error'));
    renderCollections();
    expect(await screen.findByText(/could not be loaded/i)).toBeInTheDocument();
  });
});
