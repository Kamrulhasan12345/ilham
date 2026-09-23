export interface NarratorDetail {
  narrator_id: number;
  display_name: string;
  name: string;
  name_en: string | null;
  kunya: string | null;
  lineage: string | null;
  relation: string | null;
  tabaqa_raw: string | null;
  generation: number | null;
  school: string | null;
  date_of_death: string | null;
  is_placeholder: boolean;
  rank_ibn_hajar_raw: string | null;
  rank_ibn_hajar_code: string | null;
  rank_ibn_hajar_label: string | null;
  rank_ibn_hajar_weight: number | null;
  rank_dhahabi_raw: string | null;
  rank_dhahabi_code: string | null;
  rank_dhahabi_label: string | null;
  rank_dhahabi_weight: number | null;
}

export interface NarratorSearchParams {
  q?: string;
  limit: number;
  offset: number;
}

export interface AdjacentNarratorRow {
  direction: 'taught' | 'learned_from';
  narrator_id: number | null;
  display_name: string | null;
  transmission_word: string | null;
}

export interface NarratorHadithParams {
  narratorId: number;
  limit: number;
  offset: number;
}
