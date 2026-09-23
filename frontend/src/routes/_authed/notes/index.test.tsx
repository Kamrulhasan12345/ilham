import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createMemoryHistory, createRouter } from '@tanstack/react-router';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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

function renderNotes() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const user = { user_id: 1, role: 'student' as const, full_name: 'Amina', email: 'a@example.com' };
  const auth: AuthContextValue = {
    state: { status: 'signed-in', user },
    ready: Promise.resolve({ status: 'signed-in', user }),
    signIn: async () => {},
    signOut: async () => {},
  };
  const history = createMemoryHistory({ initialEntries: ['/notes'] });
  const router = createRouter({ routeTree, history, context: { auth } });
  return render(
    <AuthContext.Provider value={auth}>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </AuthContext.Provider>,
  );
}

describe('Notes page', () => {
  it('groups notes by hadith and links each group to its hadith', async () => {
    vi.mocked(apiFetch).mockResolvedValue([
      { note_id: 1, user_id: 1, hadith_id: 5, body: 'first', created_at: '2026-01-01' },
      { note_id: 2, user_id: 1, hadith_id: 5, body: 'second', created_at: '2026-01-02' },
    ]);
    renderNotes();
    expect(await screen.findByText('first')).toBeInTheDocument();
    expect(screen.getByText('second')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /hadith.*5/i })).toHaveAttribute('href', '/hadiths/5');
  });

  it('says what to do when there are no notes yet', async () => {
    vi.mocked(apiFetch).mockResolvedValue([]);
    renderNotes();
    expect(await screen.findByText(/no notes yet/i)).toBeInTheDocument();
  });

  it('deletes a note through the API', async () => {
    vi.mocked(apiFetch)
      .mockResolvedValueOnce([
        { note_id: 7, user_id: 1, hadith_id: 5, body: 'gone soon', created_at: '2026-01-01' },
      ])
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce([]);
    renderNotes();
    fireEvent.click(await screen.findByRole('button', { name: 'Delete' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Delete it' }));
    await waitFor(() =>
      expect(vi.mocked(apiFetch)).toHaveBeenCalledWith('/notes/7', expect.anything(), {
        method: 'DELETE',
      }),
    );
  });

  it('picks a hadith through the type-ahead, then submits the note against its id', async () => {
    vi.mocked(apiFetch).mockImplementation(async (path: string) => {
      if (path.startsWith('/hadiths')) {
        return [
          {
            hadith_id: 42,
            hadith_num: '42',
            text_plain: 'إنما الأعمال بالنيات',
            text_en: 'Actions are judged by intentions.',
            sanad_count: 1,
            chain_strength: 0.9,
          },
        ] as never;
      }
      if (path === '/notes') return [] as never;
      return null as never;
    });
    renderNotes();

    fireEvent.change(await screen.findByLabelText(/find a hadith/i), {
      target: { value: 'intentions' },
    });
    const match = await screen.findByRole('button', { name: /actions are judged by intentions/i });
    fireEvent.click(match);
    expect(await screen.findByText(/attaching to hadith/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Note'), { target: { value: 'a note' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add note' }));

    await waitFor(() =>
      expect(vi.mocked(apiFetch)).toHaveBeenCalledWith(
        '/notes',
        expect.anything(),
        expect.objectContaining({ method: 'POST', body: { hadith_id: 42, body: 'a note' } }),
      ),
    );
  });

  it('disables Add note until a hadith is picked', async () => {
    vi.mocked(apiFetch).mockResolvedValue([]);
    renderNotes();
    expect(await screen.findByRole('button', { name: 'Add note' })).toBeDisabled();
  });
});
