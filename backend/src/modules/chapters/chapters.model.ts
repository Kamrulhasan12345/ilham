import { pool } from '../../db/pool.js';
import type { ChapterListParams, ChapterRow } from './chapters.interface.js';

export async function listChapters(params: ChapterListParams): Promise<ChapterRow[]> {
  const { rows } = await pool.query<ChapterRow>(
    `SELECT c.chapter_id, c.collection_id, c.seq, c.title_ar,
            count(h.hadith_id)::int AS hadith_count
       FROM corpus.chapters c
       LEFT JOIN corpus.hadiths h ON h.chapter_id = c.chapter_id
      WHERE c.collection_id = $1
      GROUP BY c.chapter_id, c.collection_id, c.seq, c.title_ar
      ORDER BY c.seq
      LIMIT $2 OFFSET $3`,
    [params.collectionId, params.limit, params.offset],
  );
  return rows;
}
