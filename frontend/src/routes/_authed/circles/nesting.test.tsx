import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createMemoryHistory, createRouter } from '@tanstack/react-router';
import { fireEvent, render, screen } from '@testing-library/react';
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

const TEACHER = {
  status: 'signed-in',
  user: { user_id: 2, role: 'teacher', full_name: 'Ustadh', email: 't@x.io', is_verified: true },
} as const;

function renderAt(path: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const auth: AuthContextValue = {
    state: { ...TEACHER },
    ready: Promise.resolve({ ...TEACHER }),
    signIn: async () => {},
    signOut: async () => {},
  };
  const history = createMemoryHistory({ initialEntries: [path] });
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

describe('Circle nested routes', () => {
  it('renders the assign page — not the overview — at /circles/:id/assign', async () => {
    // A dot-file route ($circleId.assign) nests under its parent. The
    // parent must render an <Outlet/>, or the child never appears and the
    // parent page silently answers the child's URL. This test pins that.
    vi.mocked(apiFetch).mockImplementation(async (path: string) => {
      if (path === '/sets') return [{ study_set_id: 9, name: 'Seerah' }];
      if (path === '/circles/40/students') return [];
      if (path === '/sets/9') return { items: [] };
      throw new Error(`unexpected fetch ${path}`);
    });
    const router = renderAt('/circles/40/assign');
    expect(await screen.findByRole('heading', { name: 'Assign a set' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/circles/40/assign');
  });

  it('still renders the overview at /circles/:id', async () => {
    vi.mocked(apiFetch).mockImplementation(async (path: string) => {
      if (path === '/circles/40') return { circle_id: 40, teacher_id: 2, name: 'Halaqa' };
      if (path === '/circles/40/overview') return [];
      if (path === '/circles/40/students') return [];
      if (path === '/review-sessions') return [];
      if (path === '/assignments') return [];
      throw new Error(`unexpected fetch ${path}`);
    });
    renderAt('/circles/40');
    expect(await screen.findByRole('heading', { name: 'Halaqa' })).toBeInTheDocument();
  });
});

describe('Circle danger zone', () => {
  function mockOverview() {
    vi.mocked(apiFetch).mockImplementation(async (path: string) => {
      if (path === '/circles/40') return { circle_id: 40, teacher_id: 2, name: 'Halaqa' };
      if (path === '/circles/40/overview') return [];
      if (path === '/circles/40/students') return [];
      if (path === '/review-sessions') return [];
      if (path === '/assignments') return [];
      if (path === '/students') return [];
      throw new Error(`unexpected fetch ${path}`);
    });
  }

  it('shows the owner a delete control that confirms before sending DELETE', async () => {
    mockOverview();
    renderAt('/circles/40');
    expect(await screen.findByRole('heading', { name: 'Halaqa' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Delete this circle' }));
    expect(await screen.findByText('Delete this circle?')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Delete it' }));
    await vi.waitFor(() => {
      expect(vi.mocked(apiFetch)).toHaveBeenCalledWith('/circles/40', expect.anything(), {
        method: 'DELETE',
      });
    });
  });
});

describe('Circle enrol autocomplete', () => {
  function mockCircleWithDirectory() {
    vi.mocked(apiFetch).mockImplementation(async (path: unknown) => {
      if (path === '/circles/40') return { circle_id: 40, teacher_id: 2, name: 'Halaqa' };
      if (path === '/circles/40/overview') return [];
      if (path === '/circles/40/students') return [];
      if (path === '/review-sessions') return [];
      if (path === '/assignments') return [];
      if (path === '/students') {
        return [
          { user_id: 5, full_name: 'Amina', email: 'amina@example.com' },
          { user_id: 6, full_name: 'Bilal', email: 'bilal@example.com' },
        ] as never;
      }
      if (typeof path === 'string' && path.startsWith('/students?q=')) {
        const q = new URL(path, 'http://localhost').searchParams.get('q') ?? '';
        const rows = [
          { user_id: 5, full_name: 'Amina', email: 'amina@example.com' },
          { user_id: 6, full_name: 'Bilal', email: 'bilal@example.com' },
        ].filter((s) => s.email.includes(q));
        return rows as never;
      }
      throw new Error(`unexpected fetch ${String(path)}`);
    });
  }

  it('suggests matching students while typing and enrols the picked one', async () => {
    mockCircleWithDirectory();
    renderAt('/circles/40');
    expect(await screen.findByRole('heading', { name: 'Halaqa' })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Student email'), { target: { value: 'amina' } });
    const suggestion = await screen.findByRole('button', { name: /Amina — amina@example.com/ });
    fireEvent.click(suggestion);
    expect(screen.getByLabelText('Student email')).toHaveValue('amina@example.com');

    fireEvent.click(screen.getByRole('button', { name: 'Enrol' }));
    await vi.waitFor(() => {
      expect(vi.mocked(apiFetch)).toHaveBeenCalledWith('/circles/40/students', expect.anything(), {
        method: 'POST',
        body: { student_id: 5 },
      });
    });
    // Picked from suggestions: the full directory was never fetched.
    expect(vi.mocked(apiFetch)).not.toHaveBeenCalledWith('/students', expect.anything());
  });

  it('sends one search request per pause, not per keystroke', async () => {
    mockCircleWithDirectory();
    renderAt('/circles/40');
    expect(await screen.findByRole('heading', { name: 'Halaqa' })).toBeInTheDocument();

    const input = screen.getByLabelText('Student email');
    fireEvent.change(input, { target: { value: 'a' } });
    fireEvent.change(input, { target: { value: 'am' } });
    fireEvent.change(input, { target: { value: 'ami' } });
    await screen.findByRole('button', { name: /Amina — amina@example.com/ });

    const searches = vi
      .mocked(apiFetch)
      .mock.calls.filter(([p]) => typeof p === 'string' && p.startsWith('/students?q='));
    expect(searches).toHaveLength(1);
    expect(searches[0][0]).toBe('/students?q=ami');
  });
});
