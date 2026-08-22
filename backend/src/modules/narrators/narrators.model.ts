import { pool } from '../../db/pool.js';
import type { NarratorDetail } from './narrators.interface.js';

export async function getNarratorById(narratorId: number): Promise<NarratorDetail | null> {
  const { rows } = await pool.query<NarratorDetail>(
    `SELECT n.narrator_id, n.display_name, n.name, n.name_en, n.kunya, n.lineage,
            n.relation, n.tabaqa_raw, n.school, n.date_of_death, n.is_placeholder,
            n.rank_ibn_hajar_raw, n.rank_ibn_hajar AS rank_ibn_hajar_code,
            rh.label_ar AS rank_ibn_hajar_label, rh.weight AS rank_ibn_hajar_weight,
            n.rank_dhahabi_raw, n.rank_dhahabi AS rank_dhahabi_code,
            rd.label_ar AS rank_dhahabi_label, rd.weight AS rank_dhahabi_weight
       FROM corpus.narrators n
       LEFT JOIN corpus.rank_levels rh ON rh.rank_code = n.rank_ibn_hajar
       LEFT JOIN corpus.rank_levels rd ON rd.rank_code = n.rank_dhahabi
      WHERE n.narrator_id = $1`,
    [narratorId],
  );
  return rows[0] ?? null;
}
