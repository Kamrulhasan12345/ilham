import { pool } from '../../db/pool.js';
import type { BabDetail, BabRow, KitabDetail, KitabRow } from './kitabs.interface.js';

const KITAB_COLS = `k.kitab_id, k.collection_id, k.kitab_num, k.title_en, k.title_ar,
       (SELECT count(*)::int FROM corpus.babs b WHERE b.kitab_id = k.kitab_id) AS bab_count,
       (SELECT count(*)::int FROM corpus.hadiths h WHERE h.kitab_id = k.kitab_id) AS hadith_count`;

const BAB_COLS = `b.bab_id, b.kitab_id, b.seq, b.bab_num, b.surah_num,
       s.title_en AS surah_title_en, s.title_ar AS surah_title_ar, b.title_en, b.title_ar,
       (SELECT count(*)::int FROM corpus.hadiths h WHERE h.bab_id = b.bab_id) AS hadith_count`;

export async function listKitabs(collectionId: number): Promise<KitabRow[]> {
  // ::integer so an out-of-smallint-range id matches nothing instead of
  // raising PG 22003 (out of range for type smallint).
  const { rows } = await pool.query<KitabRow>(
    `SELECT ${KITAB_COLS} FROM corpus.kitabs k
      WHERE k.collection_id = $1::integer ORDER BY k.kitab_num`,
    [collectionId],
  );
  return rows;
}

export async function getKitab(kitabId: number): Promise<KitabDetail | null> {
  const { rows } = await pool.query(
    `SELECT ${KITAB_COLS},
            (SELECT count(*)::int FROM corpus.hadiths h
              WHERE h.kitab_id = k.kitab_id AND h.bab_id IS NULL) AS kitab_level_count,
            json_build_object('collection_id', c.collection_id, 'slug', c.slug,
                              'title_en', c.title_en, 'title_ar', c.title_ar) AS collection
       FROM corpus.kitabs k JOIN corpus.collections c USING (collection_id)
      WHERE k.kitab_id = $1::integer`,
    [kitabId],
  );
  if (!rows[0]) return null;
  const { rows: babs } = await pool.query<BabRow>(
    `SELECT ${BAB_COLS} FROM corpus.babs b LEFT JOIN corpus.surahs s USING (surah_num)
      WHERE b.kitab_id = $1::integer ORDER BY b.seq`,
    [kitabId],
  );
  return { ...rows[0], babs };
}

export async function getBab(babId: number): Promise<BabDetail | null> {
  const { rows } = await pool.query<BabDetail>(
    `SELECT ${BAB_COLS},
            json_build_object('kitab_id', k.kitab_id, 'kitab_num', k.kitab_num,
                              'title_en', k.title_en, 'title_ar', k.title_ar) AS kitab,
            json_build_object('collection_id', c.collection_id, 'slug', c.slug,
                              'title_en', c.title_en, 'title_ar', c.title_ar) AS collection
       FROM corpus.babs b
       LEFT JOIN corpus.surahs s USING (surah_num)
       JOIN corpus.kitabs k ON k.kitab_id = b.kitab_id
       JOIN corpus.collections c ON c.collection_id = k.collection_id
      WHERE b.bab_id = $1::integer`,
    [babId],
  );
  return rows[0] ?? null;
}
