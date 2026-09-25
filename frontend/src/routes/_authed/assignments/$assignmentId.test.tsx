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

const ASSIGNMENT = {
  assignment_id: 9,
  circle_id: 3,
  study_set_id: 4,
  due_date: '2027-06-01T00:00:00.000Z',
};

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

function mockAssignment() {
  vi.mocked(apiFetch).mockImplementation(async (path: unknown) => {
    if (path === '/assignments/9') return ASSIGNMENT as never;
    if (typeof path === 'string' && path.endsWith('/completion')) return [] as never;
    if (typeof path === 'string' && path.startsWith('/circles/')) return [] as never;
    throw new Error(`unexpected fetch ${String(path)}`);
  });
}

describe('Assignment detail page', () => {
  it('shows the due date form and delete control to a teacher', async () => {
    mockAssignment();
    renderAt('/assignments/9', TEACHER);

    expect(await screen.findByText(/Assignment/)).toBeInTheDocument();
    const input = screen.getByLabelText('Due date') as HTMLInputElement;
    expect(input.value).toBe('2027-06-01');
    expect(screen.getByRole('button', { name: 'Move due date' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Delete this assignment' })).toBeInTheDocument();
  });

  it('sends PATCH with the new date on submit', async () => {
    mockAssignment();
    renderAt('/assignments/9', TEACHER);

    const input = await screen.findByLabelText('Due date');
    fireEvent.change(input, { target: { value: '2027-09-01' } });
    fireEvent.click(screen.getByRole('button', { name: 'Move due date' }));

    await vi.waitFor(() => {
      expect(vi.mocked(apiFetch)).toHaveBeenCalledWith('/assignments/9', expect.anything(), {
        method: 'PATCH',
        body: { due_date: '2027-09-01' },
      });
    });
  });

  it('confirms before sending DELETE', async () => {
    mockAssignment();
    renderAt('/assignments/9', TEACHER);

    await screen.findByText(/Assignment/);
    fireEvent.click(screen.getByRole('button', { name: 'Delete this assignment' }));
    expect(await screen.findByText('Delete this assignment?')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Delete it' }));
    await vi.waitFor(() => {
      expect(vi.mocked(apiFetch)).toHaveBeenCalledWith('/assignments/9', expect.anything(), {
        method: 'DELETE',
      });
    });
  });

  it('explains the rule to a student and fetches nothing', async () => {
    mockAssignment();
    renderAt('/assignments/9', STUDENT);

    expect(await screen.findByText('Assignment completion')).toBeInTheDocument();
    expect(screen.getByText(/Only a teacher reads completion across students/)).toBeInTheDocument();
    expect(vi.mocked(apiFetch)).not.toHaveBeenCalled();
  });
});
