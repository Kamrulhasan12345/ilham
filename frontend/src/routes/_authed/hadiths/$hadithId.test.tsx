import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createMemoryHistory, createRouter } from '@tanstack/react-router';
import { fireEvent, render, screen, within } from '@testing-library/react';
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

const REAL_HADITH_5 = {
  hadith: {
    hadith_id: 5,
    hadith_num: '1',
    text_plain: 'إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ',
    text_diac: 'إِنَّمَا الْأَعْمَالُ بِالنِّيَّاتِ',
    sanad_count: 1,
  },
  collection: { slug: 'bukhari', title_ar: 'صحيح البخاري', title_en: 'Sahih al-Bukhari' },
  chapter: { chapter_id: 10, seq: 1, title_ar: 'باب' },
  translation: {
    lang: 'en',
    text_full: 'Actions are only by intention, and every person has only what he intended.',
    source: 'LK-Hadith-Corpus',
    match_via: 'exact',
  },
  isnadChain: [
    {
      sanad_no: 1,
      position: 1,
      narrator_id: 7001,
      raw_name: 'عمر بن الخطاب',
      display_name: 'عمر بن الخطاب',
      name_en: null,
      kunya: null,
      lineage: null,
      school: null,
      tabaqa_raw: 'صحابي',
      generation: 1,
      transmission_word: 'قال',
      is_compiler: false,
      resolution: 'A',
      is_placeholder: false,
      rank_ibn_hajar_raw: null,
      rank_ibn_hajar: null,
      rank_ibn_hajar_via: null,
      rank_ibn_hajar_weight: null,
      rank_dhahabi_raw: null,
      rank_dhahabi: null,
      rank_dhahabi_via: null,
      rank_dhahabi_weight: null,
      weight: 0.5,
    },
    {
      sanad_no: 1,
      position: 4,
      narrator_id: 6932,
      raw_name: 'يحيى بن سعيد الأنصاري',
      display_name: 'يحيى بن سعيد الأنصاري',
      name_en: null,
      kunya: null,
      lineage: null,
      school: null,
      tabaqa_raw: 'الخامسة',
      generation: 5,
      transmission_word: 'أخبرني',
      is_compiler: false,
      resolution: 'B',
      is_placeholder: false,
      rank_ibn_hajar_raw: 'ثقة',
      rank_ibn_hajar: 'thiqa',
      rank_ibn_hajar_via: 'exact',
      rank_ibn_hajar_weight: 0.95,
      rank_dhahabi_raw: null,
      rank_dhahabi: null,
      rank_dhahabi_via: null,
      rank_dhahabi_weight: null,
      weight: 0.95,
    },
    {
      sanad_no: 1,
      position: 7,
      narrator_id: null,
      raw_name: 'البخاري',
      display_name: null,
      name_en: null,
      kunya: null,
      lineage: null,
      school: null,
      tabaqa_raw: null,
      generation: null,
      transmission_word: 'حدثنا',
      is_compiler: true,
      resolution: 'X',
      is_placeholder: false,
      rank_ibn_hajar_raw: null,
      rank_ibn_hajar: null,
      rank_ibn_hajar_via: null,
      rank_ibn_hajar_weight: null,
      rank_dhahabi_raw: null,
      rank_dhahabi: null,
      rank_dhahabi_via: null,
      rank_dhahabi_weight: null,
      weight: 0.15,
    },
  ],
  chains: [],
  chainStrength: '0.8',
  chainStrengthBasis: { words_aligned: true, sanad_count: 1 },
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
    <AuthContext.Provider value={auth}>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </AuthContext.Provider>,
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

    expect(screen.getByText('strong')).toBeInTheDocument();
    expect(screen.getByText('[wt 0.80]')).toBeInTheDocument();

    expect(
      screen.getByText(/Ilham reports grades that classical scholars wrote centuries ago/),
    ).toBeInTheDocument();
  });

  it('toggles between the vowelled and plain Arabic renderings', async () => {
    vi.mocked(apiFetch).mockResolvedValue(REAL_HADITH_5 as never);
    renderAt('/hadiths/5');

    expect(await screen.findByText('إِنَّمَا الْأَعْمَالُ بِالنِّيَّاتِ')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('radio', { name: 'Plain' }));
    expect(screen.getByText('إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ')).toBeInTheDocument();
    expect(screen.queryByText('إِنَّمَا الْأَعْمَالُ بِالنِّيَّاتِ')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('radio', { name: 'Vowelled' }));
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

    expect(await screen.findByText('strong')).toBeInTheDocument();
    // The disclosure is an accordion item, collapsed by default: the
    // trigger exists and the ledger table stays out of the DOM until opened.
    const trigger = await screen.findByRole('button', { name: 'Show grading detail' });
    expect(trigger).toBeInTheDocument();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Ibn Hajar')).not.toBeInTheDocument();
  });

  it('shows a plain error message when the request fails', async () => {
    vi.mocked(apiFetch).mockRejectedValue(new Error('network error'));
    renderAt('/hadiths/5');

    expect(await screen.findByText('This hadith could not be loaded')).toBeInTheDocument();
  });

  it('renders the chain with the collector first and the Companion last', async () => {
    vi.mocked(apiFetch).mockResolvedValue(REAL_HADITH_5 as never);
    renderAt('/hadiths/5');

    // The breadcrumb trail renders its own <li>s (and the sidebar more
    // outside <main>) the moment any data lands, so findAllByRole would
    // resolve before the chain paints. Wait for the chain heading first.
    await screen.findByText('Chain of transmission');
    // The sidebar renders its own <li>s instantly, so scope to the page.
    const items = await within(screen.getByRole('main')).findAllByRole('listitem');
    const texts = items.map((li) => li.textContent ?? '');
    const collectorIndex = texts.findIndex((t) => t.includes('البخاري'));
    const companionIndex = texts.findIndex((t) => t.includes('عمر بن الخطاب'));
    expect(collectorIndex).toBeGreaterThanOrEqual(0);
    expect(companionIndex).toBeGreaterThan(collectorIndex);
  });
});
