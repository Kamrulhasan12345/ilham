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

function renderLogin(signIn: AuthContextValue['signIn'] = vi.fn(async () => {})) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const auth: AuthContextValue = {
    state: { status: 'signed-out' },
    ready: Promise.resolve({ status: 'signed-out' }),
    signIn,
    signOut: async () => {},
  };
  const history = createMemoryHistory({ initialEntries: ['/login'] });
  const router = createRouter({ routeTree, history, context: { auth } });
  return render(
    <AuthContext.Provider value={auth}>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </AuthContext.Provider>,
  );
}

async function fillCredentials(email: string, password: string) {
  fireEvent.change(await screen.findByLabelText('Email'), { target: { value: email } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: password } });
}

describe('the login page', () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset();
  });

  it('submits the entered credentials and signs in with the returned access token', async () => {
    vi.mocked(apiFetch).mockResolvedValue({ accessToken: 'tok-123' });
    const signIn = vi.fn(async () => {});
    renderLogin(signIn);

    await fillCredentials('amina@example.com', 'correct horse');
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith(
        '/auth/login',
        expect.anything(),
        expect.objectContaining({
          method: 'POST',
          body: { email: 'amina@example.com', password: 'correct horse' },
        }),
      ),
    );
    await waitFor(() => expect(signIn).toHaveBeenCalledWith('tok-123'));
  });

  it('shows the error message and moves focus to it on a failed login', async () => {
    vi.mocked(apiFetch).mockRejectedValue(
      new ApiError(401, 'unauthenticated', 'invalid email or password'),
    );
    renderLogin();

    await fillCredentials('amina@example.com', 'wrong-password');
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    const message = await screen.findByText('invalid email or password');
    await waitFor(() => expect(message).toHaveFocus());
  });

  it('disables the submit button, keeping its label, while the request is in flight', async () => {
    let resolveFetch!: (value: { accessToken: string }) => void;
    const pending = new Promise<{ accessToken: string }>((resolve) => {
      resolveFetch = resolve;
    });
    vi.mocked(apiFetch).mockReturnValue(pending);
    renderLogin();

    await fillCredentials('amina@example.com', 'correct horse');
    const button = screen.getByRole('button', { name: 'Sign in' });
    fireEvent.click(button);

    await waitFor(() => expect(button).toBeDisabled());
    expect(button).toHaveTextContent('Sign in');

    resolveFetch({ accessToken: 'tok-456' });
    await waitFor(() => expect(button).not.toBeDisabled());
  });

  it('toggles the password field between hidden and visible', async () => {
    renderLogin();
    const password = (await screen.findByLabelText('Password')) as HTMLInputElement;
    expect(password.type).toBe('password');

    fireEvent.click(screen.getByRole('button', { name: 'Show' }));
    expect(password.type).toBe('text');

    fireEvent.click(screen.getByRole('button', { name: 'Hide' }));
    expect(password.type).toBe('password');
  });
});
