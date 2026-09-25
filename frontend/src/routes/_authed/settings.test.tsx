import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createMemoryHistory, createRouter } from '@tanstack/react-router';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { AuthContextValue } from '../../auth/AuthContext';
import { AuthContext } from '../../auth/AuthContext';
import { routeTree } from '../../routeTree.gen';

vi.mock('../../lib/apiClient', async () => {
  const actual = await vi.importActual<typeof import('../../lib/apiClient')>('../../lib/apiClient');
  return { ...actual, apiFetch: vi.fn() };
});

import { apiFetch } from '../../lib/apiClient';

const USER = { user_id: 1, role: 'student' as const, full_name: 'Amina', email: 'a@example.com' };

function renderSettings() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const auth: AuthContextValue = {
    state: { status: 'signed-in', user: USER },
    ready: Promise.resolve({ status: 'signed-in', user: USER }),
    signIn: async () => {},
    signOut: async () => {},
  };
  const history = createMemoryHistory({ initialEntries: ['/settings'] });
  const router = createRouter({ routeTree, history, context: { auth } });
  return render(
    <AuthContext.Provider value={auth}>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </AuthContext.Provider>,
  );
}

describe('Settings page password form', () => {
  it('sends the change request with both passwords on submit', async () => {
    vi.mocked(apiFetch).mockResolvedValue(null as never);
    renderSettings();

    expect(await screen.findByRole('heading', { name: 'Settings' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Current password'), {
      target: { value: 'password123' },
    });
    fireEvent.change(screen.getByLabelText('New password'), {
      target: { value: 'newpassword456' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Change password' }));

    await vi.waitFor(() => {
      expect(vi.mocked(apiFetch)).toHaveBeenCalledWith('/auth/change-password', expect.anything(), {
        method: 'POST',
        body: { current_password: 'password123', new_password: 'newpassword456' },
      });
    });
  });

  it('keeps the submit disabled until the new password is long enough', async () => {
    vi.mocked(apiFetch).mockResolvedValue(null as never);
    renderSettings();

    expect(await screen.findByRole('heading', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Change password' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Current password'), {
      target: { value: 'password123' },
    });
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'short' } });
    expect(screen.getByRole('button', { name: 'Change password' })).toBeDisabled();
  });
});
