import fs from 'node:fs';
import path from 'node:path';
import { CFG, readJson, exists, log, head, pct, normalizeArabic, pool, outPath, ensureOut } from './config.js';
import { alignTransmission } from './extract.js';
import {
  detectHadithShape, detectNarratorShape, detectMentionShape, detectChainNodeShape,
  collectChainNodes, collectMentions, normalizeChains, nodeToRecord,
  pick, toInt, nullish, reportShape,
} from './shape.js';

// =============================================================================
// PROFILE — run this FIRST, before extract.
//
// Two jobs. It reports the source's actual shape so a wrong field guess shows
// up as a printed line rather than a column of NULLs. And it answers, from the
// data, the three questions that otherwise have to be guessed at:
//
//   1. Do chain strings match narrators.name or narrators.display_name?
//      Decides which surface leads in resolution Pass A. Guessing wrong costs
//      a large slice of the hit rate.
//   2. What share of hadiths are single-sanad?
//      Pass B only applies to those. High share = a real second method; low
//      share = a footnote, and Pass A's ambiguity handling carries everything.
//   3. How many chains lack a compiler-flagged final position?
//      Pass B derives chain length from that flag. Unflagged chains shift the
//      whole alignment by one and produce plausible-looking wrong narrators.
//
// Nothing is written to the database. Safe to run repeatedly.
// =============================================================================

const SAMPLE_BOOKS = Number(process.env.ILHAM_PROFILE_BOOKS || 6);

export async function profile() {
  ensureOut();
  const report = { generatedAt: new Date().toISOString() };

  head('SOURCE FILES');
  const bookFiles = exists(CFG.booksDir)
    ? fs.readdirSync(CFG.booksDir).filter((f) => /\.json$/i.test(f))
        .filter((f) => !/manifest|narrator/i.test(f)).sort()
    : [];
  log(`books dir      ${CFG.booksDir}  (${bookFiles.length} files)`);
  log(`narrators      ${CFG.narratorsFile}  ${exists(CFG.narratorsFile) ? 'OK' : 'MISSING'}`);
  log(`manifest       ${CFG.manifestFile}  ${exists(CFG.manifestFile) ? 'OK' : 'missing (slugs will be used as titles)'}`);
  log(`LK dir         ${CFG.lkDir}  ${exists(CFG.lkDir) ? 'OK' : 'absent (translations skipped)'}`);
  if (!bookFiles.length) throw new Error(`no book JSON under ${CFG.booksDir} — set ILHAM_BOOKS_DIR in .env`);

  // --- narrators ------------------------------------------------------------
  head('NARRATOR PROFILES');
  let narrators = [], nShape = null;
  const nameIdx = new Map(), displayIdx = new Map();
  if (exists(CFG.narratorsFile)) {
    const raw = readJson(CFG.narratorsFile);
    narrators = Array.isArray(raw) ? raw : Object.values(raw);
    nShape = detectNarratorShape(narrators);
    reportShape('detected', nShape);
    log(`${narrators.length} profiles`);

    let placeholders = 0, gradedIH = 0, gradedDh = 0;
    for (const n of narrators) {
      const nm = nullish(pick(n, nShape, 'name'));
      const dn = nullish(pick(n, nShape, 'displayName'));
      if ((nm && /^\[.*\]$/.test(nm)) || (dn && /^\[.*\]$/.test(dn))) placeholders++;
      if (nullish(pick(n, nShape, 'rankIbnHajar'))) gradedIH++;
      if (nullish(pick(n, nShape, 'rankDhahabi')))  gradedDh++;
      const id = toInt(pick(n, nShape, 'narratorId'));
      if (id === null) continue;
      if (nm) bump(nameIdx, normalizeArabic(nm), id);
      if (dn) bump(displayIdx, normalizeArabic(dn), id);
    }
    log(`placeholders (bracketed)  ${placeholders} (${pct(placeholders, narrators.length)}%)`);
    log(`graded by Ibn Hajar       ${gradedIH} (${pct(gradedIH, narrators.length)}%)`);
    log(`graded by al-Dhahabi      ${gradedDh} (${pct(gradedDh, narrators.length)}%)`);

    // AMBIGUITY — the number that decides whether Pass A can be trusted at all.
    const ambName = [...nameIdx.values()].filter((s) => s.size > 1).length;
    const ambDisp = [...displayIdx.values()].filter((s) => s.size > 1).length;
    log(`distinct normalised names ${nameIdx.size}  (${ambName} shared by >1 narrator)`);
    log(`distinct normalised displays ${displayIdx.size}  (${ambDisp} shared by >1)`);
    report.narrators = { total: narrators.length, placeholders, gradedIH, gradedDh,
                         distinctNames: nameIdx.size, ambiguousNames: ambName,
                         distinctDisplays: displayIdx.size, ambiguousDisplays: ambDisp };
  }

  // --- hadith sample --------------------------------------------------------
  head(`HADITH SAMPLE (${Math.min(SAMPLE_BOOKS, bookFiles.length)} books)`);
  const sample = [];
  for (const f of bookFiles.slice(0, SAMPLE_BOOKS)) {
    const raw = readJson(path.join(CFG.booksDir, f));
    const recs = Array.isArray(raw) ? raw : (raw.hadiths || raw.data || Object.values(raw));
    if (Array.isArray(recs)) sample.push(...recs.slice(0, 3000));
  }
  const hShape = detectHadithShape(sample);
  reportShape('detected', hShape);
  const mObjs = collectMentions(sample, hShape);
  const mShape = mObjs.length ? detectMentionShape(mObjs) : null;
  if (mShape) reportShape('mentions', mShape);
  const cObjs = collectChainNodes(sample, hShape);
  const cShape = cObjs.length ? detectChainNodeShape(cObjs) : null;
  if (cShape) reportShape('chain nodes', cShape);
  else log('chain nodes appear to be bare strings (no per-node fields)');

  // =========================================================================
  // Q1 — does raw_name match name or display_name?
  // =========================================================================
  head('Q1  CHAIN NAME SURFACE');
  let tried = 0, hitName = 0, hitDisplay = 0, hitBoth = 0, hitNeither = 0,
      ambigName = 0, ambigDisplay = 0;
  for (const rec of sample) {
    for (const s of normalizeChains(pick(rec, hShape, 'chains'))) {
      const nodes = s.nodes.map((n) => nodeToRecord(n, cShape || { map: {} })).filter((n) => n?.name);
      for (let i = 0; i < nodes.length - 1; i++) {          // skip compiler
        const k = normalizeArabic(nodes[i].name);
        if (!k) continue;
        tried++;
        const a = nameIdx.get(k), b = displayIdx.get(k);
        if (a) { hitName++;    if (a.size > 1) ambigName++; }
        if (b) { hitDisplay++; if (b.size > 1) ambigDisplay++; }
        if (a && b) hitBoth++;
        if (!a && !b) hitNeither++;
      }
    }
  }
  log(`chain positions tested        ${tried}`);
  log(`matched narrators.name        ${hitName} (${pct(hitName, tried)}%)  of which ambiguous ${ambigName}`);
  log(`matched narrators.display     ${hitDisplay} (${pct(hitDisplay, tried)}%)  of which ambiguous ${ambigDisplay}`);
  log(`matched both                  ${hitBoth}`);
  log(`matched neither               ${hitNeither} (${pct(hitNeither, tried)}%)`);
  const lead = hitDisplay > hitName ? 'display_name' : 'name';
  log(`>> lead surface for Pass A: ${lead}`);
  log(`>> projected UNIQUE-match rate: ${pct(Math.max(hitName - ambigName, hitDisplay - ambigDisplay), tried)}%`);
  report.q1 = { tried, hitName, hitDisplay, hitBoth, hitNeither, ambigName, ambigDisplay, lead };

  // =========================================================================
  // Q2 — single-sanad share (Pass B's entire reach)
  // =========================================================================
  head('Q2  SANAD COUNT DISTRIBUTION');
  const dist = new Map();
  for (const rec of sample) {
    const n = Math.max(1, normalizeChains(pick(rec, hShape, 'chains')).length);
    dist.set(n, (dist.get(n) || 0) + 1);
  }
  const total = sample.length;
  for (const k of [...dist.keys()].sort((a, b) => a - b).slice(0, 8)) {
    log(`${String(k).padStart(3)} sanad(s)  ${String(dist.get(k)).padStart(7)}  ${pct(dist.get(k), total)}%`);
  }
  const single = dist.get(1) || 0;
  log(`>> Pass B applies to ${pct(single, total)}% of hadiths`);
  report.q2 = { total, single, pctSingle: Number(pct(single, total)),
                distribution: Object.fromEntries(dist) };

  // =========================================================================
  // Q3 — compiler flag reliability, and mention/chain length agreement
  // =========================================================================
  head('Q3  CHAIN STRUCTURE');
  let chains = 0, lenMismatch = 0, singleWithMentions = 0, zipUsable = 0, emptyChains = 0;
  for (const rec of sample) {
    const cs = normalizeChains(pick(rec, hShape, 'chains'));
    if (!cs.length) { emptyChains++; continue; }
    chains += cs.length;
    if (cs.length !== 1) continue;
    const nodes = cs[0].nodes.map((n) => nodeToRecord(n, cShape || { map: {} })).filter((n) => n?.name);
    const chainLen = Math.max(0, nodes.length - 1);          // minus compiler
    const ms = pick(rec, hShape, 'mentions');
    if (!Array.isArray(ms) || !ms.length) continue;
    singleWithMentions++;
    const nMent = mShape ? ms.filter((m) => toInt(pick(m, mShape, 'narratorId')) !== null).length : ms.length;
    if (nMent === chainLen) zipUsable++; else lenMismatch++;
  }
  log(`hadiths with no chain at all   ${emptyChains} (${pct(emptyChains, total)}%)`);
  log(`total sanads                   ${chains}`);
  log(`single-sanad w/ mentions       ${singleWithMentions}`);
  log(`  chain_len == mention count   ${zipUsable} (${pct(zipUsable, singleWithMentions)}%)  <- Pass B usable`);
  log(`  length mismatch              ${lenMismatch} (${pct(lenMismatch, singleWithMentions)}%)  <- Pass B skips these`);
  log('note: compiler is flagged as the LAST chain position by the extractor,');
  log('      so it is reliable by construction. Stage 11 re-checks it in SQL.');
  report.q3 = { emptyChains, chains, singleWithMentions, zipUsable, lenMismatch };

  // --- data quality --------------------------------------------------------
  head('DATA QUALITY');
  let frontMatter = 0, noText = 0, noNum = 0, matnPresent = 0, prefixed = 0;
  const chapterTitles = new Map();
  for (const rec of sample) {
    const num = nullish(pick(rec, hShape, 'hadithNum'));
    if (!num) { frontMatter++; noNum++; }
    const t = nullish(pick(rec, hShape, 'textDiac')) || nullish(pick(rec, hShape, 'textPlain'));
    if (!t) noText++;
    else if (/^\s*[\d\u0660-\u0669]+\s*[-–—:]/.test(t)) prefixed++;
    if (nullish(pick(rec, hShape, 'matnPlain'))) matnPresent++;
    const ch = nullish(pick(rec, hShape, 'chapter')) || '(none)';
    chapterTitles.set(ch, (chapterTitles.get(ch) || 0) + 1);
  }
  log(`front matter (no number)   ${frontMatter} (${pct(frontMatter, total)}%)  -> filtered`);
  log(`no text at all             ${noText}`);
  log(`"N - " prefixed text       ${prefixed} (${pct(prefixed, total)}%)  -> stripped`);
  log(`matn present               ${matnPresent} (${pct(matnPresent, total)}%)`);

  // The chapter-identity check. If a title carries hundreds of hadiths it is
  // not one chapter — it is many chapters sharing a name, and title-keyed
  // identity would have merged them.
  const worst = [...chapterTitles.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  log(`distinct chapter titles    ${chapterTitles.size}`);
  log('most-loaded titles (a huge count means title-keyed identity would merge chapters):');
  for (const [t, n] of worst) log(`    ${String(n).padStart(6)}  ${t.slice(0, 60)}`);
  report.quality = { frontMatter, noText, prefixed, matnPresent,
                     distinctChapterTitles: chapterTitles.size,
                     topChapterTitles: worst };

  // --- transmission words ---------------------------------------------------
  head('TRANSMISSION WORDS');
  const words = new Map();
  for (const rec of sample) {
    for (const s of normalizeChains(pick(rec, hShape, 'chains'))) {
      for (const n of s.nodes) {
        const r = nodeToRecord(n, cShape || { map: {} });
        if (r?.transmission) {
          const k = normalizeArabic(r.transmission);
          words.set(k, (words.get(k) || 0) + 1);
        }
      }
    }
  }
  if (words.size) {
    for (const [w, n] of [...words.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12)) {
      log(`${String(n).padStart(7)}  ${w}`);
    }
    const anana = (words.get('عن') || 0) + (words.get('وعن') || 0);
    const totalW = [...words.values()].reduce((a, b) => a + b, 0);
    log(`>> an'ana (عن/وعن) share: ${pct(anana, totalW)}% — chain_strength penalises these`);
    if (!anana) log(">> WARNING: no عن found. Check the an'ana list in chain_strength.");
    report.transmission = { distinct: words.size, anana, total: totalW };
  } else {
    // No sigha on the chain nodes themselves. That is NOT the end of the story:
    // Ifta keeps them in a parallel `narration_words` array, and extract aligns
    // them positionally. Reusing extract's own alignTransmission rather than
    // re-deriving it here — a projection that disagrees with the loader is
    // worse than no projection.
    log('chain nodes carry no sigha — checking the parallel narration_words array');
    const par = new Map();
    let alignable = 0, single = 0;
    for (const rec of sample) {
      const chains = normalizeChains(pick(rec, hShape, 'chains'));
      if (chains.length !== 1) continue;
      single++;
      const m = alignTransmission(rec, hShape, chains);
      if (!m) continue;
      alignable++;
      for (const w of Object.values(m)) {
        const k = normalizeArabic(w);
        par.set(k, (par.get(k) || 0) + 1);
      }
    }
    if (par.size) {
      for (const [w, n] of [...par.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12)) {
        log(`${String(n).padStart(7)}  ${w}`);
      }
      const anana = (par.get('عن') || 0) + (par.get('وعن') || 0);
      const totalW = [...par.values()].reduce((a, b) => a + b, 0);
      log(`>> alignable: ${alignable}/${single} single-sanad hadiths (${pct(alignable, single)}%)`);
      log(`>> an'ana (عن/وعن) share: ${pct(anana, totalW)}% — chain_strength penalises these`);
      if (!anana) log(">> WARNING: no عن found. Check the an'ana list in chain_strength.");
      report.transmission = { distinct: par.size, anana, total: totalW, alignable, single, source: 'parallel' };
    } else {
      log('no transmission words anywhere — column will be NULL, an\'ana penalty inert');
      report.transmission = { distinct: 0 };
    }
  }

  // --- normalisation parity -------------------------------------------------
  await checkNormalizerParity(report);

  fs.writeFileSync(outPath('profile_report.json'), JSON.stringify(report, null, 2));
  head('DONE');
  log(`written: ${outPath('profile_report.json')}`);
  log('If any shape line above reads UNRESOLVED, write shape.override.json before extracting.');
  return report;
}

// -----------------------------------------------------------------------------
// The JS normaliser is a mirror of the SQL one and is used for every projection
// above. If they drift, these numbers become optimistic fiction while the real
// load quietly resolves less — so verify rather than assume.
// -----------------------------------------------------------------------------
async function checkNormalizerParity(report) {
  head('NORMALIZER PARITY (JS vs SQL)');
  const cases = ['  مُحَمَّدُ   بْنُ  إِسْمَاعِيلَ  ', 'أبو هريرة', 'عَنْ', 'ابن شهاب الزُّهْرِيّ',
                 'إسماعيل', 'مؤمن', 'رئيس', 'abc 123', 'عائشة رضي الله عنها'];
  let p;
  try { p = pool(); } catch { log('no DB configured — skipped'); return; }
  try {
    const c = await p.connect();
    let bad = 0;
    for (const s of cases) {
      const { rows } = await c.query('SELECT corpus.normalize_arabic($1) AS v', [s]);
      const js = normalizeArabic(s);
      if (rows[0].v !== js) { bad++; log(`MISMATCH [${s}]  sql=[${rows[0].v}]  js=[${js}]`); }
    }
    c.release();
    if (bad) {
      report.normalizerParity = 'MISMATCH';
      throw new Error(`${bad} normalisation mismatches — fix before trusting any projection above`);
    }
    log(`${cases.length}/${cases.length} identical`);
    report.normalizerParity = 'OK';
  } catch (e) {
    if (/mismatch/i.test(e.message)) throw e;
    // AggregateError (the shape a failed TCP connect arrives as) has an empty
    // .message, which rendered this as "database unreachable ()".
    log(`database unreachable (${e.message || e.code || e.constructor?.name || e}) — parity unverified`);
    report.normalizerParity = 'UNVERIFIED';
  } finally {
    await p.end().catch(() => {});
  }
}

function bump(map, key, id) {
  if (!key) return;
  if (!map.has(key)) map.set(key, new Set());
  map.get(key).add(id);
}

// =============================================================================
// RANKMAP — emit the curation worklist for staging.rank_map.
//
// The rank scale is a modelling decision, so the mapping cannot be automated.
// What can be automated is ordering the work: grade strings follow a long tail,
// and mapping the top ~40 by frequency usually covers most of the corpus.
// Emits SQL you edit and run, not SQL you run blind.
// =============================================================================
export async function rankmap() {
  if (!exists(CFG.narratorsFile)) throw new Error(`${CFG.narratorsFile} not found`);
  const raw = readJson(CFG.narratorsFile);
  const recs = Array.isArray(raw) ? raw : Object.values(raw);
  const shape = detectNarratorShape(recs);
  const freq = new Map();
  for (const r of recs) {
    for (const f of ['rankIbnHajar', 'rankDhahabi']) {
      const v = nullish(pick(r, shape, f));
      if (!v) continue;
      const k = normalizeArabic(v);
      if (k) freq.set(k, (freq.get(k) || 0) + 1);
    }
  }
  const sorted = [...freq.entries()].sort((a, b) => b[1] - a[1]);
  const total = sorted.reduce((a, [, n]) => a + n, 0);

  head('RANK STRING FREQUENCY');
  log(`${sorted.length} distinct grade strings, ${total} occurrences`);
  let cum = 0, i = 0;
  for (const [s, n] of sorted.slice(0, 40)) {
    cum += n; i++;
    log(`${String(i).padStart(3)}. ${String(n).padStart(6)}  ${pct(cum, total).padStart(6)}%  ${s}`);
  }

  // First-token frequency. 13_ranks pass 2 matches on this, and it is where
  // almost all the coverage comes from: the grade word leads and the
  // qualification follows, so ~55 token rules do the work of ~1,300 exact ones.
  const tokFreq = new Map();
  for (const [s, n] of sorted) {
    const t = s.split(' ')[0];
    if (t) tokFreq.set(t, (tokFreq.get(t) || 0) + n);
  }
  const tokens = [...tokFreq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 60);

  head('FIRST-TOKEN FREQUENCY (what pass 2 matches)');
  let tcum = 0, ti = 0;
  for (const [t, n] of tokens.slice(0, 20)) {
    tcum += n; ti++;
    log(`${String(ti).padStart(3)}. ${String(n).padStart(6)}  ${pct(tcum, total).padStart(6)}%  ${t}`);
  }

  // Exact rules are only worth writing where the full string should NOT get the
  // code its first token implies — otherwise the token rule already covers it,
  // and a redundant exact row is one more line to defend for no coverage.
  // Single-word strings are excluded outright: raw_string is the primary key,
  // so a word cannot be both a token rule and an exact rule.
  const exact = sorted
    .filter(([s]) => s.includes(' '))
    .filter(([s]) => guessCode(s) !== guessCode(s.split(' ')[0]))
    .slice(0, 60);

  ensureOut();
  const rows = (list, kind) => list.map(([s, n], i, arr) =>
    // Comma BEFORE the comment: `('x','y')  -- n` followed by a joined comma
    // puts the separator inside the comment and the statement fails to parse.
    `  (${quote(s)}, ${quote(guessCode(s))}, '${kind}')${i < arr.length - 1 ? ',' : ''}   -- ${n} occurrences`
  ).join('\n');

  const out = [
    '-- Generated by `node src/cli.js rankmap`. EDIT BEFORE RUNNING.',
    '-- Every line is a judgement call: map each raw rijal string to one of the',
    '-- codes in corpus.rank_levels. Delete lines you cannot classify —',
    '-- an unmapped string leaves the code NULL, which chain_strength treats as',
    '-- ungraded (0.50), NOT as criticised. That asymmetry is deliberate:',
    '-- guessing weak for an unrecognised grade defames narrators the source praised.',
    '--',
    '-- codes: thiqa(6) saduq(5) maqbul(4) layyin(3) daif(2) matruk(1)',
    '',
    '-- ---------------------------------------------------------------------',
    '-- TOKEN rules (13_ranks pass 2): matched against the FIRST WORD of the',
    '-- normalised grade, so one rule covers every qualification built on it —',
    "-- 'ثقة', 'ثقة حافظ', 'ثقة ثبت' all resolve through the single 'ثقة' rule.",
    '-- This is where the coverage is. Review these first.',
    '-- ---------------------------------------------------------------------',
    'INSERT INTO staging.rank_map (raw_string, rank_code, match_kind) VALUES',
    rows(tokens, 'token'),
    'ON CONFLICT (raw_string) DO UPDATE',
    '  SET rank_code = EXCLUDED.rank_code, match_kind = EXCLUDED.match_kind;',
    '',
    '-- ---------------------------------------------------------------------',
    '-- EXACT rules (13_ranks pass 1): whole normalised string, applied BEFORE',
    '-- the token rules so they act as exceptions to them. Only strings whose',
    '-- verdict differs from what their first token implies are listed here.',
    '-- ---------------------------------------------------------------------',
    'INSERT INTO staging.rank_map (raw_string, rank_code, match_kind) VALUES',
    rows(exact, 'exact'),
    'ON CONFLICT (raw_string) DO UPDATE',
    '  SET rank_code = EXCLUDED.rank_code, match_kind = EXCLUDED.match_kind;',
    '',
    '-- Any line still reading REVIEW must be classified or deleted before running.',
    '',
    '-- ---------------------------------------------------------------------',
    '-- Per-narrator overrides (13_ranks pass 4) are NOT generated: they are',
    '-- assertions about named people and each needs a written justification.',
    '-- See db/03_staging.sql and etl/narrator_overrides.sql.',
    '-- ---------------------------------------------------------------------',
  ];
  const file = outPath('rank_map.sql');
  fs.writeFileSync(file, out.join('\n'));
  head('WRITTEN');
  log(file);
  log(`${tokens.length} token rules + ${exact.length} exact exceptions`);
  log('Review every line, then: psql -d ilham -f build/rank_map.sql');
}

// A first pass only. Keyword matching on Arabic grade vocabulary gets the
// common cases and will be wrong on compound judgements ("thiqa but errs
// late"), which is exactly why the output is a file to review.
const KEYWORDS = [
  [/متروك|كذاب|وضاع|متهم/, 'matruk'],
  [/ضعيف|ضعف|واه/,        'daif'],
  [/لين|ليس بالقوي|فيه لين/, 'layyin'],
  [/مقبول|صالح الحديث/,     'maqbul'],
  [/صدوق|لا باس به/,        'saduq'],
  [/ثقه|ثقة|حافظ|امام|حجه|حجة/, 'thiqa'],
];
function guessCode(s) {
  for (const [re, code] of KEYWORDS) if (re.test(s)) return code;
  return 'REVIEW';
}
const quote = (s) => `'${String(s).replace(/'/g, "''")}'`;
