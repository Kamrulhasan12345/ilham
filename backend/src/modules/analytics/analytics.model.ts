import { pool } from '../../db/pool.js';
import type {
  ContestedNarratorRow,
  SharedNarratorRow,
  TopNarratorRow,
  WeakestChainRow,
} from './analytics.interface.js';

// PRD §5.5 Q1: corpus.v_top_narrators. "Count of chain positions per
// narrator. Exclude is_compiler and is_placeholder" -- that exclusion is
// baked into the view itself (db/06_queries.sql), not repeated here.
export async function getTopNarrators(limit: number): Promise<TopNarratorRow[]> {
  const { rows } = await pool.query(`SELECT * FROM corpus.v_top_narrators LIMIT $1`, [limit]);
  return rows;
}

// PRD §5.5 Q2: corpus.v_contested_narrators. "Exclude rank_*_via = 'S'" is
// also baked into the view definition, per the PRD's note on the Companion
// tabaqa pass.
export async function getContestedNarrators(limit: number): Promise<ContestedNarratorRow[]> {
  const { rows } = await pool.query(`SELECT * FROM corpus.v_contested_narrators LIMIT $1`, [limit]);
  return rows;
}

// PRD §5.5 Q3: corpus.shared_narrators(a, b) -- a SQL FUNCTION, not a view,
// because a view cannot take a parameter and the self-join isn't
// materializable at 139k links.
export async function getSharedNarrators(hadithA: number, hadithB: number): Promise<SharedNarratorRow[]> {
  const { rows } = await pool.query(`SELECT * FROM corpus.shared_narrators($1, $2)`, [hadithA, hadithB]);
  return rows;
}

// PRD §5.5 Q5: corpus.v_weakest_chains, ordered by chain_strength, joined to
// collection/chapter for display -- again, the join lives in the view.
export async function getWeakestChains(limit: number): Promise<WeakestChainRow[]> {
  const { rows } = await pool.query(`SELECT * FROM corpus.v_weakest_chains LIMIT $1`, [limit]);
  return rows;
}
