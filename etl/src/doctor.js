import os from 'node:os';
import fs from 'node:fs';
import { CFG, DB, pool, exists, normalizeArabic, log, head } from './config.js';
import { verify } from './verify.js';

// =============================================================================
// DOCTOR — preflight. Every check here corresponds to a failure that is silent
// or misleading if you meet it later instead of now.
// =============================================================================

// The JS normaliser is used for profile's projections; the SQL one does the
// real work behind generated columns and the resolution passes. If they drift,
// profile's numbers become optimistic fiction while the load quietly resolves
// less. These cases cover each transform the function performs.
const PARITY_CASES = [
  '  مُحَمَّدُ   بْنُ  إِسْمَاعِيلَ  ',
  'ثقة.', '، مالك ،', 'ثقة، حافظ', 'صدوق يخطئ.',
  'عَنْ', 'صحابى', 'أبو ٱلحسن', 'abc 123', '',
];

export async function doctor() {
  const problems = [];
  const warn = [];

  head('ENVIRONMENT');
  const freeGb = os.freemem() / 2 ** 30;
  const totalGb = os.totalmem() / 2 ** 30;
  log(`node        ${process.version}`);
  log(`memory      ${freeGb.toFixed(1)}GB free of ${totalGb.toFixed(1)}GB`);
  // extract streams, so this is advisory rather than fatal. It was fatal before
  // json-stream.js existed: a 322MB book parsed whole needs multiple GB.
  if (freeGb < 0.5) warn.push(`only ${freeGb.toFixed(1)}GB free memory`);

  head('SOURCE FILES');
  try {
    await verify({ recordMetrics: false });
  } catch (e) {
    problems.push(e.message);
  }
  log(`books dir   ${CFG.booksDir}`);
  log(`manifest    ${CFG.manifestFile}  ${exists(CFG.manifestFile) ? 'OK' : 'missing (slugs become titles)'}`);
  if (!exists(CFG.manifestFile)) warn.push('no book_manifest.json — collections.title_ar will be the latin slug');
  log(`override    ${CFG.shapeOverride}  ${exists(CFG.shapeOverride) ? 'OK' : 'absent (pure auto-detection)'}`);

  head('DATABASE');
  const p = pool();
  let client;
  try {
    client = await p.connect();
    log(`connected   ${DB.user}@${DB.host}:${DB.port}/${DB.database}`);

    const { rows: [s] } = await client.query(
      `SELECT current_setting('server_encoding') AS enc,
              current_setting('standard_conforming_strings') AS scs,
              current_setting('server_version') AS ver`);
    log(`postgres    ${s.ver}`);
    log(`encoding    ${s.enc}`);
    log(`scs         ${s.scs}`);
    if (s.enc !== 'UTF8') problems.push(`server_encoding is ${s.enc}, must be UTF8`);
    if (s.scs !== 'on') problems.push('standard_conforming_strings must be on');

    const { rows: [sc] } = await client.query(
      `SELECT count(*) FILTER (WHERE nspname='corpus')  AS corpus,
              count(*) FILTER (WHERE nspname='app')     AS app,
              count(*) FILTER (WHERE nspname='staging') AS staging
       FROM pg_namespace`);
    log(`schemas     corpus=${sc.corpus} app=${sc.app} staging=${sc.staging}`);
    if (Number(sc.corpus) === 0) problems.push('corpus schema missing — run db/run_ddl.sh first');
    if (Number(sc.staging) === 0) problems.push('staging schema missing — already sealed? run_ddl.sh rebuilds it');

    // Normaliser parity.
    let drift = 0;
    for (const c of PARITY_CASES) {
      const { rows: [r] } = await client.query('SELECT corpus.normalize_arabic($1) AS v', [c]);
      const js = normalizeArabic(c);
      if (js !== r.v) {
        drift++;
        log(`  PARITY DRIFT ${JSON.stringify(c)}  js=${JSON.stringify(js)}  sql=${JSON.stringify(r.v)}`);
      }
    }
    log(`normaliser  JS/SQL agree on ${PARITY_CASES.length - drift}/${PARITY_CASES.length} cases`);
    if (drift) {
      problems.push(`normalize_arabic has drifted between JS and SQL (${drift} cases) — `
                  + 'fix src/config.js and db/00_init.sql together, then RELOAD the schema: '
                  + 'stored generated columns are not recomputed by CREATE OR REPLACE');
    }

    const { rows: [rl] } = await client.query('SELECT count(*)::int AS n FROM corpus.rank_levels');
    log(`rank_levels ${rl.n} rows`);
    if (!rl.n) problems.push('corpus.rank_levels is empty — 04_seed_reference.sql did not run');
  } catch (e) {
    problems.push(`database: ${e.message.split('\n')[0]}`);
  } finally {
    if (client) client.release();
    await p.end().catch(() => {});
  }

  head('RESULT');
  for (const w of warn) log(`warn   ${w}`);
  for (const pr of problems) log(`FAIL   ${pr}`);
  if (problems.length) {
    throw new Error(`${problems.length} preflight problem(s) — fix before loading`);
  }
  log(warn.length ? `ready (${warn.length} warning(s))` : 'ready');
}
