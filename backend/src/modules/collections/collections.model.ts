import { pool } from '../../db/pool.js';
import type { CollectionRow } from './collections.interface.js';

export async function listCollections(): Promise<CollectionRow[]> {
  const { rows } = await pool.query<CollectionRow>(
    `SELECT c.collection_id, c.slug, c.title_ar, c.title_en,
            (SELECT count(*)::int FROM corpus.hadiths h WHERE h.collection_id = c.collection_id) AS hadith_count
       FROM corpus.collections c
      ORDER BY c.collection_id`,
  );
  return rows;
}
