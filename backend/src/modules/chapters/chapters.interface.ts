export interface ChapterRow {
  chapter_id: number;
  collection_id: number;
  seq: number;
  title_ar: string;
}

export interface ChapterListParams {
  collectionId: number;
  limit: number;
  offset: number;
}
