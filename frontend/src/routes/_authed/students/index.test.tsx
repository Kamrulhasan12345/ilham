import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createMemoryHistory, createRouter } from '@tanstack/react-router';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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

function renderStudents(user: AuthUser) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const auth: AuthContextValue = {
    state: { status: 'signed-in', user },
    ready: Promise.resolve({ status: 'signed-in', user }),
    signIn: async () => {},
    signOut: async () => {},
  };
  const history = createMemoryHistory({ initialEntries: ['/students'] });
  const router = createRouter({ routeTree, history, context: { auth } });
  return render(
    <AuthContext.Provider value={auth}>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </AuthContext.Provider>,
  );
}

const TEACHER: AuthUser = {
  user_id: 2,
  role: 'teacher',
  full_name: 'Ustadh',
  email: 't@example.com',
  is_verified: true,
};
const STUDENT: AuthUser = {
  user_id: 1,
  role: 'student',
  full_name: 'Amina',
  email: 'a@example.com',
};

describe('Students page', () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset();
  });

  it('shows a teacher every student with name and email', async () => {
    vi.mocked(apiFetch).mockResolvedValue([
      {
        user_id: 1,
        email: 'a@example.com',
        full_name: 'Amina',
        student_level: 'beginner',
        created_at: '2026-01-01',
      },
    ]);
    renderStudents(TEACHER);
    expect(await screen.findByText(/Amina — a@example.com/)).toBeInTheDocument();
  });

  it('explains the rule to a student instead of redirecting in silence', async () => {
    renderStudents(STUDENT);
    expect(await screen.findByText(/only a teacher or an admin/i)).toBeInTheDocument();
    expect(vi.mocked(apiFetch)).not.toHaveBeenCalled();
  });

  it('shows a plain error message when the request fails', async () => {
    vi.mocked(apiFetch).mockRejectedValue(new Error('network error'));
    renderStudents(TEACHER);
    expect(await screen.findByText(/could not be loaded/i)).toBeInTheDocument();
  });
});
