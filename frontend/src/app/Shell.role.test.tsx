import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { AuthState } from '../auth/guards';
import { Shell } from './Shell';

vi.mock('../auth/AuthContext', () => ({ useAuth: vi.fn() }));

import { useAuth } from '../auth/AuthContext';

function signedIn(state: AuthState) {
  vi.mocked(useAuth).mockReturnValue({
    state,
    ready: Promise.resolve(state),
    signIn: async () => {},
    signOut: async () => {},
  });
}

describe('role-aware shell', () => {
  it('shows the waiting banner to an unverified teacher', () => {
    signedIn({
      status: 'signed-in',
      user: {
        user_id: 2,
        role: 'teacher',
        full_name: 'Ustadh',
        email: 't@x.io',
        is_verified: false,
      },
    });
    render(
      <Shell>
        <p>content</p>
      </Shell>,
    );
    expect(screen.getByText(/waiting for review/i)).toBeInTheDocument();
  });

  it('shows no banner to a verified teacher', () => {
    signedIn({
      status: 'signed-in',
      user: {
        user_id: 2,
        role: 'teacher',
        full_name: 'Ustadh',
        email: 't@x.io',
        is_verified: true,
      },
    });
    render(
      <Shell>
        <p>content</p>
      </Shell>,
    );
    expect(screen.queryByText(/waiting for review/i)).not.toBeInTheDocument();
  });

  it('shows the signed-in name and role, and the verify link to an admin only', () => {
    signedIn({
      status: 'signed-in',
      user: { user_id: 9, role: 'admin', full_name: 'Root', email: 'a@x.io' },
    });
    const { unmount } = render(
      <Shell>
        <p>content</p>
      </Shell>,
    );
    expect(screen.getByText(/root · admin/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Verify teachers' })).toBeInTheDocument();
    unmount();

    signedIn({
      status: 'signed-in',
      user: { user_id: 1, role: 'student', full_name: 'Amina', email: 's@x.io' },
    });
    render(
      <Shell>
        <p>content</p>
      </Shell>,
    );
    expect(screen.queryByRole('link', { name: 'Verify teachers' })).not.toBeInTheDocument();
  });

  it('shows the students link to a teacher but not to a student', () => {
    signedIn({
      status: 'signed-in',
      user: {
        user_id: 2,
        role: 'teacher',
        full_name: 'Ustadh',
        email: 't@x.io',
        is_verified: true,
      },
    });
    const { unmount } = render(
      <Shell>
        <p>content</p>
      </Shell>,
    );
    expect(screen.getByRole('link', { name: 'Students' })).toBeInTheDocument();
    unmount();

    signedIn({
      status: 'signed-in',
      user: { user_id: 1, role: 'student', full_name: 'Amina', email: 's@x.io' },
    });
    render(
      <Shell>
        <p>content</p>
      </Shell>,
    );
    expect(screen.queryByRole('link', { name: 'Students' })).not.toBeInTheDocument();
  });
});
