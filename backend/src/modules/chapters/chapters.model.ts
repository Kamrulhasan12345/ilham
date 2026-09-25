import { pool } from '../../db/pool.js';
import type { ChapterListParams, ChapterRow } from './chapters.interface.js';

export async function listChapters(
  params: ChapterListParams,
): Promise<{ rows: ChapterRow[]; total: number }> {
  // ::integer so an out-of-smallint-range id matches nothing instead of
  // raising PG 22003 (out of range for type smallint).
  const conditions = ['c.collection_id = $1::integer'];
  const values: unknown[] = [params.collectionId];
  if (params.seq !== undefined) {
    values.push(params.seq);
    conditions.push(`c.seq = $${values.length}::integer`);
  }
  values.push(params.limit);
  const limitPh = `$${values.length}`;
  values.push(params.offset);
  const offsetPh = `$${values.length}`;

  const { rows } = await pool.query<ChapterRow & { total: number }>(
    `SELECT c.chapter_id, c.collection_id, c.seq, c.title_ar,
            count(h.hadith_id)::int AS hadith_count,
            count(*) OVER ()::int AS total
       FROM corpus.chapters c
       LEFT JOIN corpus.hadiths h ON h.chapter_id = c.chapter_id
      WHERE ${conditions.join(' AND ')}
      GROUP BY c.chapter_id, c.collection_id, c.seq, c.title_ar
      ORDER BY c.seq
      LIMIT ${limitPh} OFFSET ${offsetPh}`,
    values,
  );
  const total = rows[0]?.total ?? 0;
  return { rows: rows.map(({ total: _total, ...row }) => row), total };
}
