import { pool } from '../../db/pool.js';
import type { NarratorHadithParams, NarratorRow, NarratorSearchParams } from './narrators.interface.js';

const NARRATOR_COLUMNS = `
  narrator_id, display_name, name_en, raw_name, is_placeholder,
  rank_ibn_hajar_raw, rank_ibn_hajar, rank_ibn_hajar_via,
  rank_dhahabi_raw, rank_dhahabi, rank_dhahabi_via
`;

export async function getNarratorById(narratorId: number): Promise<NarratorRow | null> {
  const { rows } = await pool.query<NarratorRow>(
    `SELECT ${NARRATOR_COLUMNS} FROM corpus.narrators WHERE narrator_id = $1`,
    [narratorId],
  );
  return rows[0] ?? null;
}

export async function searchNarrators(params: NarratorSearchParams): Promise<NarratorRow[]> {
  if (!params.q) {
    const { rows } = await pool.query<NarratorRow>(
      `SELECT ${NARRATOR_COLUMNS} FROM corpus.narrators
        ORDER BY narrator_id
        LIMIT $1 OFFSET $2`,
      [params.limit, params.offset],
    );
    return rows;
  }
  const { rows } = await pool.query<NarratorRow>(
    `SELECT ${NARRATOR_COLUMNS} FROM corpus.narrators
      WHERE name_norm ILIKE '%' || $1 || '%' OR display_norm ILIKE '%' || $1 || '%'
      ORDER BY narrator_id
      LIMIT $2 OFFSET $3`,
    [params.q, params.limit, params.offset],
  );
  return rows;
}

export async function listHadithsForNarrator(
  params: NarratorHadithParams,
): Promise<{ hadith_id: number; hadith_num: string; collection_id: number }[]> {
  const { rows } = await pool.query<{ hadith_id: number; hadith_num: string; collection_id: number }>(
    `SELECT DISTINCT h.hadith_id, h.hadith_num, h.collection_id
       FROM corpus.isnad_links l
       JOIN corpus.hadiths h ON h.hadith_id = l.hadith_id
      WHERE l.narrator_id = $1
      ORDER BY h.hadith_id
      LIMIT $2 OFFSET $3`,
    [params.narratorId, params.limit, params.offset],
  );
  return rows;
}
