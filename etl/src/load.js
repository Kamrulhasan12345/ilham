import fs from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { from as copyFrom } from 'pg-copy-streams';
import { CFG, pool, outPath, exists, log, head } from './config.js';

// =============================================================================
// LOAD — CSV -> staging, via COPY.
//
// Load order is FK order within staging: book_manifest before hadiths, hadiths
// before chain_rows and mentions.
//
// Staging types stay STRICT. A strict COPY aborts the whole batch on one
// malformed row, which is the correct failure — but only because `profile`
// runs first and reports type violations before anything is attempted. The fix
// for a bad row is never to loosen the column.
// =============================================================================

const LOADS = [
  { csv: 'book_manifest.csv', table: 'staging.book_manifest',
    cols: ['book_slug','title_ar','title_en'] },
  { csv: 'narrators.csv', table: 'staging.narrators',
    cols: ['narrator_id','display_name','name','kunya','nickname','lineage','relation',
           'tabaqa_raw','school','rank_ibn_hajar_raw','rank_dhahabi_raw','date_of_death'] },
  { csv: 'hadiths.csv', table: 'staging.hadiths',
    cols: ['hadith_id','book_slug','chapter_seq','chapter_ar','hadith_num',
           'text_plain','text_diac','matn_plain','matn_diac','sanad_count','raw_doc'] },
  { csv: 'chain_rows.csv', table: 'staging.chain_rows',
    cols: ['hadith_id','sanad_no','position','raw_name','transmission_word','is_compiler'] },
  { csv: 'mentions.csv', table: 'staging.mentions',
    cols: ['hadith_id','mention_order','surface_plain','surface_diac','narrator_id'] },
  { csv: 'lk_hadiths.csv', table: 'staging.lk_hadiths',
    cols: ['book_slug','hadith_num','text_en','arabic_text','arabic_matn'] },
];

export async function load() {
  const p = pool();
  const client = await p.connect();
  head('LOAD -> staging');
  try {
    // Truncate in reverse dependency order, one statement, one transaction.
    await client.query(`
      TRUNCATE staging.mentions, staging.chain_rows, staging.hadiths,
               staging.narrators, staging.lk_hadiths, staging.book_manifest,
               staging.rejects, staging.name_index, staging.resolution_conflicts
      RESTART IDENTITY CASCADE`);

    for (const l of LOADS) {
      const file = outPath(l.csv);
      if (!exists(file)) { log(`${l.csv}: absent, skipped`); continue; }
      const size = fs.statSync(file).size;
      if (size === 0) { log(`${l.csv}: empty, skipped`); continue; }

      const sql = `COPY ${l.table} (${l.cols.join(',')}) `
                + `FROM STDIN WITH (FORMAT csv, NULL '', QUOTE '"', ESCAPE '"')`;
      const t0 = Date.now();
      await pipeline(fs.createReadStream(file), client.query(copyFrom(sql)));
      const { rows } = await client.query(`SELECT count(*)::int AS n FROM ${l.table}`);
      log(`${l.table.padEnd(26)} ${String(rows[0].n).padStart(9)} rows  ${Date.now() - t0}ms`);
    }

    // Extract-time rejects belong in the same reject ledger as SQL-stage ones,
    // so the report has one place to look.
    const rej = outPath('extract_rejects.csv');
    if (exists(rej) && fs.statSync(rej).size > 0) {
      await pipeline(
        fs.createReadStream(rej),
        client.query(copyFrom(
          `COPY staging.rejects (stage, reason, source_key) `
        + `FROM STDIN WITH (FORMAT csv, NULL '', QUOTE '"', ESCAPE '"')`)));
      const { rows } = await client.query(`SELECT count(*)::int AS n FROM staging.rejects`);
      log(`staging.rejects            ${String(rows[0].n).padStart(9)} rows`);
    }

    await client.query('ANALYZE staging.hadiths');
    await client.query('ANALYZE staging.chain_rows');
    await client.query('ANALYZE staging.mentions');
    await client.query('ANALYZE staging.narrators');
  } finally {
    client.release();
    await p.end();
  }
}

// =============================================================================
// TRANSFORM — run stages 10-19 in order.
//
// Each stage owns its own transaction and truncates its own targets, so any one
// can be rerun alone. They are executed here rather than via psql only so the
// pipeline is one command; running them by hand is equally valid and is what
// you want while iterating on stage 12.
// =============================================================================
const STAGES = ['10_dimensions','11_corpus_load','12_resolve','13_ranks',
                '14_translations','19_reconcile'];

export async function transform({ sqlDir = process.env.ILHAM_SQL_DIR || '../sql',
                                  only = null } = {}) {
  const p = pool();
  const client = await p.connect();
  head('TRANSFORM staging -> corpus');
  try {
    for (const s of (only ? [only] : STAGES)) {
      const file = path.resolve(sqlDir, `${s}.sql`);
      if (!exists(file)) throw new Error(`missing ${file} (set ILHAM_SQL_DIR)`);
      // psql meta-commands are stripped: this runs through the wire protocol,
      // which does not understand \echo or \set.
      const sql = fs.readFileSync(file, 'utf8')
        .split('\n')
        .filter((ln) => !/^\s*\\/.test(ln))
        .join('\n');
      const t0 = Date.now();
      await client.query(sql);
      log(`${s.padEnd(18)} ${Date.now() - t0}ms`);
    }

    const { rows } = await client.query(`
      SELECT metric, value_num FROM corpus.etl_metrics
      WHERE scope IS NULL AND stage IN ('12_resolve','19_reconcile')
      ORDER BY stage, metric`);
    head('KEY METRICS');
    for (const r of rows) log(`${r.metric.padEnd(38)} ${r.value_num}`);
  } finally {
    client.release();
    await p.end();
  }
}
