import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createMemoryHistory, createRouter } from '@tanstack/react-router';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { AuthContextValue } from '../../../auth/AuthContext';
import { AuthContext } from '../../../auth/AuthContext';
import { routeTree } from '../../../routeTree.gen';

vi.mock('../../../lib/apiClient', async () => {
  const actual =
    await vi.importActual<typeof import('../../../lib/apiClient')>('../../../lib/apiClient');
  return { ...actual, apiFetch: vi.fn() };
});

import { ApiError, apiFetch } from '../../../lib/apiClient';

const STUDENTS = [
  {
    user_id: 5,
    email: 'amina@example.com',
    full_name: 'Amina',
    student_level: 'beginner',
    created_at: '2026-01-01T00:00:00Z',
  },
];

const STATS = { student_id: 5, mastered_count: 3, review_count: 7 };

const PROGRESS = [
  {
    progress_id: '11',
    student_id: 5,
    hadith_id: 100,
    assignment_id: 2,
    mastery: 2,
    times_reviewed: 3,
    last_reviewed: '2026-02-01T00:00:00Z',
  },
  {
    progress_id: '12',
    student_id: 5,
    hadith_id: 101,
    assignment_id: null,
    mastery: 1,
    times_reviewed: 1,
    last_reviewed: null,
  },
];

const SESSIONS = [
  {
    session_id: 40,
    student_id: 5,
    reviewer_id: 3,
    circle_id: 1,
    created_at: '2026-02-01T00:00:00Z',
  },
  {
    session_id: 41,
    student_id: 6,
    reviewer_id: 3,
    circle_id: 1,
    created_at: '2026-02-02T00:00:00Z',
  },
];

function authAs(role: 'student' | 'teacher'): AuthContextValue {
  const user =
    role === 'teacher'
      ? { user_id: 3, role: 'teacher' as const, full_name: 'Ustadh', email: 'u@example.com' }
      : { user_id: 5, role: 'student' as const, full_name: 'Amina', email: 'amina@example.com' };
  const state = { status: 'signed-in' as const, user };
  return { state, ready: Promise.resolve(state), signIn: async () => {}, signOut: async () => {} };
}

function renderAt(path: string, role: 'student' | 'teacher' = 'teacher') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const auth = authAs(role);
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

function mockAll() {
  vi.mocked(apiFetch).mockImplementation(async (path: unknown) => {
    if (path === '/students') return STUDENTS as never;
    if (typeof path === 'string' && path.startsWith('/students/5/stats')) return STATS as never;
    if (typeof path === 'string' && path.startsWith('/progress')) return PROGRESS as never;
    if (path === '/review-sessions') return SESSIONS as never;
    throw new Error(`unexpected fetch ${String(path)}`);
  });
}

function expectStat(label: string, value: string) {
  const card = screen.getByText(label).closest('[data-slot="card"]') as HTMLElement;
  expect(within(card).getByText(value)).toBeInTheDocument();
}

describe('Student detail page', () => {
  it('shows the header, stats, progress rows, and only this student sessions', async () => {
    mockAll();
    renderAt('/students/5');

    expect(await screen.findByText('Amina')).toBeInTheDocument();
    expectStat('Mastered', '3');
    expectStat('Reviews', '7');

    // Assigned and self-study rows both render; the assignment links out.
    expect(screen.getByText('self-study')).toBeInTheDocument();
    const assignmentLink = screen.getByRole('link', { name: '2' });
    expect(assignmentLink).toHaveAttribute('href', '/assignments/2');

    // Only session 40 belongs to student 5; 41 belongs to student 6.
    const sessionLink = screen.getByRole('link', { name: '40' });
    expect(sessionLink).toHaveAttribute('href', '/review/40');
    expect(screen.queryByRole('link', { name: '41' })).not.toBeInTheDocument();
  });

  it('treats a missing stats row as zeros, not a failure', async () => {
    vi.mocked(apiFetch).mockImplementation(async (path: unknown) => {
      if (path === '/students') return STUDENTS as never;
      if (typeof path === 'string' && path.startsWith('/students/5/stats')) {
        throw new ApiError(404, 'not_found', 'stats not found');
      }
      if (typeof path === 'string' && path.startsWith('/progress')) return [] as never;
      if (path === '/review-sessions') return [] as never;
      throw new Error(`unexpected fetch ${String(path)}`);
    });
    renderAt('/students/5');

    expect(await screen.findByText('Amina')).toBeInTheDocument();
    expectStat('Mastered', '0');
    expectStat('Reviews', '0');
    expect(screen.getByText('No progress yet')).toBeInTheDocument();
  });

  it('explains the rule to a signed-in student instead of showing data', async () => {
    mockAll();
    renderAt('/students/5', 'student');

    expect(await screen.findByText('Student')).toBeInTheDocument();
    expect(screen.getByText(/Only a teacher or an admin sees a student/)).toBeInTheDocument();
    expect(vi.mocked(apiFetch)).not.toHaveBeenCalled();
  });

  it('reports an unknown student id', async () => {
    mockAll();
    renderAt('/students/999');

    expect(await screen.findByText('No such student')).toBeInTheDocument();
  });
});
