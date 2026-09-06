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

export interface CollectionSummary {
  slug: string;
  title_ar: string;
  title_en: string | null;
}

export interface ChapterSummary {
  chapter_id: number;
  seq: number;
  title_ar: string;
}

export interface TranslationRow {
  lang: string;
  text_full: string;
  source: string;
  match_via: string | null;
}

export interface IsnadLinkRow {
  sanad_no: number;
  position: number;
  narrator_id: number | null;
  display_name: string | null;
  name_en: string | null;
  raw_name: string;
  transmission_word: string | null;
  is_compiler: boolean;
  resolution: string;
  rank_ibn_hajar_raw: string | null;
  rank_ibn_hajar: string | null;
}

export interface ChainGroup {
  sanad_no: number;
  strength: number | null;
  links: IsnadLinkRow[];
}

export interface HadithDetail {
  hadith: HadithRow;
  collection: CollectionSummary | null;
  chapter: ChapterSummary | null;
  translation: TranslationRow | null;
  chains: ChainGroup[];
  chain_strength: number | null;
  chain_strength_basis: { words_aligned: boolean; sanad_count: number };
}
