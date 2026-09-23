import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/apiClient', async () => {
  const actual = await vi.importActual<typeof import('../../lib/apiClient')>('../../lib/apiClient');
  return { ...actual, apiFetch: vi.fn() };
});

import { apiFetch } from '../../lib/apiClient';
import { HadithPicker } from './HadithPicker';

function renderPicker(onSelect: (hadith: { hadith_id: number }) => void) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <HadithPicker onSelect={onSelect} />
    </QueryClientProvider>,
  );
}

describe('HadithPicker', () => {
  it('does not search until at least 2 characters are typed', () => {
    renderPicker(() => {});
    fireEvent.change(screen.getByLabelText(/find a hadith/i), { target: { value: 'a' } });
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it('lists matches and calls onSelect with the chosen hadith', async () => {
    vi.mocked(apiFetch).mockResolvedValue([
      {
        hadith_id: 42,
        hadith_num: '42',
        text_plain: 'إنما الأعمال بالنيات',
        text_en: 'Actions are judged by intentions.',
        sanad_count: 1,
        chain_strength: 0.9,
      },
    ]);
    const onSelect = vi.fn();
    renderPicker(onSelect);
    fireEvent.change(screen.getByLabelText(/find a hadith/i), { target: { value: 'intentions' } });
    const match = await screen.findByRole('button', { name: /actions are judged by intentions/i });
    fireEvent.click(match);
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ hadith_id: 42, hadith_num: '42' }),
    );
  });

  it('clears the query and results after a selection', async () => {
    vi.mocked(apiFetch).mockResolvedValue([
      {
        hadith_id: 42,
        hadith_num: '42',
        text_plain: 'إنما الأعمال بالنيات',
        text_en: 'Actions are judged by intentions.',
        sanad_count: 1,
        chain_strength: null,
      },
    ]);
    renderPicker(() => {});
    const input = screen.getByLabelText(/find a hadith/i);
    fireEvent.change(input, { target: { value: 'intentions' } });
    const match = await screen.findByRole('button', { name: /actions are judged by intentions/i });
    fireEvent.click(match);
    await waitFor(() => expect(input).toHaveValue(''));
    expect(screen.queryByRole('button', { name: /actions are judged by intentions/i })).not.toBeInTheDocument();
  });
});
