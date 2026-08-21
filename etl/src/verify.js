import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { CFG, DB, pool, exists, readJson, log, head } from './config.js';

// =============================================================================
// VERIFY — the raw files are what the load was built against.
//
// The source data is 710MB and cannot live in git, so the repository alone does
// not pin what a load consumed. Without this, "my teammate reproduced my
// corpus" is a hope; with it, it is a checkable claim.
//
// The hashes are also written into corpus.etl_metrics, which deliberately
// survives DROP SCHEMA staging. After 05_post_load.sql seals the corpus, that
// row is the only remaining evidence of which bytes produced it.
// =============================================================================

const MANIFEST = process.env.ILHAM_SOURCES || './sources.json';

function sha256(file) {
  const h = crypto.createHash('sha256');
  const fd = fs.openSync(file, 'r');
  const buf = Buffer.allocUnsafe(1 << 22);
  try {
    for (;;) {
      const n = fs.readSync(fd, buf, 0, buf.length, null);
      if (n <= 0) break;
      h.update(buf.subarray(0, n));
    }
  } finally { fs.closeSync(fd); }
  return h.digest('hex');
}

/**
 * @param {{recordMetrics?: boolean}} opts
 * @returns {Promise<{ok: boolean, results: object[]}>}
 */
export async function verify({ recordMetrics = true } = {}) {
  head('VERIFY SOURCES');
  if (!exists(MANIFEST)) throw new Error(`missing ${MANIFEST}`);
  const man = readJson(MANIFEST);
  const results = [];
  let bad = 0;

  for (const f of man.files || []) {
    const p = path.join(CFG.booksDir, f.name);
    const alt = path.resolve(path.dirname(CFG.narratorsFile), f.name);
    const file = exists(p) ? p : (exists(alt) ? alt : null);

    if (!file) {
      log(`MISSING  ${f.name}`);
      if (f.required !== false) bad++;
      results.push({ name: f.name, status: 'missing' });
      continue;
    }
    const bytes = fs.statSync(file).size;
    const got = sha256(file);
    const okSize = !f.bytes || bytes === f.bytes;
    const okHash = !f.sha256 || got === f.sha256;

    if (okHash && okSize) {
      log(`ok       ${f.name.padEnd(26)} ${(bytes / 1048576).toFixed(1)}MB  ${got.slice(0, 12)}…`);
      results.push({ name: f.name, status: 'ok', sha256: got, bytes });
    } else {
      bad++;
      log(`DRIFT    ${f.name}`);
      if (!okSize) log(`           size     expected ${f.bytes}  got ${bytes}`);
      if (!okHash) {
        log(`           sha256   expected ${f.sha256}`);
        log(`                    got      ${got}`);
      }
      results.push({ name: f.name, status: 'drift', sha256: got, bytes });
    }
  }

  if (bad) {
    log('');
    log(`${bad} file(s) missing or altered. The load would not be reproducible —`);
    log(`re-download from: ${man.dataset?.url ?? '(url not set in sources.json)'}`);
    const e = new Error(`source verification failed for ${bad} file(s)`);
    e.verified = false;
    throw e;
  }

  if (recordMetrics) await recordProvenance(results, man);
  log(`all ${results.length} source files verified`);
  return { ok: true, results };
}

// Snapshot into corpus.etl_metrics. Best-effort: verify must still be usable
// before the schema exists (e.g. from doctor, or on a fresh checkout).
async function recordProvenance(results, man) {
  const p = pool();
  let client;
  try {
    client = await p.connect();
    await client.query(`DELETE FROM corpus.etl_metrics WHERE stage = '00_source'`);
    for (const r of results) {
      await client.query(
        `INSERT INTO corpus.etl_metrics (stage, metric, scope, value_num, value_text)
         VALUES ('00_source', 'sha256', $1, $2, $3)`,
        [r.name, r.bytes, r.sha256]);
    }
    await client.query(
      `INSERT INTO corpus.etl_metrics (stage, metric, scope, value_text)
       VALUES ('00_source', 'dataset_url', NULL, $1)`,
      [man.dataset?.url ?? null]);
    log(`provenance recorded in corpus.etl_metrics (${results.length} hashes)`);
  } catch (e) {
    log(`(provenance not recorded: ${e.message.split('\n')[0]})`);
  } finally {
    if (client) client.release();
    await p.end().catch(() => {});
  }
}

export { sha256, MANIFEST, DB };
