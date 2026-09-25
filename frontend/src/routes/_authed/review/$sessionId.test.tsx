import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createMemoryHistory, createRouter } from '@tanstack/react-router';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { AuthContextValue } from '../../../auth/AuthContext';
import { AuthContext } from '../../../auth/AuthContext';
import type { AuthUser } from '../../../auth/guards';
import { routeTree } from '../../../routeTree.gen';

vi.mock('../../../lib/apiClient', async () => {
  const actual =
    await vi.importActual<typeof import('../../../lib/apiClient')>('../../../lib/apiClient');
  return { ...actual, apiFetch: vi.fn() };
});

import { apiFetch } from '../../../lib/apiClient';

const SESSION = {
  session_id: 60,
  student_id: 5,
  reviewer_id: 2,
  circle_id: 1,
  created_at: '2026-03-01T00:00:00Z',
  items: [{ hadith_id: 100, result: 'pass' }],
};

const AUTHOR: AuthUser = {
  user_id: 2,
  role: 'teacher',
  full_name: 'Ustadh',
  email: 't@example.com',
  is_verified: true,
};
const OTHER_TEACHER: AuthUser = { ...AUTHOR, user_id: 8 };

function renderAt(path: string, user: AuthUser) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const auth: AuthContextValue = {
    state: { status: 'signed-in', user },
    ready: Promise.resolve({ status: 'signed-in', user }),
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

describe('Review record delete control', () => {
  it('shows the recording teacher a delete control that confirms before sending DELETE', async () => {
    vi.mocked(apiFetch).mockResolvedValue(SESSION as never);
    renderAt('/review/60', AUTHOR);

    expect(await screen.findByText(/Review session/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Delete this session' }));
    expect(await screen.findByText('Delete this session?')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Delete it' }));
    await vi.waitFor(() => {
      expect(vi.mocked(apiFetch)).toHaveBeenCalledWith('/review-sessions/60', expect.anything(), {
        method: 'DELETE',
      });
    });
  });

  it('hides the delete control from a teacher who did not record the session', async () => {
    vi.mocked(apiFetch).mockResolvedValue(SESSION as never);
    renderAt('/review/60', OTHER_TEACHER);

    expect(await screen.findByText(/Review session/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete this session' })).not.toBeInTheDocument();
  });
});
