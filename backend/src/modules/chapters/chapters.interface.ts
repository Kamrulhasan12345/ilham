export interface ChapterRow {
  chapter_id: number;
  collection_id: number;
  seq: number;
  title_ar: string;
  hadith_count: number;
}

export interface ChapterListParams {
  collectionId: number;
  limit: number;
  offset: number;
}
