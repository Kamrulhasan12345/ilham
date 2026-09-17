import { pool } from '../../db/pool.js';

// PRD §5.12: "Reads corpus.etl_metrics. This is the report's evidence,
// served." "It costs ten lines" -- true here too: no filtering, no paging,
// just the whole table, since this is a small evidentiary table.
export async function getEtlMetrics(): Promise<Record<string, unknown>[]> {
  const { rows } = await pool.query(`SELECT * FROM corpus.etl_metrics ORDER BY metric_name`);
  return rows;
}
