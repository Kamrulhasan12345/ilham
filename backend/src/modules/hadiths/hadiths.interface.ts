export interface HadithRow {
  hadith_id: number;
  collection_id: number;
  chapter_id: number | null;
  hadith_num: string;
  text_plain: string;
  text_diac: string;
  matn_plain: string | null;
  sanad_count: number;
}

export interface HadithListParams {
  collectionId?: number;
  chapterId?: number;
  q?: string;
  limit: number;
  offset: number;
}

export interface TranslationRow {
  lang: string;
  text_full: string;
  source: string;
  match_via: string | null;
}

export interface HadithCollection {
  slug: string;
  title_ar: string;
  title_en: string | null;
}

export interface HadithChapter {
  chapter_id: number;
  seq: number;
  title_ar: string;
}

export interface IsnadLinkRow {
  sanad_no: number;
  position: number;
  narrator_id: number | null;
  display_name: string | null;
  name_en: string | null;
  kunya: string | null;
  lineage: string | null;
  school: string | null;
  tabaqa_raw: string | null;
  /** Generation ordinal from corpus.tabaqa_generation. NULL where the text
      names no generation; the filter always shows such links. */
  generation: number | null;
  raw_name: string;
  transmission_word: string | null;
  is_compiler: boolean;
  resolution: string;
  is_placeholder: boolean;
  rank_ibn_hajar_raw: string | null;
  rank_ibn_hajar: string | null;
  rank_ibn_hajar_via: string | null;
  rank_ibn_hajar_weight: number | null;
  rank_dhahabi_raw: string | null;
  rank_dhahabi: string | null;
  rank_dhahabi_via: string | null;
  rank_dhahabi_weight: number | null;
  /** Per-link anʿana-adjusted weight: corpus.chain_strength's own arithmetic,
      served so no reader recomputes it. numeric arrives as text; the route
      contract carries numbers like the neighbouring rank weights. */
  weight: number | null;
}

export interface SanadChain {
  sanad_no: number;
  strength: number | null;
  links: IsnadLinkRow[];
}

export interface ChainStrengthBasis {
  words_aligned: boolean;
  sanad_count: number;
}

export interface HadithDetail {
  hadith: HadithRow;
  collection: HadithCollection;
  chapter: HadithChapter | null;
  translation: TranslationRow | null;
  isnadChain: IsnadLinkRow[];
  chains: SanadChain[];
  chainStrength: number | null;
  chainStrengthBasis: ChainStrengthBasis;
}
