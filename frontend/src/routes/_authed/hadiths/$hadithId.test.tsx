import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createMemoryHistory, createRouter } from '@tanstack/react-router';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { AuthContextValue } from '../../../auth/AuthContext';
import { routeTree } from '../../../routeTree.gen';

vi.mock('../../../lib/apiClient', async () => {
  const actual =
    await vi.importActual<typeof import('../../../lib/apiClient')>('../../../lib/apiClient');
  return { ...actual, apiFetch: vi.fn() };
});

import { apiFetch } from '../../../lib/apiClient';

const REAL_HADITH_5 = {
  hadith: {
    hadith_id: 5,
    hadith_num: '1',
    text_plain: 'إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ',
    text_diac: 'إِنَّمَا الْأَعْمَالُ بِالنِّيَّاتِ',
    sanad_count: 1,
  },
  translation: {
    lang: 'en',
    text_full: 'Actions are only by intention, and every person has only what he intended.',
    source: 'LK-Hadith-Corpus',
  },
  isnadChain: [
    {
      sanad_no: 1,
      position: 1,
      narrator_id: 7001,
      raw_name: 'عمر بن الخطاب',
      display_name: 'عمر بن الخطاب',
      name_en: null,
      transmission_word: 'قال',
      is_compiler: false,
      resolution: 'A',
      is_placeholder: false,
      rank_ibn_hajar: null,
      rank_ibn_hajar_weight: null,
      rank_dhahabi: null,
      rank_dhahabi_weight: null,
    },
    {
      sanad_no: 1,
      position: 4,
      narrator_id: 6932,
      raw_name: 'يحيى بن سعيد الأنصاري',
      display_name: 'يحيى بن سعيد الأنصاري',
      name_en: null,
      transmission_word: 'أخبرني',
      is_compiler: false,
      resolution: 'B',
      is_placeholder: false,
      rank_ibn_hajar: 'thiqa',
      rank_ibn_hajar_weight: 0.95,
      rank_dhahabi: null,
      rank_dhahabi_weight: null,
    },
    {
      sanad_no: 1,
      position: 7,
      narrator_id: null,
      raw_name: 'البخاري',
      display_name: null,
      name_en: null,
      transmission_word: 'حدثنا',
      is_compiler: true,
      resolution: 'X',
      is_placeholder: false,
      rank_ibn_hajar: null,
      rank_ibn_hajar_weight: null,
      rank_dhahabi: null,
      rank_dhahabi_weight: null,
    },
  ],
  chainStrength: '0.8',
};

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

describe('Hadith detail page', () => {
  it('renders the matn (vowelled by default), the translation, the strength sentence, and the disclaimer', async () => {
    vi.mocked(apiFetch).mockResolvedValue(REAL_HADITH_5 as never);
    renderAt('/hadiths/5');

    expect(await screen.findByText('إِنَّمَا الْأَعْمَالُ بِالنِّيَّاتِ')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Actions are only by intention, and every person has only what he intended.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('LK-Hadith-Corpus')).toBeInTheDocument();

    expect(screen.getByText('This chain is strong.')).toBeInTheDocument();
    expect(screen.getByText('[0.80]')).toBeInTheDocument();

    expect(
      screen.getByText(/Ilham reports grades that classical scholars wrote centuries ago/),
    ).toBeInTheDocument();
  });

  it('toggles between the vowelled and plain Arabic renderings', async () => {
    vi.mocked(apiFetch).mockResolvedValue(REAL_HADITH_5 as never);
    renderAt('/hadiths/5');

    expect(await screen.findByText('إِنَّمَا الْأَعْمَالُ بِالنِّيَّاتِ')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Plain' }));
    expect(screen.getByText('إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ')).toBeInTheDocument();
    expect(screen.queryByText('إِنَّمَا الْأَعْمَالُ بِالنِّيَّاتِ')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Vowelled' }));
    expect(screen.getByText('إِنَّمَا الْأَعْمَالُ بِالنِّيَّاتِ')).toBeInTheDocument();
    expect(screen.queryByText('إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ')).not.toBeInTheDocument();
  });

  it('shows an honest statement when no English translation exists', async () => {
    vi.mocked(apiFetch).mockResolvedValue({ ...REAL_HADITH_5, translation: null } as never);
    renderAt('/hadiths/5');

    expect(
      await screen.findByText('No English translation exists for this hadith yet.'),
    ).toBeInTheDocument();
  });

  it('exposes the "Show grading detail" disclosure for the strength plot', async () => {
    vi.mocked(apiFetch).mockResolvedValue(REAL_HADITH_5 as never);
    renderAt('/hadiths/5');

    expect(await screen.findByText('This chain is strong.')).toBeInTheDocument();
    const summary = screen.getByText('Show grading detail');
    expect(summary).toBeInTheDocument();
    // jsdom renders <details> children in the DOM even when collapsed (no
    // `open` attribute), so we assert the disclosure control exists and is
    // closed by default rather than asserting the plot's absence from the DOM.
    const details = summary.closest('details');
    expect(details).not.toBeNull();
    expect(details).not.toHaveAttribute('open');
  });

  it('shows a plain error message when the request fails', async () => {
    vi.mocked(apiFetch).mockRejectedValue(new Error('network error'));
    renderAt('/hadiths/5');

    expect(
      await screen.findByText('This hadith could not be loaded. Try again.'),
    ).toBeInTheDocument();
  });

  it('renders the chain with the collector first and the Companion last', async () => {
    vi.mocked(apiFetch).mockResolvedValue(REAL_HADITH_5 as never);
    renderAt('/hadiths/5');

    const items = await screen.findAllByRole('listitem');
    const texts = items.map((li) => li.textContent ?? '');
    const collectorIndex = texts.findIndex((t) => t.includes('البخاري'));
    const companionIndex = texts.findIndex((t) => t.includes('عمر بن الخطاب'));
    expect(collectorIndex).toBeGreaterThanOrEqual(0);
    expect(companionIndex).toBeGreaterThan(collectorIndex);
  });
});
