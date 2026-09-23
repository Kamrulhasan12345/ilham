import { pool } from '../../db/pool.js';
import type {
  AdjacentNarratorRow,
  NarratorDetail,
  NarratorHadithParams,
  NarratorSearchParams,
} from './narrators.interface.js';

const NARRATOR_DETAIL_COLUMNS = `
  n.narrator_id, n.display_name, n.name, n.name_en, n.kunya, n.lineage,
  n.relation, n.tabaqa_raw, n.generation, n.school, n.date_of_death, n.is_placeholder,
  n.rank_ibn_hajar_raw, n.rank_ibn_hajar AS rank_ibn_hajar_code,
  rh.label_ar AS rank_ibn_hajar_label, rh.weight AS rank_ibn_hajar_weight,
  n.rank_dhahabi_raw, n.rank_dhahabi AS rank_dhahabi_code,
  rd.label_ar AS rank_dhahabi_label, rd.weight AS rank_dhahabi_weight
`;

const NARRATOR_DETAIL_JOINS = `
  FROM corpus.narrators n
  LEFT JOIN corpus.rank_levels rh ON rh.rank_code = n.rank_ibn_hajar
  LEFT JOIN corpus.rank_levels rd ON rd.rank_code = n.rank_dhahabi
`;

export async function getNarratorById(narratorId: number): Promise<NarratorDetail | null> {
  const { rows } = await pool.query<NarratorDetail>(
    `SELECT ${NARRATOR_DETAIL_COLUMNS} ${NARRATOR_DETAIL_JOINS} WHERE n.narrator_id = $1`,
    [narratorId],
  );
  return rows[0] ?? null;
}

export async function searchNarrators(params: NarratorSearchParams): Promise<NarratorDetail[]> {
  if (!params.q) {
    const { rows } = await pool.query<NarratorDetail>(
      `SELECT ${NARRATOR_DETAIL_COLUMNS} ${NARRATOR_DETAIL_JOINS}
        ORDER BY n.narrator_id
        LIMIT $1 OFFSET $2`,
      [params.limit, params.offset],
    );
    return rows;
  }
  const { rows } = await pool.query<NarratorDetail>(
    `SELECT ${NARRATOR_DETAIL_COLUMNS} ${NARRATOR_DETAIL_JOINS}
      WHERE n.name_norm ILIKE '%' || $1 || '%' OR n.display_norm ILIKE '%' || $1 || '%'
      ORDER BY n.narrator_id
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

// Neighbours in the transmission graph, both directions, read from the
// edges view (backend PRD §5.3). UNION folds repeat transmissions of the
// same pair with the same word into one row.
export async function listAdjacentNarrators(narratorId: number): Promise<AdjacentNarratorRow[]> {
  const { rows } = await pool.query<AdjacentNarratorRow>(
    `SELECT 'taught' AS direction, e.to_narrator AS narrator_id,
            n.display_name, e.transmission_word
       FROM corpus.isnad_edges e
       LEFT JOIN corpus.narrators n ON n.narrator_id = e.to_narrator
      WHERE e.from_narrator = $1
      UNION
     SELECT 'learned_from' AS direction, e.from_narrator AS narrator_id,
            n.display_name, e.transmission_word
       FROM corpus.isnad_edges e
       LEFT JOIN corpus.narrators n ON n.narrator_id = e.from_narrator
      WHERE e.to_narrator = $1
      ORDER BY direction, narrator_id NULLS LAST`,
    [narratorId],
  );
  return rows;
}
