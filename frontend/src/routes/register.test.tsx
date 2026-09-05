import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createMemoryHistory, createRouter } from '@tanstack/react-router';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthContextValue } from '../auth/AuthContext';
import { AuthContext } from '../auth/AuthContext';
import { routeTree } from '../routeTree.gen';

vi.mock('../lib/apiClient', async () => {
  const actual = await vi.importActual<typeof import('../lib/apiClient')>('../lib/apiClient');
  return { ...actual, apiFetch: vi.fn() };
});

import { ApiError, apiFetch } from '../lib/apiClient';

function renderRegister(signIn: AuthContextValue['signIn'] = vi.fn(async () => {})) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const auth: AuthContextValue = {
    state: { status: 'signed-out' },
    ready: Promise.resolve({ status: 'signed-out' }),
    signIn,
    signOut: async () => {},
  };
  const history = createMemoryHistory({ initialEntries: ['/register'] });
  const router = createRouter({ routeTree, history, context: { auth } });
  return render(
    <AuthContext.Provider value={auth}>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </AuthContext.Provider>,
  );
}

async function fillForm({
  fullName = 'Amina Yusuf',
  email = 'amina@example.com',
  password = 'a-strong-password',
}: { fullName?: string; email?: string; password?: string } = {}) {
  fireEvent.change(await screen.findByLabelText('Full name'), { target: { value: fullName } });
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: email } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: password } });
}

describe('the register page', () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset();
  });

  it('submits a student registration and signs in with the returned access token', async () => {
    vi.mocked(apiFetch).mockResolvedValue({ accessToken: 'tok-789' });
    const signIn = vi.fn(async () => {});
    renderRegister(signIn);

    await fillForm();
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));

    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith(
        '/auth/register',
        expect.anything(),
        expect.objectContaining({
          method: 'POST',
          body: {
            email: 'amina@example.com',
            password: 'a-strong-password',
            full_name: 'Amina Yusuf',
            role: 'student',
          },
        }),
      ),
    );
    await waitFor(() => expect(signIn).toHaveBeenCalledWith('tok-789'));
  });

  it('shows the teacher verification consequence before the choice is made, and keeps it visible after choosing teacher', async () => {
    renderRegister();

    // Visible already, with "student" the default selection — stated before
    // any choice, per §7.2.
    expect(
      await screen.findByText(/an admin verifies the ijaza or the institution/i),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('radio', { name: 'Teacher' }));

    expect(screen.getByText(/an admin verifies the ijaza or the institution/i)).toBeInTheDocument();
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it('shows the error message on a duplicate-email failure', async () => {
    vi.mocked(apiFetch).mockRejectedValue(new ApiError(409, 'conflict', 'already exists'));
    renderRegister();

    await fillForm();
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));

    const message = await screen.findByText('already exists');
    await waitFor(() => expect(message).toHaveFocus());
  });

  it('never offers an admin role option', async () => {
    renderRegister();

    const radios = await screen.findAllByRole('radio');
    expect(radios).toHaveLength(2);
    expect(screen.queryByRole('radio', { name: /admin/i })).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue('admin')).not.toBeInTheDocument();
  });
});
