import { pool } from '../../db/pool.js';

export async function getEtlMetrics(): Promise<Record<string, unknown>[]> {
  const { rows } = await pool.query(`SELECT * FROM corpus.etl_metrics ORDER BY stage, metric`);
  return rows;
}
