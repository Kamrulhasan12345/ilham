import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from './AuthContext';

vi.mock('../lib/apiClient', async () => {
  const actual = await vi.importActual<typeof import('../lib/apiClient')>('../lib/apiClient');
  return {
    ...actual,
    refreshAccessToken: vi.fn(),
    apiFetch: vi.fn(),
  };
});

import { apiFetch, refreshAccessToken } from '../lib/apiClient';

function Probe() {
  const auth = useAuth();
  if (auth.state.status === 'loading') return <p>loading</p>;
  if (auth.state.status === 'signed-out') return <p>signed out</p>;
  return <p>signed in as {auth.state.user.name}</p>;
}

describe('AuthProvider', () => {
  beforeEach(() => {
    vi.mocked(refreshAccessToken).mockReset();
    vi.mocked(apiFetch).mockReset();
  });
  afterEach(() => vi.restoreAllMocks());

  it('becomes signed-in when the startup refresh and /auth/me both succeed', async () => {
    vi.mocked(refreshAccessToken).mockResolvedValue('token-1');
    vi.mocked(apiFetch).mockResolvedValue({
      userId: 1,
      role: 'student',
      name: 'Amina',
      email: 'amina@example.com',
    });

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    expect(screen.getByText('loading')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('signed in as Amina')).toBeInTheDocument());
  });

  it('becomes signed-out when the startup refresh fails', async () => {
    vi.mocked(refreshAccessToken).mockRejectedValue(new Error('no session'));

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByText('signed out')).toBeInTheDocument());
  });

  it('resolves `ready` with the final state exactly once', async () => {
    vi.mocked(refreshAccessToken).mockRejectedValue(new Error('no session'));
    let capturedReady: Promise<unknown> | undefined;

    function CaptureReady() {
      const auth = useAuth();
      capturedReady = auth.ready;
      return null;
    }

    render(
      <AuthProvider>
        <CaptureReady />
      </AuthProvider>,
    );

    await waitFor(() => expect(capturedReady).toBeDefined());
    await expect(capturedReady).resolves.toEqual({ status: 'signed-out' });
  });

  it('signOut clears the session even if the logout call fails', async () => {
    vi.mocked(refreshAccessToken).mockResolvedValue('token-1');
    vi.mocked(apiFetch).mockImplementation(async (path: string) => {
      if (path === '/auth/me') {
        return { userId: 1, role: 'student', name: 'Amina', email: 'amina@example.com' };
      }
      throw new Error('logout endpoint unreachable');
    });

    let auth!: ReturnType<typeof useAuth>;
    function Capture() {
      auth = useAuth();
      return <Probe />;
    }

    render(
      <AuthProvider>
        <Capture />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByText('signed in as Amina')).toBeInTheDocument());

    await act(async () => {
      await auth.signOut();
    });

    expect(screen.getByText('signed out')).toBeInTheDocument();
  });
});
