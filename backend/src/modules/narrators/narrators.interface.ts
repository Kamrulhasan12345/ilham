export interface NarratorDetail {
  narrator_id: number;
  display_name: string;
  name: string;
  name_en: string | null;
  kunya: string | null;
  lineage: string | null;
  relation: string | null;
  tabaqa_raw: string | null;
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
