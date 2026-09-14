export interface NarratorRow {
  narrator_id: number;
  display_name: string | null;
  name_en: string | null;
  raw_name: string;
  is_placeholder: boolean;
  rank_ibn_hajar_raw: string | null;
  rank_ibn_hajar: string | null;
  rank_ibn_hajar_via: string | null;
  rank_dhahabi_raw: string | null;
  rank_dhahabi: string | null;
  rank_dhahabi_via: string | null;
}

export interface NarratorSearchParams {
  q?: string;
  limit: number;
  offset: number;
}

export interface NarratorHadithParams {
  narratorId: number;
  limit: number;
  offset: number;
}
