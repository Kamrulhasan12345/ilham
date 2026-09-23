import { pool } from '../../db/pool.js';
import type {
  ContestedNarratorRow,
  SharedNarratorRow,
  TopNarratorRow,
  WeakestChainRow,
} from './analytics.interface.js';

export async function getTopNarrators(limit: number): Promise<TopNarratorRow[]> {
  const { rows } = await pool.query(`SELECT * FROM corpus.v_top_narrators LIMIT $1`, [limit]);
  return rows;
}

export async function getContestedNarrators(limit: number): Promise<ContestedNarratorRow[]> {
  const { rows } = await pool.query(`SELECT * FROM corpus.v_contested_narrators LIMIT $1`, [limit]);
  return rows;
}

export async function getSharedNarrators(hadithA: number, hadithB: number): Promise<SharedNarratorRow[]> {
  const { rows } = await pool.query(`SELECT * FROM corpus.shared_narrators($1, $2)`, [hadithA, hadithB]);
  return rows;
}

export async function getWeakestChains(limit: number): Promise<WeakestChainRow[]> {
  const { rows } = await pool.query(`SELECT * FROM corpus.v_weakest_chains LIMIT $1`, [limit]);
  return rows;
}
