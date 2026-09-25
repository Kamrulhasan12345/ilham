export interface KitabRow {
  kitab_id: number;
  collection_id: number;
  kitab_num: number;
  title_en: string;
  title_ar: string;
  bab_count: number;
  hadith_count: number;
}

export interface BabRow {
  bab_id: number;
  kitab_id: number;
  seq: number;
  bab_num: string | null;
  surah_num: number | null;
  surah_title_en: string | null;
  surah_title_ar: string | null;
  title_en: string | null;
  title_ar: string;
  hadith_count: number;
}

export interface KitabRef {
  kitab_id: number;
  kitab_num: number;
  title_en: string;
  title_ar: string;
}

export interface CollectionRef {
  collection_id: number;
  slug: string;
  title_en: string | null;
  title_ar: string;
}

export interface KitabDetail extends KitabRow {
  collection: CollectionRef;
  /** Hadiths the book files under the kitab itself, before its first bab. */
  kitab_level_count: number;
  babs: BabRow[];
}

export interface BabDetail extends BabRow {
  kitab: KitabRef;
  collection: CollectionRef;
}
