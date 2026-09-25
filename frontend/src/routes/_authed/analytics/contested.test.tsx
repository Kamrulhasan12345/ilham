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

const ROWS = [
  {
    narrator_id: 7,
    display_name: 'سفيان بن عيينة',
    rank_ibn_hajar: 'thiqah',
    ordinal_ibn_hajar: 6,
    label_ibn_hajar: 'ثقة',
    rank_dhahabi: 'saduq',
    ordinal_dhahabi: 5,
    label_dhahabi: 'صدوق',
  },
  {
    narrator_id: 9,
    display_name: 'شعبة بن الحجاج',
    rank_ibn_hajar: 'thiqah',
    ordinal_ibn_hajar: 6,
    label_ibn_hajar: 'ثقة',
    rank_dhahabi: 'daif',
    ordinal_dhahabi: 2,
    label_dhahabi: 'ضعيف',
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

describe('Contested narrators page', () => {
  it('renders each narrator with both grades and the gap, linking to the narrator page', async () => {
    vi.mocked(apiFetch).mockImplementation(async (path: string) => {
      if (typeof path === 'string' && path.startsWith('/analytics/contested-narrators')) {
        return ROWS as never;
      }
      throw new Error(`unexpected fetch ${path}`);
    });
    renderAt('/analytics/contested');

    expect(await screen.findByText('Where do the two scholars disagree?')).toBeInTheDocument();
    // The name shows twice: once in the dumbbell chart, once in the table.
    expect(screen.getAllByText('سفيان بن عيينة')).toHaveLength(2);
    // Grade labels show in the chart (with a tooltip) and in the table.
    expect(screen.getAllByText('صدوق')).toHaveLength(2);
    expect(screen.getAllByText('ضعيف')).toHaveLength(2);

    const link = screen.getByRole('link', { name: /سفيان بن عيينة/ });
    expect(link).toHaveAttribute('href', '/narrators/7');

    const [fetchedPath] = vi.mocked(apiFetch).mock.calls[0];
    expect(fetchedPath).toBe('/analytics/contested-narrators?limit=50');
  });

  it('shows a plain error message when the comparison cannot be loaded', async () => {
    vi.mocked(apiFetch).mockRejectedValue(new Error('boom'));
    renderAt('/analytics/contested');

    expect(await screen.findByText('The comparison could not be loaded')).toBeInTheDocument();
  });
});
