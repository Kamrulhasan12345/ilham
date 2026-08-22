import { pool } from '../../db/pool.js';
import type { CollectionRow } from './collections.interface.js';

export async function listCollections(): Promise<CollectionRow[]> {
  const { rows } = await pool.query<CollectionRow>(
    `SELECT collection_id, slug, title_ar, title_en
       FROM corpus.collections
      ORDER BY collection_id`,
  );
  return rows;
}
