import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createMemoryHistory, createRouter } from '@tanstack/react-router';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { AuthContextValue } from '../../../auth/AuthContext';
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
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

function mockApiFetch(chapters: unknown[]) {
  vi.mocked(apiFetch).mockImplementation(async (path: string) => {
    if (path === '/collections') return COLLECTIONS as never;
    return chapters as never;
  });
}

describe('Chapters page', () => {
  it('resolves the slug to the right collection_id and renders each chapter with its seq and title', async () => {
    mockApiFetch([
      { chapter_id: 10, collection_id: 2, seq: 1, title_ar: 'كتاب الإيمان' },
      { chapter_id: 11, collection_id: 2, seq: 2, title_ar: 'كتاب الطهارة' },
    ]);
    renderAt('/collections/sahih-muslim');

    expect(await screen.findByText('كتاب الإيمان')).toBeInTheDocument();
    expect(screen.getByText('كتاب الطهارة')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();

    const [path] = vi
      .mocked(apiFetch)
      .mock.calls.find(([p]) => typeof p === 'string' && p.startsWith('/chapters'))!;
    expect(path).toBe('/chapters?collection_id=2&limit=50&offset=0');
  });

  it('renders two bare-title (باب) chapters as distinguishable rows via their seq', async () => {
    mockApiFetch([
      { chapter_id: 20, collection_id: 2, seq: 5, title_ar: 'باب' },
      { chapter_id: 21, collection_id: 2, seq: 6, title_ar: 'باب' },
    ]);
    renderAt('/collections/sahih-muslim');

    const bareTitles = await screen.findAllByText('باب');
    expect(bareTitles).toHaveLength(2);
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('6')).toBeInTheDocument();
  });

  it('shows the pager and its "Showing X–Y" text', async () => {
    mockApiFetch([{ chapter_id: 30, collection_id: 2, seq: 1, title_ar: 'كتاب الإيمان' }]);
    renderAt('/collections/sahih-muslim');

    expect(await screen.findByText('Showing 1–1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /previous/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /next/i })).toBeInTheDocument();
  });

  it('shows a plain error message when the collection cannot be found', async () => {
    vi.mocked(apiFetch).mockImplementation(async (path: string) => {
      if (path === '/collections') return COLLECTIONS as never;
      throw new Error('should not be called');
    });
    renderAt('/collections/does-not-exist');

    expect(await screen.findByText('This collection could not be found.')).toBeInTheDocument();
    expect(screen.queryByText(/chapters could not be loaded/i)).not.toBeInTheDocument();
  });

  it('shows the empty state when the collection has no chapters yet', async () => {
    mockApiFetch([]);
    renderAt('/collections/sahih-muslim');

    expect(await screen.findByText('This collection has no chapters yet.')).toBeInTheDocument();
  });
});
