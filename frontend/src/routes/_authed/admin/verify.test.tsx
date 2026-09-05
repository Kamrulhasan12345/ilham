import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createMemoryHistory, createRouter } from '@tanstack/react-router';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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

function renderVerify(user: AuthUser) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const auth: AuthContextValue = {
    state: { status: 'signed-in', user },
    ready: Promise.resolve({ status: 'signed-in', user }),
    signIn: async () => {},
    signOut: async () => {},
  };
  const history = createMemoryHistory({ initialEntries: ['/admin/verify'] });
  const router = createRouter({ routeTree, history, context: { auth } });
  return render(
    <AuthContext.Provider value={auth}>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </AuthContext.Provider>,
  );
}

const ADMIN: AuthUser = {
  user_id: 9,
  role: 'admin',
  full_name: 'Root',
  email: 'admin@example.com',
};
const STUDENT: AuthUser = {
  user_id: 1,
  role: 'student',
  full_name: 'Amina',
  email: 'a@example.com',
};

describe('Verification queue', () => {
  it('explains the rule to a non-admin instead of redirecting in silence', async () => {
    renderVerify(STUDENT);
    expect(await screen.findByText(/only an admin verifies a teacher/i)).toBeInTheDocument();
    expect(vi.mocked(apiFetch)).not.toHaveBeenCalled();
  });

  it('shows an admin each waiting teacher with a verify control', async () => {
    vi.mocked(apiFetch).mockResolvedValue([
      {
        user_id: 2,
        email: 't@example.com',
        full_name: 'Ustadh',
        institution: 'Qarawiyyin',
        specialization: null,
        created_at: '2026-01-01',
      },
    ]);
    renderVerify(ADMIN);
    expect(await screen.findByText(/Ustadh/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Verify' }));
    await waitFor(() =>
      expect(vi.mocked(apiFetch)).toHaveBeenCalledWith('/teachers/2/verify', expect.anything(), {
        method: 'POST',
      }),
    );
  });
});
