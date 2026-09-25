import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createMemoryHistory, createRouter } from '@tanstack/react-router';
import { render, screen } from '@testing-library/react';
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

const COLLECTIONS = [
  {
    collection_id: 1,
    slug: 'sahih-al-bukhari',
    title_ar: 'صحيح البخاري',
    title_en: 'Sahih al-Bukhari',
  },
  { collection_id: 2, slug: 'sahih-muslim', title_ar: 'صحيح مسلم', title_en: 'Sahih Muslim' },
];
const KITABS = [
  {
    kitab_id: 65,
    collection_id: 1,
    kitab_num: 65,
    title_en: "Prophetic Commentary on the Qur'an",
    title_ar: 'كتاب التفسير',
    bab_count: 2,
    hadith_count: 3,
  },
];
const bab = (bab_id: number, seq: number, extra: Record<string, unknown>) => ({
  bab_id,
  kitab_id: 65,
  seq,
  bab_num: String(seq),
  surah_num: 1,
  surah_title_en: 'Surat al-Fatiha (The Opening)',
  surah_title_ar: 'سورة الفاتحة',
  title_en: null,
  title_ar: 'باب',
  hadith_count: 1,
  ...extra,
});
const KITAB = {
  ...KITABS[0],
  kitab_level_count: 0,
  babs: [
    bab(500, 1, { title_en: 'What has been said about al-Fatiha', hadith_count: 2 }),
    bab(501, 2, {
      surah_num: 2,
      surah_title_en: 'Surat al-Baqarah (The Cow)',
      surah_title_ar: 'سورة البقرة',
    }),
  ],
};
const HADITHS = [
  {
    hadith_id: 100,
    hadith_num: '4474',
    text_plain: 'إنما الأعمال بالنيات',
    text_en: null,
    sanad_count: 3,
    chain_strength: 0.95,
  },
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
    <AuthContext.Provider value={auth}>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </AuthContext.Provider>,
  );
}

function mockApiFetch(hadiths: unknown[]) {
  vi.mocked(apiFetch).mockImplementation(async (path: string) => {
    if (path === '/collections') return COLLECTIONS as never;
    if (path.startsWith('/kitabs?')) return KITABS as never;
    if (path.startsWith('/kitabs/')) return KITAB as never;
    if (path.startsWith('/sets')) return [] as never;
    return hadiths as never;
  });
}

describe('Kitab page', () => {
  it('lists the babs under their surah headings and links each bab by its page position', async () => {
    mockApiFetch(HADITHS);
    renderAt('/collections/sahih-al-bukhari/65');
    expect(await screen.findByText('Surat al-Fatiha (The Opening)')).toBeInTheDocument();
    expect(screen.getByText('Surat al-Baqarah (The Cow)')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /What has been said about al-Fatiha/ }),
    ).toHaveAttribute('href', '/collections/sahih-al-bukhari/65/1');
  });

  it('shows a plain message for an unknown kitab number', async () => {
    mockApiFetch(HADITHS);
    renderAt('/collections/sahih-al-bukhari/99');
    expect(await screen.findByText('No such book')).toBeInTheDocument();
  });
});

describe('Bab page', () => {
  it('resolves slug -> kitab -> bab by seq, then fetches the bab hadiths and links each to its detail page', async () => {
    mockApiFetch(HADITHS);
    renderAt('/collections/sahih-al-bukhari/65/1');
    expect(
      await screen.findByRole('heading', { name: 'What has been said about al-Fatiha' }),
    ).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: /إنما الأعمال بالنيات/ })).toHaveAttribute(
      'href',
      '/hadiths/100',
    );
    const [hadithsPath] = vi
      .mocked(apiFetch)
      .mock.calls.find(([p]) => typeof p === 'string' && p.startsWith('/hadiths'))!;
    expect(hadithsPath).toBe('/hadiths?bab_id=500&limit=50&offset=0');
  });

  it('shows a plain message when the bab position does not exist', async () => {
    mockApiFetch(HADITHS);
    renderAt('/collections/sahih-al-bukhari/65/9');
    expect(await screen.findByText('No such chapter')).toBeInTheDocument();
  });

  it('shows the empty state for a heading-only bab', async () => {
    mockApiFetch([]);
    renderAt('/collections/sahih-al-bukhari/65/2');
    expect(
      await screen.findByText('This chapter has no hadiths in the corpus'),
    ).toBeInTheDocument();
  });
});
