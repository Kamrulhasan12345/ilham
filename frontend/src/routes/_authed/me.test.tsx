import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createMemoryHistory, createRouter } from '@tanstack/react-router';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { AuthContextValue } from '../../auth/AuthContext';
import { AuthContext } from '../../auth/AuthContext';
import type { AuthUser } from '../../auth/guards';
import { routeTree } from '../../routeTree.gen';

vi.mock('../../lib/apiClient', async () => {
  const actual = await vi.importActual<typeof import('../../lib/apiClient')>('../../lib/apiClient');
  return { ...actual, apiFetch: vi.fn() };
});

import { apiFetch } from '../../lib/apiClient';

const STUDENT: AuthUser = {
  user_id: 5,
  role: 'student',
  full_name: 'Amina',
  email: 'a@example.com',
};
const TEACHER: AuthUser = {
  user_id: 2,
  role: 'teacher',
  full_name: 'Ustadh',
  email: 't@example.com',
  is_verified: true,
};

function renderMe(user: AuthUser) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const auth: AuthContextValue = {
    state: { status: 'signed-in', user },
    ready: Promise.resolve({ status: 'signed-in', user }),
    signIn: async () => {},
    signOut: async () => {},
  };
  const history = createMemoryHistory({ initialEntries: ['/me'] });
  const router = createRouter({ routeTree, history, context: { auth } });
  return render(
    <AuthContext.Provider value={auth}>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </AuthContext.Provider>,
  );
}

function mockStudent() {
  vi.mocked(apiFetch).mockImplementation(async (path: unknown) => {
    if (path === '/auth/me') return { ...STUDENT } as never;
    if (path === '/students/5/stats')
      return { student_id: 5, mastered_count: 3, review_count: 7 } as never;
    if (path === '/review-sessions') {
      return [
        {
          session_id: 40,
          student_id: 5,
          reviewer_id: 3,
          circle_id: 1,
          created_at: new Date().toISOString(),
        },
      ] as never;
    }
    if (path === '/assignments') {
      return [
        { assignment_id: 9, circle_id: 1, study_set_id: 4, due_date: '2027-06-01T00:00:00.000Z' },
      ] as never;
    }
    if (path === '/circles') return [{ circle_id: 1, teacher_id: 2, name: 'Halaqa' }] as never;
    if (path === '/progress') {
      return [
        {
          progress_id: '11',
          student_id: 5,
          hadith_id: 100,
          assignment_id: 9,
          mastery: 2,
          times_reviewed: 3,
          last_reviewed: new Date().toISOString(),
        },
      ] as never;
    }
    throw new Error(`unexpected fetch ${String(path)}`);
  });
}

describe('Account dashboard', () => {
  it('shows a student their stats, heatmap, assignments with set links, and recent hadiths', async () => {
    mockStudent();
    renderMe(STUDENT);

    expect(await screen.findByRole('heading', { name: 'My progress' })).toBeInTheDocument();
    const mastered = (await screen.findByText('Mastered')).closest('[data-slot="card"]');
    expect(await within(mastered as HTMLElement).findByText('3')).toBeInTheDocument();
    const reviews = screen.getByText('Reviews').closest('[data-slot="card"]');
    expect(within(reviews as HTMLElement).getByText('7')).toBeInTheDocument();
    // Heatmap summary line proves the sessions fed the grid.
    expect(screen.getByText('1 sitting in the last 16 weeks.')).toBeInTheDocument();

    expect(await screen.findByRole('heading', { name: 'My assignments' })).toBeInTheDocument();
    const setLink = screen.getByRole('link', { name: /Set 4/ });
    expect(setLink).toHaveAttribute('href', '/sets/4');
    expect(screen.getByRole('link', { name: 'Review' })).toHaveAttribute(
      'href',
      // TanStack serializes search values as JSON (quotes included); the
      // runner page parses them back. Same shape as the assignment page link.
      '/review/new?student_id=%225%22&assignment_id=%229%22',
    );

    expect(await screen.findByRole('heading', { name: 'Recently studied' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Hadith 100' })).toHaveAttribute(
      'href',
      '/hadiths/100',
    );
  });

  it('shows a teacher assignments without student-only sections', async () => {
    vi.mocked(apiFetch).mockImplementation(async (path: unknown) => {
      if (path === '/auth/me') return { ...TEACHER } as never;
      if (path === '/review-sessions') return [] as never;
      if (path === '/assignments') return [] as never;
      if (path === '/circles') return [] as never;
      throw new Error(`unexpected fetch ${String(path)}`);
    });
    renderMe(TEACHER);

    expect(await screen.findByRole('heading', { name: 'My progress' })).toBeInTheDocument();
    // No student sections, and no unscoped progress call behind them.
    expect(screen.queryByRole('heading', { name: 'Recently studied' })).not.toBeInTheDocument();
    expect(await screen.findByText('Nothing assigned')).toBeInTheDocument();
    const progressCalls = vi
      .mocked(apiFetch)
      .mock.calls.filter(([p]) => typeof p === 'string' && (p as string).startsWith('/progress'));
    expect(progressCalls).toHaveLength(0);
  });
});
