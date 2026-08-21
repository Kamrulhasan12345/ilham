import 'dotenv/config';
import path from 'node:path';
import fs from 'node:fs';
import pg from 'pg';

// -----------------------------------------------------------------------------
// Paths. Override any of these in .env; the defaults assume the layout in
// README.md. Nothing here creates directories except OUT_DIR.
// -----------------------------------------------------------------------------
export const CFG = {
  // Ifta Kaggle dump: one JSON file per book, plus the two index files.
  booksDir:      process.env.ILHAM_BOOKS_DIR      || './data/ifta/books',
  narratorsFile: process.env.ILHAM_NARRATORS_FILE || './data/ifta/ifta_narrators.json',
  manifestFile:  process.env.ILHAM_MANIFEST_FILE  || './data/ifta/book_manifest.json',
  // Optional feeders. Missing files are skipped, not fatal.
  lkDir:         process.env.ILHAM_LK_DIR         || './raw/lk-translations',
  misFile:       process.env.ILHAM_MIS_FILE       || './data/mis/mis_narrators.json',
  outDir:        process.env.ILHAM_OUT_DIR        || './build',
  shapeOverride: process.env.ILHAM_SHAPE_OVERRIDE || './shape.override.json',
};

export const DB = {
  host:     process.env.PGHOST     || 'localhost',
  port:     Number(process.env.PGPORT || 5432),
  database: process.env.PGDATABASE || 'ilham',
  user:     process.env.PGUSER     || process.env.USER,
  password: process.env.PGPASSWORD,
};

export function pool() {
  return new pg.Pool({ ...DB, max: 4 });
}

export function ensureOut() {
  fs.mkdirSync(CFG.outDir, { recursive: true });
  return CFG.outDir;
}

export const outPath = (name) => path.join(CFG.outDir, name);

// -----------------------------------------------------------------------------
// normalize_arabic, JS side.
//
// This MUST stay in lockstep with corpus.normalize_arabic in 00_init.sql. It is
// used only for preflight estimates — the authoritative normalisation happens
// in SQL, where the generated columns and the resolution passes live. If the
// two ever drift, the profile numbers become optimistic fiction while the
// actual load quietly resolves less. `node src/run.js profile` cross-checks
// them against the live database and refuses to continue on a mismatch.
// -----------------------------------------------------------------------------
const COMBINING = /[\u064B-\u065F\u0670\u0640]/g;
const CARRIER = { 'أ':'ا','إ':'ا','آ':'ا','ٱ':'ا','ة':'ه','ى':'ي','ؤ':'و','ئ':'ي' };

// Edge punctuation only. Interior punctuation must SURVIVE: it separates the
// clauses of the compound rijal verdicts that 13_ranks.sql pass 2 tokenises.
const EDGE_PUNCT = /^[.,،؛:]+|[.,،؛:]+$/g;

export function normalizeArabic(s) {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(COMBINING, '')
    .replace(/\s+/g, ' ')
    .replace(/[أإآٱةىؤئ]/g, (c) => CARRIER[c])
    .trim()
    .replace(EDGE_PUNCT, '')
    .trim();
}

// -----------------------------------------------------------------------------
// CSV writer. Postgres COPY ... WITH (FORMAT csv) dialect: RFC4180 quoting,
// \N for NULL. Hand-rolled rather than pulled from npm — the escaping rules are
// four lines and a dependency here would be the only thing standing between the
// corpus and a mangled Arabic string.
// -----------------------------------------------------------------------------
export function csvCell(v) {
  if (v === null || v === undefined) return '';           // empty -> NULL via FORCE_NULL
  const s = String(v);
  if (s === '') return '""';                              // explicit empty string
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

export function csvRow(cells) {
  return cells.map(csvCell).join(',') + '\n';
}

export class CsvFile {
  constructor(name, columns) {
    ensureOut();
    this.name = name;
    this.columns = columns;
    this.path = outPath(name);
    this.stream = fs.createWriteStream(this.path, { encoding: 'utf8' });
    this.rows = 0;
  }
  write(obj) {
    this.stream.write(csvRow(this.columns.map((c) => obj[c])));
    this.rows++;
  }
  async close() {
    await new Promise((res, rej) => {
      this.stream.end((err) => (err ? rej(err) : res()));
    });
    return { name: this.name, path: this.path, rows: this.rows };
  }
}

// -----------------------------------------------------------------------------
// Small helpers
// -----------------------------------------------------------------------------
export const exists = (p) => { try { fs.accessSync(p); return true; } catch { return false; } };

export function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

export function log(...a)  { console.log('  ', ...a); }
export function head(t)    { console.log('\n' + t); console.log('-'.repeat(t.length)); }
export function pct(a, b)  { return b ? ((100 * a) / b).toFixed(2) : '0.00'; }
