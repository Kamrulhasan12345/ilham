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

const COLLECTIONS = [
  {
    collection_id: 1,
    slug: 'sahih-al-bukhari',
    title_ar: 'صحيح البخاري',
    title_en: 'Sahih al-Bukhari',
  },
  { collection_id: 2, slug: 'sahih-muslim', title_ar: 'صحيح مسلم', title_en: 'Sahih Muslim' },
];
const KITABS = [
  {
    kitab_id: 1,
    collection_id: 1,
    kitab_num: 1,
    title_en: 'Revelation',
    title_ar: 'كتاب بدء الوحى',
    bab_count: 6,
    hadith_count: 7,
  },
  {
    kitab_id: 2,
    collection_id: 1,
    kitab_num: 2,
    title_en: 'Belief',
    title_ar: 'كتاب الإيمان',
    bab_count: 42,
    hadith_count: 50,
  },
];

function renderAt(path: string) {
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
  const history = createMemoryHistory({ initialEntries: [path] });
  const router = createRouter({ routeTree, history, context: { auth } });
  return render(
    <AuthContext.Provider value={auth}>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </AuthContext.Provider>,
  );
}

function mockApiFetch(kitabs: unknown[]) {
  vi.mocked(apiFetch).mockImplementation(async (path: string) => {
    if (path === '/collections') return COLLECTIONS as never;
    return kitabs as never;
  });
}

describe('Kitabs page', () => {
  it('resolves the slug to its collection_id and lists each kitab, English first, linking by kitab number', async () => {
    mockApiFetch(KITABS);
    renderAt('/collections/sahih-al-bukhari');

    expect(await screen.findByText('Revelation')).toBeInTheDocument();
    expect(screen.getByText('كتاب الإيمان')).toBeInTheDocument();
    expect(screen.getByText('42 chapters · 50 hadiths')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Belief/ })).toHaveAttribute(
      'href',
      '/collections/sahih-al-bukhari/2',
    );
    const [kitabsPath] = vi
      .mocked(apiFetch)
      .mock.calls.find(([p]) => typeof p === 'string' && p.startsWith('/kitabs'))!;
    expect(kitabsPath).toBe('/kitabs?collection_id=1');
  });

  it('shows the empty state when the collection has no kitabs yet', async () => {
    mockApiFetch([]);
    renderAt('/collections/sahih-muslim');
    expect(await screen.findByText('This collection has no books yet')).toBeInTheDocument();
  });

  it('shows a plain message for an unknown collection', async () => {
    mockApiFetch(KITABS);
    renderAt('/collections/nope');
    expect(await screen.findByText('No such collection')).toBeInTheDocument();
  });
});
