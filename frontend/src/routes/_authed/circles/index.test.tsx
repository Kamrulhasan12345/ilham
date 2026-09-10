import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createMemoryHistory, createRouter } from '@tanstack/react-router';
import { render, screen } from '@testing-library/react';
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

function renderCircles(user: AuthUser) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const auth: AuthContextValue = {
    state: { status: 'signed-in', user },
    ready: Promise.resolve({ status: 'signed-in', user }),
    signIn: async () => {},
    signOut: async () => {},
  };
  const history = createMemoryHistory({ initialEntries: ['/circles'] });
  const router = createRouter({ routeTree, history, context: { auth } });
  return render(
    <AuthContext.Provider value={auth}>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </AuthContext.Provider>,
  );
}

const VERIFIED_TEACHER: AuthUser = {
  user_id: 2,
  role: 'teacher',
  full_name: 'Ustadh',
  email: 't@example.com',
  is_verified: true,
};
const WAITING_TEACHER: AuthUser = { ...VERIFIED_TEACHER, is_verified: false };
const STUDENT: AuthUser = {
  user_id: 1,
  role: 'student',
  full_name: 'Amina',
  email: 'a@example.com',
};

describe('Circles page', () => {
  it('shows a verified teacher the create control and their circles', async () => {
    vi.mocked(apiFetch).mockResolvedValue([
      { circle_id: 1, teacher_id: 2, name: 'Halaqa', created_at: '2026-01-01' },
    ]);
    renderCircles(VERIFIED_TEACHER);
    expect(await screen.findByText('Halaqa')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open circle' })).toBeEnabled();
  });

  it('keeps the create control disabled for a teacher who waits for review', async () => {
    vi.mocked(apiFetch).mockResolvedValue([]);
    renderCircles(WAITING_TEACHER);
    // The shell banner carries a similar sentence, so match the page's own.
    expect(await screen.findByText(/only a verified teacher opens a circle/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open circle' })).toBeDisabled();
  });

  it('tells a student that only a teacher opens a circle', async () => {
    vi.mocked(apiFetch).mockResolvedValue([]);
    renderCircles(STUDENT);
    expect(await screen.findByText(/only a teacher opens a circle/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Open circle' })).not.toBeInTheDocument();
  });

  it('shows a plain error message when the request fails', async () => {
    vi.mocked(apiFetch).mockRejectedValue(new Error('network error'));
    renderCircles(STUDENT);
    expect(await screen.findByText(/could not be loaded/i)).toBeInTheDocument();
  });
});
