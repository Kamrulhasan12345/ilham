import fs from 'node:fs';
import path from 'node:path';
import { CFG, CsvFile, readJson, exists, log, head, pct, ensureOut, outPath } from './config.js';
import {
  detectHadithShape, detectNarratorShape, detectMentionShape, detectChainNodeShape,
  collectChainNodes, collectMentions, normalizeChains, nodeToRecord,
  pick, toInt, nullish, reportShape,
} from './shape.js';
import { streamArray } from './json-stream.js';
import { readCsvObjects, lkField, lkNumber } from './csv-read.js';

// =============================================================================
// EXTRACT — JSON -> CSV.
//
// Node's half of the contract: STRUCTURAL flattening only. Nesting becomes rows,
// front matter is filtered, the "N - " prefix is stripped, chapters are
// sequenced, transmission words are aligned. Every SEMANTIC decision —
// dimension extraction, narrator resolution, normalisation, rank mapping — is
// SQL's, in stages 10-19.
//
// The split is not stylistic. Resolution is a join problem against 21K profiles;
// in SQL it is debuggable with plain queries, in JS it is debuggable with
// console.log.
// =============================================================================

const HADITH_COLS = ['hadith_id','book_slug','chapter_seq','chapter_ar','hadith_num',
                     'text_plain','text_diac','matn_plain','matn_diac','sanad_count','raw_doc'];
const CHAIN_COLS  = ['hadith_id','sanad_no','position','raw_name','transmission_word','is_compiler'];
const MENTION_COLS= ['hadith_id','mention_order','surface_plain','surface_diac','narrator_id'];
const NARRATOR_COLS=['narrator_id','display_name','name','kunya','nickname','lineage','relation',
                     'tabaqa_raw','school','rank_ibn_hajar_raw','rank_dhahabi_raw','date_of_death'];
const MANIFEST_COLS=['book_slug','title_ar','title_en'];
const LK_COLS     = ['book_slug','hadith_num','text_en','arabic_text','arabic_matn'];

// LK names its book directories in English; the corpus keys on the Ifta slug.
// An unlisted directory is reported, never guessed at.
const LK_BOOK_SLUG = {
  bukhari: 'sahih-al-bukhari',
  muslim:  'sahih-muslim',
};

const NUM_PREFIX = /^\s*[\d\u0660-\u0669]+\s*[-–—:]\s*/;   // "12 - " and Arabic-Indic digits

// raw_doc defaults OFF. It stores the entire source record in staging, and the
// Ifta records carry takhreej/comparisons/features that no transform reads --
// ~15KB per hadith, so ~200MB of staging text that exists only to be dropped.
// Set ILHAM_KEEP_RAW_DOC=1 when debugging source shape.
const KEEP_RAW_DOC = process.env.ILHAM_KEEP_RAW_DOC === '1';

export async function extract({ keepRawDoc = KEEP_RAW_DOC } = {}) {
  ensureOut();
  const stats = { books: 0, hadiths: 0, chains: 0, mentions: 0,
                  sighas: 0, sighaUnalignable: 0, singleSanad: 0, rejects: [] };

  const bookFiles = listBookFiles();
  if (!bookFiles.length) {
    throw new Error(`no book JSON files under ${CFG.booksDir} — set ILHAM_BOOKS_DIR`);
  }

  head('EXTRACT');
  log(`${bookFiles.length} book files in ${CFG.booksDir}`);

  // --- manifest -------------------------------------------------------------
  const manifest = new CsvFile('book_manifest.csv', MANIFEST_COLS);
  const manifestMap = loadManifest(bookFiles);
  for (const [slug, m] of manifestMap) {
    manifest.write({ book_slug: slug, title_ar: m.title_ar, title_en: m.title_en });
  }

  // --- narrators ------------------------------------------------------------
  const narratorCsv = new CsvFile('narrators.csv', NARRATOR_COLS);
  let narratorShape = null;
  if (exists(CFG.narratorsFile)) {
    const raw = readJson(CFG.narratorsFile);
    const recs = Array.isArray(raw) ? raw : Object.values(raw);
    narratorShape = detectNarratorShape(recs);
    reportShape('narrators', narratorShape);
    const seen = new Set();
    for (const r of recs) {
      const id = toInt(pick(r, narratorShape, 'narratorId'));
      if (id === null) { stats.rejects.push(['narrator', 'no_id', JSON.stringify(r).slice(0,120)]); continue; }
      if (seen.has(id)) { stats.rejects.push(['narrator', 'duplicate_id', String(id)]); continue; }
      seen.add(id);
      const nm = nullish(pick(r, narratorShape, 'name'));
      const dn = nullish(pick(r, narratorShape, 'displayName'));
      // Both NOT NULL downstream; fall back to whichever exists rather than
      // dropping a narrator that only carries one form.
      if (!nm && !dn) { stats.rejects.push(['narrator','no_name',String(id)]); continue; }
      narratorCsv.write({
        narrator_id: id,
        display_name: dn || nm,
        name: nm || dn,
        kunya: nullish(pick(r, narratorShape, 'kunya')),
        nickname: nullish(pick(r, narratorShape, 'nickname')),
        lineage: flatten(pick(r, narratorShape, 'lineage')),
        relation: flatten(pick(r, narratorShape, 'relation')),
        tabaqa_raw: nullish(pick(r, narratorShape, 'tabaqa')),
        school: nullish(pick(r, narratorShape, 'school')),
        rank_ibn_hajar_raw: nullish(pick(r, narratorShape, 'rankIbnHajar')),
        rank_dhahabi_raw: nullish(pick(r, narratorShape, 'rankDhahabi')),
        date_of_death: nullish(pick(r, narratorShape, 'dateOfDeath')),
      });
    }
    log(`narrators: ${narratorCsv.rows} rows`);
  } else {
    log(`WARNING: ${CFG.narratorsFile} not found — narrators.csv will be empty`);
  }

  // --- hadiths / chains / mentions -----------------------------------------
  const hadithCsv  = new CsvFile('hadiths.csv',  HADITH_COLS);
  const chainCsv   = new CsvFile('chain_rows.csv', CHAIN_COLS);
  const mentionCsv = new CsvFile('mentions.csv', MENTION_COLS);

  let hadithShape = null, mentionShape = null, chainShape = null;
  const seenHadith = new Set();

  for (const bf of bookFiles) {
    const slug = path.basename(bf).replace(/\.json$/i, '');

    // Shape is detected once, from a SAMPLE of the first book, then reused.
    // Re-detecting per file would let one oddly-shaped book silently change the
    // field mapping for everything after it.
    //
    // The sample is materialised; the extract pass below is streamed. Reading a
    // 322MB book into memory to look at its first 500 records is what used to
    // put this over the heap ceiling.
    if (!hadithShape) {
      const sample = [...streamArray(bf, { limit: 500 })];
      if (!sample.length) { log(`  skip ${slug}: no records`); continue; }
      hadithShape = detectHadithShape(sample);
      reportShape('hadiths', hadithShape);
      const mo = collectMentions(sample, hadithShape);
      if (mo.length) { mentionShape = detectMentionShape(mo); reportShape('mentions', mentionShape); }
      else log('  WARNING: no mentions found in sample — resolution Pass B will be empty');
      const cn = collectChainNodes(sample, hadithShape);
      if (cn.length) { chainShape = detectChainNodeShape(cn); reportShape('chain nodes', chainShape); }
      else log('  chain nodes are bare strings — transmission words come from the parallel array');
    }

    const chapterSeq = new Map();   // chapter title -> ordinal, per book
    let books = 0;

    for (const rec of streamArray(bf)) {
      const hid = toInt(pick(rec, hadithShape, 'hadithId'));
      if (hid === null) { stats.rejects.push([slug,'no_hadith_id','']); continue; }
      if (seenHadith.has(hid)) { stats.rejects.push([slug,'duplicate_hadith_id',String(hid)]); continue; }

      const numRaw = pick(rec, hadithShape, 'hadithNum');
      const num = numRaw === undefined || numRaw === null ? '' : String(numRaw).trim();
      // Front matter: introductions and book prefaces carry no hadith number.
      // They are not hadiths and must not enter the corpus.
      if (num === '') { stats.rejects.push([slug,'front_matter',String(hid)]); continue; }

      const diac  = nullish(pick(rec, hadithShape, 'textDiac'));
      const plain = nullish(pick(rec, hadithShape, 'textPlain'));
      if (!diac && !plain) { stats.rejects.push([slug,'no_text',String(hid)]); continue; }

      // Chapter sequencing by order of first appearance. This is the only
      // identity the source provides: titles repeat (bare باب is everywhere),
      // so keying chapters on the title collapses distinct ones into one.
      const chTitle = nullish(pick(rec, hadithShape, 'chapter')) || '(بدون باب)';
      if (!chapterSeq.has(chTitle)) chapterSeq.set(chTitle, chapterSeq.size + 1);

      const chains = normalizeChains(pick(rec, hadithShape, 'chains'));
      const sanadCount = Math.max(1, chains.length);
      if (chains.length === 1) stats.singleSanad++;

      seenHadith.add(hid);
      hadithCsv.write({
        hadith_id: hid,
        book_slug: slug,
        chapter_seq: chapterSeq.get(chTitle),
        chapter_ar: chTitle,
        hadith_num: num,
        text_plain: stripPrefix(plain || diac),
        text_diac:  stripPrefix(diac || plain),
        matn_plain: stripPrefix(nullish(pick(rec, hadithShape, 'matnPlain'))),
        matn_diac:  stripPrefix(nullish(pick(rec, hadithShape, 'matnDiac'))),
        sanad_count: sanadCount,
        raw_doc: keepRawDoc ? JSON.stringify(rec) : null,
      });
      stats.hadiths++;

      // --- chain rows ------------------------------------------------------
      // NOT a reject: the hadith loads in full, it just carries no sigha. The
      // reject ledger is a row-loss ledger used for count reconciliation, and
      // putting a missing optional field in it would make the two disagree.
      const sighas = alignTransmission(rec, hadithShape, chains);
      if (chains.length === 1 && !sighas) stats.sighaUnalignable++;

      for (const s of chains) {
        const nodes = s.nodes.map((n) => nodeToRecord(n, chainShape || { map: {} }))
                             .filter((n) => n && n.name);
        nodes.forEach((n, i) => {
          chainCsv.write({
            hadith_id: hid,
            sanad_no: s.sanadNo,
            position: i + 1,
            raw_name: n.name,
            // Trusted when the node carries its own; otherwise from the parallel
            // narration_words array, but ONLY where the alignment is provable
            // (see alignTransmission). NULL rather than a guess: a wrong sigha
            // silently changes chain_strength via the an'ana penalty, and a
            // wrong score is worse than a missing one.
            transmission_word: n.transmission ?? sighas?.[i + 1] ?? null,
            is_compiler: i === nodes.length - 1,
          });
          if (n.transmission ?? sighas?.[i + 1]) stats.sighas++;
          stats.chains++;
        });
      }

      // --- mentions (Pass B input only; never loaded into corpus) ----------
      const ms = pick(rec, hadithShape, 'mentions');
      if (Array.isArray(ms) && mentionShape) {
        let order = 0;
        for (const m of ms) {
          if (!m || typeof m !== 'object') continue;
          const nid = toInt(pick(m, mentionShape, 'narratorId'));
          if (nid === null) continue;
          order++;
          const sp = nullish(pick(m, mentionShape, 'plain'));
          const sd = nullish(pick(m, mentionShape, 'diac'));
          mentionCsv.write({
            hadith_id: hid,
            mention_order: order,
            surface_plain: sp || sd || '',
            surface_diac:  sd || sp || '',
            narrator_id: nid,
          });
          stats.mentions++;
        }
      }
      books++;
    }
    stats.books++;
    log(`${slug}: ${books} hadiths`);
  }

  // --- optional LK translations --------------------------------------------
  //
  // LK-Hadith-Corpus ships one CSV per chapter, in a directory per book:
  //   raw/lk-translations/bukhari/Chapter1.csv ... muslim/Chapter57.csv
  // The book is the DIRECTORY name, not the file name, so this walks one level
  // down and maps the directory to a collection slug.
  //
  // arabic_text is carried through because it is the join key. LK's
  // Hadith_number is NOT a join key — see the comment on staging.lk_hadiths.
  // It is still emitted so stage 14 can report how far the two numberings
  // disagree, which is the evidence for not using it.
  const lkCsv = new CsvFile('lk_hadiths.csv', LK_COLS);
  if (exists(CFG.lkDir)) {
    for (const dir of fs.readdirSync(CFG.lkDir)) {
      const bookDir = path.join(CFG.lkDir, dir);
      if (!fs.statSync(bookDir).isDirectory()) continue;
      const slug = LK_BOOK_SLUG[dir.toLowerCase()];
      if (!slug) { stats.rejects.push(['lk', 'unknown_book_dir', dir]); continue; }

      let kept = 0, skipped = 0;
      const files = fs.readdirSync(bookDir).filter((f) => /\.csv$/i.test(f))
        .sort((a, b) => (parseInt(a.replace(/\D/g, ''), 10) || 0)
                      - (parseInt(b.replace(/\D/g, ''), 10) || 0));
      for (const f of files) {
        try {
          const { records } = readCsvObjects(path.join(bookDir, f));
          for (const r of records) {
            const en = lkField(r.English_Hadith);
            const ar = lkField(r.Arabic_Hadith);
            // Both are required: without English there is nothing to store,
            // without Arabic there is no way to attach it to a hadith.
            if (!en || !ar) { skipped++; stats.rejects.push(['lk', !en ? 'no_english' : 'no_arabic', `${dir}/${f}`]); continue; }
            lkCsv.write({ book_slug: slug, hadith_num: lkNumber(r.Hadith_number),
                          text_en: en, arabic_text: ar,
                          arabic_matn: lkField(r.Arabic_Matn) });
            kept++;
          }
        } catch (e) {
          // A file that fails to parse silently lowers coverage, so it goes in
          // the reject ledger and not only to the log.
          log(`  LK ${dir}/${f}: ${e.message}`);
          stats.rejects.push(['lk', 'csv_unreadable', `${dir}/${f}`]);
        }
      }
      log(`  LK ${dir} -> ${slug}: ${kept} rows from ${files.length} files` +
          (skipped ? ` (${skipped} skipped)` : ''));
    }
    log(`LK translations: ${lkCsv.rows} rows`);
  } else {
    log(`LK directory absent (${CFG.lkDir}) — translations skipped (stage 14 is a no-op)`);
  }

  // --- rejects --------------------------------------------------------------
  const rejCsv = new CsvFile('extract_rejects.csv', ['stage','reason','source_key']);
  for (const [s, r, k] of stats.rejects) rejCsv.write({ stage: 'extract:' + s, reason: r, source_key: k });

  const out = [];
  for (const c of [manifest, narratorCsv, hadithCsv, chainCsv, mentionCsv, lkCsv, rejCsv]) {
    out.push(await c.close());
  }

  head('EXTRACT SUMMARY');
  for (const f of out) log(`${f.name.padEnd(22)} ${String(f.rows).padStart(9)} rows`);
  log(`rejected: ${stats.rejects.length} (${pct(stats.rejects.length, stats.hadiths + stats.rejects.length)}%)`);
  // If this reads 0 the an'ana penalty is dead corpus-wide and chain_strength
  // is quietly missing a term it claims to have. Loud, not buried in a metric.
  const alignable = stats.singleSanad - stats.sighaUnalignable;
  log(`sighas: ${stats.sighas} words on ${stats.chains} chain rows (${pct(stats.sighas, stats.chains)}%)`);
  log(`  aligned ${alignable}/${stats.singleSanad} single-sanad hadiths (${pct(alignable, stats.singleSanad)}%); `
    + `${stats.sighaUnalignable} length-mismatched, ${stats.hadiths - stats.singleSanad} multi-sanad (both left NULL)`);
  if (stats.sighas === 0) log('  *** WARNING: no sighas aligned — chain_strength an\'ana penalty will never fire');

  fs.writeFileSync(outPath('extract_report.json'),
    JSON.stringify({ files: out, rejects: stats.rejects.length,
                     shapes: { hadith: hadithShape, narrator: narratorShape,
                               mention: mentionShape, chain: chainShape } }, null, 2));
  return out;
}

// -----------------------------------------------------------------------------
function listBookFiles() {
  if (!exists(CFG.booksDir)) return [];
  return fs.readdirSync(CFG.booksDir)
    .filter((f) => /\.json$/i.test(f))
    .filter((f) => !/manifest|narrator/i.test(f))
    .sort()
    .map((f) => path.join(CFG.booksDir, f));
}

function loadManifest(bookFiles) {
  const m = new Map();
  if (exists(CFG.manifestFile)) {
    const raw = readJson(CFG.manifestFile);
    // Underscore keys are documentation (_comment), not book entries.
    const entries = Array.isArray(raw) ? raw : Object.entries(raw)
      .filter(([k]) => !k.startsWith('_'))
      .map(([k, v]) => (typeof v === 'string' ? { slug: k, title_ar: v } : { slug: k, ...v }));
    for (const e of entries) {
      const slug = e.slug || e.book_slug || e.id;
      if (!slug) continue;
      m.set(String(slug), {
        title_ar: e.title_ar || e.titleAr || e.arabic || e.name || String(slug),
        title_en: e.title_en || e.titleEn || e.english || null,
      });
    }
  }
  // Any book file without a manifest entry still needs a collection row, or
  // stage 10's FK drops every hadith in it.
  for (const bf of bookFiles) {
    const slug = path.basename(bf).replace(/\.json$/i, '');
    if (!m.has(slug)) m.set(slug, { title_ar: slug, title_en: null });
  }
  return m;
}

// =============================================================================
// TRANSMISSION-WORD ALIGNMENT
//
// The Ifta chain nodes are bare name strings and carry no sigha, so without
// this every isnad_links.transmission_word is NULL, transmission_norm is NULL,
// and chain_strength's -0.05 an'ana penalty never fires on any hadith in the
// corpus. The signal is real -- ~42% of links are 'عن' -- and silently dead.
//
// The sighas live in a PARALLEL array, `narration_words`, which is:
//   * one entry per EDGE, so length = chain length - 1
//   * in TEXT order, i.e. reversed relative to the chain
//
// Arabic isnad prose runs compiler-inward ("X told us, from Y, from Z"), while
// chain_of_narrators runs in propagation order (Companion first). Worked
// example, Bukhari #1:
//
//   chain:  [عمر, علقمة, محمد, يحيى, سفيان, الحميدي, البخاري]   (7)
//   words:  [حدثنا, حدثنا, حدثنا, أخبرني, أنه سمع, سمعت]          (6)
//
//   words[0] = حدثنا  is the البخاري <- الحميدي edge, i.e. positions 7<-6
//   words[5] = سمعت   is the علقمة  <- عمر     edge, i.e. positions 2<-1
//
// so the word landing on position q (the RECEIVER, matching isnad_edges, which
// reads b.transmission_word) is words[len - q]. Position 1 -- the Companion --
// receives from nobody and correctly gets nothing.
//
// Applied ONLY when unambiguous:
//   * single-sanad hadiths only. With several sanads narration_words is one
//     flat list with no marker for where one chain ends, so which word belongs
//     to which chain is unrecoverable.
//   * lengths must agree EXACTLY. A mismatch means the two structures do not
//     describe the same edges, and an off-by-one produces plausible-looking
//     wrong sighas along the entire chain rather than an obvious failure.
//
// Coverage on the real data: Bukhari 5,859/6,447 single-sanad (91%),
// Muslim 3,525/4,201 (84%). The remainder is left NULL and counted.
//
// Returns a position -> sigha map (1-based), or null when not alignable.
// =============================================================================
export function alignTransmission(rec, hadithShape, chains) {
  if (chains.length !== 1) return null;
  const words = rec?.[hadithShape.map.narrationWords ?? 'narration_words'];
  if (!Array.isArray(words) || !words.length) return null;

  const len = chains[0].nodes.length;
  if (words.length !== len - 1) return null;

  const out = {};
  for (let q = 2; q <= len; q++) {
    const w = words[len - q];
    // Entries are [plain, diacritised]; take the plain form. corpus stores the
    // raw word and derives transmission_norm from it in SQL.
    const val = Array.isArray(w) ? w[0] : w;
    const s = nullish(val);
    if (s) out[q] = s;
  }
  return Object.keys(out).length ? out : null;
}

const stripPrefix = (s) => (s === null || s === undefined ? null : String(s).replace(NUM_PREFIX, '').trim() || null);

const flatten = (v) => {
  if (v === null || v === undefined) return null;
  if (Array.isArray(v)) return v.filter(Boolean).map(String).join(' | ') || null;
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v).trim() || null;
};
