import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createMemoryHistory, createRouter } from '@tanstack/react-router';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { AuthContextValue } from '../../../auth/AuthContext';
import { routeTree } from '../../../routeTree.gen';

vi.mock('../../../lib/apiClient', async () => {
  const actual =
    await vi.importActual<typeof import('../../../lib/apiClient')>('../../../lib/apiClient');
  return { ...actual, apiFetch: vi.fn() };
});

import { apiFetch } from '../../../lib/apiClient';

const COLLECTIONS = [
  {
    collection_id: 1,
    slug: 'sahih-al-bukhari',
    title_ar: 'صحيح البخاري',
    title_en: 'Sahih al-Bukhari',
  },
  { collection_id: 2, slug: 'sahih-muslim', title_ar: 'صحيح مسلم', title_en: 'Sahih Muslim' },
];

const CHAPTERS = [
  { chapter_id: 10, collection_id: 2, seq: 1, title_ar: 'كتاب الإيمان' },
  { chapter_id: 11, collection_id: 2, seq: 2, title_ar: 'كتاب الطهارة' },
];

function renderAt(path: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const auth: AuthContextValue = {
    state: {
      status: 'signed-in',
      user: { user_id: 1, role: 'student', full_name: 'Amina', email: 'a@example.com' },
    },
    ready: Promise.resolve({
      status: 'signed-in',
      user: { user_id: 1, role: 'student', full_name: 'Amina', email: 'a@example.com' },
    }),
    signIn: async () => {},
    signOut: async () => {},
  };
  const history = createMemoryHistory({ initialEntries: [path] });
  const router = createRouter({ routeTree, history, context: { auth } });
  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

function mockApiFetch(chapters: unknown[], hadiths: unknown[]) {
  vi.mocked(apiFetch).mockImplementation(async (path: string) => {
    if (path === '/collections') return COLLECTIONS as never;
    if (path.startsWith('/chapters')) return chapters as never;
    return hadiths as never;
  });
}

describe('Hadiths-in-chapter page', () => {
  it('resolves slug -> collection_id -> (via seq) chapter_id, then fetches and renders hadiths, linking each to its hadith detail page', async () => {
    mockApiFetch(CHAPTERS, [
      { hadith_id: 100, hadith_num: '1', text_plain: 'إنما الأعمال بالنيات', sanad_count: 3 },
      { hadith_id: 101, hadith_num: '2', text_plain: 'الدين النصيحة', sanad_count: 0 },
    ]);
    renderAt('/collections/sahih-muslim/1');

    expect(await screen.findByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();

    const link1 = screen.getByRole('link', { name: /إنما الأعمال بالنيات/ });
    expect(link1).toHaveAttribute('href', '/hadiths/100');
    const link2 = screen.getByRole('link', { name: /الدين النصيحة/ });
    expect(link2).toHaveAttribute('href', '/hadiths/101');

    const [hadithsPath] = vi
      .mocked(apiFetch)
      .mock.calls.find(([p]) => typeof p === 'string' && p.startsWith('/hadiths'))!;
    expect(hadithsPath).toBe('/hadiths?chapter_id=10&limit=50&offset=0');
  });

  it('shows the pager and its "Showing X–Y" text', async () => {
    mockApiFetch(CHAPTERS, [
      { hadith_id: 100, hadith_num: '1', text_plain: 'إنما الأعمال بالنيات', sanad_count: 3 },
    ]);
    renderAt('/collections/sahih-muslim/1');

    expect(await screen.findByText('Showing 1–1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /previous/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /next/i })).toBeInTheDocument();
  });

  it('shows a plain error message when the requested seq does not match any real chapter', async () => {
    mockApiFetch(CHAPTERS, [
      { hadith_id: 100, hadith_num: '1', text_plain: 'إنما الأعمال بالنيات', sanad_count: 3 },
    ]);
    renderAt('/collections/sahih-muslim/999');

    expect(await screen.findByText('This chapter could not be found.')).toBeInTheDocument();
    expect(screen.queryByText(/hadith list could not be loaded/i)).not.toBeInTheDocument();
  });

  it('shows the empty state when the chapter has no hadiths yet', async () => {
    mockApiFetch(CHAPTERS, []);
    renderAt('/collections/sahih-muslim/1');

    expect(await screen.findByText('This chapter has no hadiths yet.')).toBeInTheDocument();
  });

  it('truncates a long text_plain snippet to roughly 80 characters plus an ellipsis', async () => {
    const longText = 'ب'.repeat(200);
    mockApiFetch(CHAPTERS, [
      { hadith_id: 100, hadith_num: '1', text_plain: longText, sanad_count: 3 },
    ]);
    renderAt('/collections/sahih-muslim/1');

    const link = await screen.findByRole('link', { name: /1/ });
    const rendered = link.textContent ?? '';
    expect(rendered).toContain('…');
    expect(rendered.length).toBeLessThan(longText.length);
  });
});
