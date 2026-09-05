export interface HadithRow {
  hadith_id: number;
  collection_id: number;
  chapter_id: number | null;
  hadith_num: string;
  text_plain: string;
  text_diac: string;
  sanad_count: number;
}

export interface HadithListParams {
  collectionId?: number;
  chapterId?: number;
  limit: number;
  offset: number;
}

export interface TranslationRow {
  lang: string;
  text_full: string;
  source: string;
}

export interface IsnadLinkRow {
  sanad_no: number;
  position: number;
  narrator_id: number | null;
  raw_name: string;
  display_name: string | null;
  name_en: string | null;
  transmission_word: string | null;
  is_compiler: boolean;
  resolution: string;
  is_placeholder: boolean;
  rank_ibn_hajar: string | null;
  rank_ibn_hajar_weight: number | null;
  rank_dhahabi: string | null;
  rank_dhahabi_weight: number | null;
}

export interface HadithDetail {
  hadith: HadithRow;
  translation: TranslationRow | null;
  isnadChain: IsnadLinkRow[];
  chainStrength: number | null;
}
