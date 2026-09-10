import { describe, expect, it } from 'vitest';
import { RANK_GLOSS, RANK_WEIGHT, gradeInfo, groupIsnadChains } from './grading';

describe('RANK_GLOSS and RANK_WEIGHT', () => {
  it('cover exactly the six real corpus.rank_levels codes, verified against the live database', () => {
    expect(RANK_GLOSS).toEqual({
      thiqa: 'trustworthy',
      saduq: 'truthful',
      maqbul: 'acceptable',
      layyin: 'soft',
      daif: 'weak',
      matruk: 'abandoned',
    });
    expect(RANK_WEIGHT).toEqual({
      thiqa: 0.95,
      saduq: 0.8,
      maqbul: 0.6,
      layyin: 0.4,
      daif: 0.25,
      matruk: 0.1,
    });
  });
});

describe('gradeInfo', () => {
  it('is the collector line for the compiler, unscored', () => {
    const info = gradeInfo({
      is_compiler: true,
      is_placeholder: false,
      resolution: 'X',
      rank_ibn_hajar: null,
      rank_ibn_hajar_weight: null,
    });
    expect(info).toEqual({ sentence: 'the collector — not scored', weight: null });
  });

  it('glosses a graded narrator with the canonical single-word gloss and its real weight', () => {
    const info = gradeInfo({
      is_compiler: false,
      is_placeholder: false,
      resolution: 'A',
      rank_ibn_hajar: 'thiqa',
      rank_ibn_hajar_weight: 0.95,
    });
    expect(info).toEqual({ sentence: 'trustworthy', weight: 0.95 });
  });

  it('names a resolved-but-ungraded narrator as neutral, at weight 0.50', () => {
    const info = gradeInfo({
      is_compiler: false,
      is_placeholder: false,
      resolution: 'A',
      rank_ibn_hajar: null,
      rank_ibn_hajar_weight: null,
    });
    expect(info).toEqual({
      sentence: 'identified, but no scholar graded him — neutral, not a fault',
      weight: 0.5,
    });
  });

  it('names a placeholder as unnamed, at weight 0.15', () => {
    const info = gradeInfo({
      is_compiler: false,
      is_placeholder: true,
      resolution: 'X',
      rank_ibn_hajar: null,
      rank_ibn_hajar_weight: null,
    });
    expect(info).toEqual({ sentence: 'the source records no name here', weight: 0.15 });
  });

  it('names an unresolved link (resolution X, no placeholder flag) as unnamed too', () => {
    const info = gradeInfo({
      is_compiler: false,
      is_placeholder: false,
      resolution: 'X',
      rank_ibn_hajar: null,
      rank_ibn_hajar_weight: null,
    });
    expect(info.sentence).toBe('the source records no name here');
    expect(info.weight).toBe(0.15);
  });

  it('names an ambiguous link (resolution C) as unnamed too', () => {
    const info = gradeInfo({
      is_compiler: false,
      is_placeholder: false,
      resolution: 'C',
      rank_ibn_hajar: null,
      rank_ibn_hajar_weight: null,
    });
    expect(info.sentence).toBe('the source records no name here');
  });
});

describe('groupIsnadChains', () => {
  it('groups the real hadith-5 chain into one sanad, collector first and Companion last', () => {
    // Exact shape from GET /hadiths/5 (verified against the live corpus).
    const flat = [
      { sanad_no: 1, position: 1, raw_name: 'عمر بن الخطاب' },
      { sanad_no: 1, position: 2, raw_name: 'علقمة بن وقاص العتواري' },
      { sanad_no: 1, position: 3, raw_name: 'محمد بن إبراهيم بن الحارث التيمي' },
      { sanad_no: 1, position: 4, raw_name: 'يحيى بن سعيد الأنصاري' },
      { sanad_no: 1, position: 5, raw_name: 'سفيان بن عيينة' },
      { sanad_no: 1, position: 6, raw_name: 'الحميدي' },
      { sanad_no: 1, position: 7, raw_name: 'البخاري' },
    ];

    const chains = groupIsnadChains(flat);

    expect(chains).toHaveLength(1);
    expect(chains[0].sanadNo).toBe(1);
    expect(chains[0].links.map((l) => l.raw_name)).toEqual([
      'البخاري',
      'الحميدي',
      'سفيان بن عيينة',
      'يحيى بن سعيد الأنصاري',
      'محمد بن إبراهيم بن الحارث التيمي',
      'علقمة بن وقاص العتواري',
      'عمر بن الخطاب',
    ]);
  });

  it('groups a multi-sanad hadith into separate chains, sorted by sanad_no', () => {
    const flat = [
      { sanad_no: 2, position: 1, raw_name: 'a' },
      { sanad_no: 1, position: 1, raw_name: 'b' },
      { sanad_no: 2, position: 2, raw_name: 'c' },
      { sanad_no: 1, position: 2, raw_name: 'd' },
    ];
    const chains = groupIsnadChains(flat);
    expect(chains.map((c) => c.sanadNo)).toEqual([1, 2]);
    expect(chains[0].links.map((l) => l.raw_name)).toEqual(['d', 'b']);
    expect(chains[1].links.map((l) => l.raw_name)).toEqual(['c', 'a']);
  });

  it('returns an empty array for a hadith with no chain', () => {
    expect(groupIsnadChains([])).toEqual([]);
  });
});
