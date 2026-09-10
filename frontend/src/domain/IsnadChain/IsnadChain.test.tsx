import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { IsnadChain } from './IsnadChain';

const REAL_HADITH_5_CHAIN = [
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
];

describe('IsnadChain', () => {
  it('renders the collector first and the earliest position last', () => {
    render(<IsnadChain links={REAL_HADITH_5_CHAIN} />);
    const names = screen.getAllByRole('listitem').map((li) => li.textContent);
    expect(names[0]).toContain('البخاري');
    expect(names[names.length - 1]).toContain('عمر بن الخطاب');
  });

  it('glosses a graded narrator with the plain-word sentence and the bracketed weight', () => {
    render(<IsnadChain links={REAL_HADITH_5_CHAIN} />);
    expect(screen.getByText('trustworthy')).toBeInTheDocument();
    expect(screen.getByText('[0.95]')).toBeInTheDocument();
  });

  it('labels the compiler as not scored, with no weight shown', () => {
    render(<IsnadChain links={REAL_HADITH_5_CHAIN} />);
    expect(screen.getByText('the collector — not scored')).toBeInTheDocument();
  });

  it('glosses the transmission word for a link that carries one', () => {
    render(<IsnadChain links={REAL_HADITH_5_CHAIN} />);
    expect(screen.getByText('[أخبرني]')).toBeInTheDocument();
    expect(screen.getByText('"he informed us"')).toBeInTheDocument();
  });

  it('gives every Arabic name an explicit dir="rtl"', () => {
    render(<IsnadChain links={REAL_HADITH_5_CHAIN} />);
    const name = screen.getByText('البخاري');
    expect(name).toHaveAttribute('dir', 'rtl');
  });

  it('marks the sanad that sets the score when strongestSanadNo is given', () => {
    render(<IsnadChain links={REAL_HADITH_5_CHAIN} strongestSanadNo={1} />);
    expect(screen.getByText('sets the score')).toBeInTheDocument();
  });

  it('renders nothing chain-related, with an honest empty state, when there is no chain', () => {
    render(<IsnadChain links={[]} />);
    expect(screen.getByText(/no chain/i)).toBeInTheDocument();
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
  });
});
