import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createMemoryHistory, createRootRoute, createRouter } from '@tanstack/react-router';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { HadithList } from './HadithList';

function renderList(items: Parameters<typeof HadithList>[0]['items']) {
  const rootRoute = createRootRoute({ component: () => <HadithList items={items} /> });
  const router = createRouter({ routeTree: rootRoute });
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} history={createMemoryHistory()} />
    </QueryClientProvider>,
  );
}

describe('HadithList', () => {
  it('shows the English text ahead of the Arabic text when a translation exists', async () => {
    renderList([
      {
        hadith_id: 1,
        hadith_num: '1',
        text_plain: 'إنما الأعمال بالنيات',
        text_en: 'Actions are judged by intentions.',
        chain_strength: 0.9,
      },
    ]);
    const link = await screen.findByRole('link');
    const children = Array.from(link.children).map((el) => el.textContent);
    const enIndex = children.findIndex((t) => t?.includes('Actions are judged by intentions.'));
    const arIndex = children.findIndex((t) => t?.includes('إنما الأعمال بالنيات'));
    expect(enIndex).toBeGreaterThanOrEqual(0);
    expect(arIndex).toBeGreaterThan(enIndex);
  });

  it('shows only the Arabic text when no translation exists', async () => {
    renderList([
      {
        hadith_id: 2,
        hadith_num: '2',
        text_plain: 'إنما الأعمال بالنيات',
        text_en: null,
        chain_strength: null,
      },
    ]);
    expect(await screen.findByText('إنما الأعمال بالنيات')).toBeInTheDocument();
    expect(screen.getByText('no chain')).toBeInTheDocument();
  });
});
