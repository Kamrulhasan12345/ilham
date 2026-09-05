import { pool } from '../../db/pool.js';
import type { ChapterListParams, ChapterRow } from './chapters.interface.js';

export async function listChapters(params: ChapterListParams): Promise<ChapterRow[]> {
  const { rows } = await pool.query<ChapterRow>(
    `SELECT chapter_id, collection_id, seq, title_ar
       FROM corpus.chapters
      WHERE collection_id = $1
      ORDER BY seq
      LIMIT $2 OFFSET $3`,
    [params.collectionId, params.limit, params.offset],
  );
  return rows;
}
