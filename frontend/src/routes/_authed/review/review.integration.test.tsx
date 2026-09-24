import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createMemoryHistory, createRouter } from '@tanstack/react-router';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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

const ASSIGNMENT = { assignment_id: 3, circle_id: 1, study_set_id: 9 };
const SET_ITEMS = {
  items: [
    { hadith_id: 100, hadith_num: '1', text_plain: 'إنما الأعمال بالنيات' },
    { hadith_id: 101, hadith_num: '2', text_plain: 'الدين النصيحة' },
  ],
};

function renderRunner() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const auth: AuthContextValue = {
    state: {
      status: 'signed-in',
      user: {
        user_id: 2,
        role: 'teacher',
        full_name: 'Ustadh',
        email: 't@x.io',
        is_verified: true,
      },
    },
    ready: Promise.resolve({
      status: 'signed-in',
      user: {
        user_id: 2,
        role: 'teacher',
        full_name: 'Ustadh',
        email: 't@x.io',
        is_verified: true,
      },
    }),
    signIn: async () => {},
    signOut: async () => {},
  };
  const history = createMemoryHistory({
    initialEntries: ['/review/new?student_id=7&assignment_id=3'],
  });
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

describe('Review runner integration', () => {
  it('submits every verdict in one transaction and lands on the session record', async () => {
    vi.mocked(apiFetch).mockImplementation(
      async (path: string, _schema: unknown, options?: { body?: unknown }) => {
        if (path === '/assignments/3') return ASSIGNMENT as never;
        if (path === '/sets/9') return SET_ITEMS as never;
        if (path === '/review-sessions') {
          const body = options?.body as { items: { hadith_id: number; result: string }[] };
          expect(body.items).toEqual([
            { hadith_id: 100, result: 'pass' },
            { hadith_id: 101, result: 'partial' },
          ]);
          return { session_id: 42 } as never;
        }
        throw new Error(`unexpected fetch ${path}`);
      },
    );
    const router = renderRunner();

    expect(await screen.findByText(/Hadith 0 of 2/)).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('radio', { name: 'Passed' })[0]);
    fireEvent.click(screen.getAllByRole('radio', { name: 'Partial' })[1]);

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Finish — save 2 verdicts/ })).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole('button', { name: /Finish — save 2 verdicts/ }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/review/42'));
  });

  it('refuses to submit before every hadith has a verdict', async () => {
    vi.mocked(apiFetch).mockImplementation(async (path: string) => {
      if (path === '/assignments/3') return ASSIGNMENT as never;
      if (path === '/sets/9') return SET_ITEMS as never;
      throw new Error(`unexpected fetch ${path}`);
    });
    renderRunner();

    expect(await screen.findByText(/Hadith 0 of 2/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Decide every hadith first/ })).toBeDisabled();
    expect(vi.mocked(apiFetch)).not.toHaveBeenCalledWith(
      '/review-sessions',
      expect.anything(),
      expect.anything(),
    );
  });
});
