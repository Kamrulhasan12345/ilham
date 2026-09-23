import { pool } from '../../db/pool.js';
import type {
  ContestedNarratorRow,
  SharedNarratorRow,
  TopNarratorRow,
  WeakestChainRow,
} from './analytics.interface.js';

// PRD §5.5 Q1: count of chain positions per narrator, excluding the
// compiler row and placeholder narrators.
export async function getTopNarrators(limit: number): Promise<TopNarratorRow[]> {
  const { rows } = await pool.query(
    `SELECT n.narrator_id, n.display_name, count(*)::int AS positions
       FROM corpus.isnad_links l
       JOIN corpus.narrators n ON n.narrator_id = l.narrator_id
      WHERE NOT l.is_compiler AND NOT n.is_placeholder
      GROUP BY n.narrator_id, n.display_name
      ORDER BY positions DESC, n.narrator_id
      LIMIT $1`,
    [limit],
  );
  return rows;
}

// PRD §5.5 Q2: the two scholars' rank ordinals differ. A via of 'S' means the
// Companion tabaqa pass set both columns from one rule, so those narrators
// are unjudged, not contested. Null via is not proven 'S', so it stays in.
export async function getContestedNarrators(limit: number): Promise<ContestedNarratorRow[]> {
  const { rows } = await pool.query(
    `SELECT n.narrator_id, n.display_name,
            n.rank_ibn_hajar, ri.ordinal AS ordinal_ibn_hajar,
            n.rank_dhahabi, rd.ordinal AS ordinal_dhahabi
       FROM corpus.narrators n
       JOIN corpus.rank_levels ri ON ri.rank_code = n.rank_ibn_hajar
       JOIN corpus.rank_levels rd ON rd.rank_code = n.rank_dhahabi
      WHERE ri.ordinal <> rd.ordinal
        AND coalesce(n.rank_ibn_hajar_via, 'O') <> 'S'
        AND coalesce(n.rank_dhahabi_via, 'O') <> 'S'
      ORDER BY abs(ri.ordinal - rd.ordinal) DESC, n.narrator_id
      LIMIT $1`,
    [limit],
  );
  return rows;
}

// PRD §5.5 Q3: the narrators two hadiths have in common.
export async function getSharedNarrators(hadithA: number, hadithB: number): Promise<SharedNarratorRow[]> {
  const { rows } = await pool.query(
    `SELECT n.narrator_id, n.display_name
       FROM corpus.isnad_links a
       JOIN corpus.isnad_links b ON b.narrator_id = a.narrator_id
       JOIN corpus.narrators n ON n.narrator_id = a.narrator_id
      WHERE a.hadith_id = $1 AND b.hadith_id = $2
      GROUP BY n.narrator_id, n.display_name
      ORDER BY n.narrator_id`,
    [hadithA, hadithB],
  );
  return rows;
}

// PRD §5.5 Q5: weakest chains first, joined to collection and chapter for
// display. chain_strength is a corpus SQL function, not a view.
export async function getWeakestChains(limit: number): Promise<WeakestChainRow[]> {
  const { rows } = await pool.query(
    `SELECT h.hadith_id, h.hadith_num,
            corpus.chain_strength(h.hadith_id) AS chain_strength,
            c.title_ar AS collection_title, ch.title_ar AS chapter_title
       FROM corpus.hadiths h
       JOIN corpus.collections c ON c.collection_id = h.collection_id
       LEFT JOIN corpus.chapters ch ON ch.chapter_id = h.chapter_id
      ORDER BY corpus.chain_strength(h.hadith_id) ASC NULLS LAST, h.hadith_id
      LIMIT $1`,
    [limit],
  );
  return rows;
}
