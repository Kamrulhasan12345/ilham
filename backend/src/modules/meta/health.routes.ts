import { Router } from 'express';
import { pool } from '../../db/pool.js';

export const healthRoutes = Router();

// PRD §5.12: "Database reachable, and the corpus row counts." No guard --
// mounted directly in app.ts before requireAuth is ever applied.
healthRoutes.get('/', async (_req, res) => {
  try {
    const { rows } = await pool.query<{ hadith_count: string; narrator_count: string }>(
      `SELECT
         (SELECT count(*) FROM corpus.hadiths) AS hadith_count,
         (SELECT count(*) FROM corpus.narrators) AS narrator_count`,
    );
    res.json({
      data: {
        status: 'ok',
        corpus: {
          hadiths: Number(rows[0].hadith_count),
          narrators: Number(rows[0].narrator_count),
        },
      },
    });
  } catch (e) {
    res.status(500).json({ error: { code: 'internal_error', message: 'database unreachable' } });
  }
});
