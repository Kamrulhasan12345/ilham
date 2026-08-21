import { CFG, exists, readJson, log } from './config.js';

// =============================================================================
// SHAPE ADAPTER
//
// The Ifta dump's exact field names are not pinned down, and guessing wrong
// means the loader either crashes or — worse — loads NULLs into columns that
// looked fine. Rather than hard-code one guess, every logical field carries a
// list of plausible source keys and is resolved against an actual sample record
// at run time. What resolved, what did not, and what source keys went unused
// are all reported.
//
// If detection picks wrong, write shape.override.json and it wins outright:
//
//   { "hadith": { "hadithId": "mainId", "textPlain": "hadith_no_diac" },
//     "narrator": { "name": "full_name" } }
//
// Nothing about this file needs editing to onboard a differently-shaped source.
// =============================================================================

const HADITH_FIELDS = {
  hadithId:   ['mainId', 'main_id', 'id', 'hadithId', 'hadith_id', 'idInBook'],
  chapter:    ['chapter', 'chapter_ar', 'chapterName', 'bab', 'babName',
               'chapter_title', 'chapterTitle', 'book_chapter'],
  hadithNum:  ['hadithNumber', 'hadith_number', 'hadithNo', 'number', 'num',
               'hadith_num', 'idInChapter'],
  textDiac:   ['hadithTextDiacritics', 'text_diac', 'hadith_diacritics',
               'textWithDiacritics', 'hadith_tashkeel', 'hadith_text_diac',
               'hadith', 'text', 'hadithText'],
  textPlain:  ['hadithTextPlain', 'text_plain', 'hadith_plain', 'text_no_diac',
               'textWithoutDiacritics', 'hadith_no_tashkeel', 'plainText',
               'hadith_no_diac', 'hadith_text', 'hadithPlain'],
  matnDiac:   ['matnDiacritics', 'matn_diac', 'matn_tashkeel', 'matn_text_diac',
               'matnWithDiacritics'],
  matnPlain:  ['matnPlain', 'matn_plain', 'matn_text', 'matn', 'matn_no_diac',
               'matnText'],
  chains:     ['chain_of_narrators', 'chainOfNarrators', 'chains', 'isnad',
               'sanad', 'chain', 'narratorChains', 'isnads'],
  // 'names' leads deliberately. The Ifta records ALSO carry a 'narrators' key,
  // but it holds bare display strings with no ids -- useless to resolution Pass
  // B, which needs the narrator_id. 'names' is the one carrying
  // [surface_plain, surface_diac, narrator_id]. Detection order alone is not
  // trusted to get this right; see pickMentionsField below.
  mentions:   ['names', 'mentions', 'narrator_mentions', 'narratorMentions',
               'rawis', 'narrators'],
};

const NARRATOR_FIELDS = {
  narratorId:  ['narrator_id', 'narratorId', 'id', 'scholar_id', 'rawi_id'],
  displayName: ['display_name', 'displayName', 'full_name', 'fullName',
                'name_with_diacritics', 'title'],
  name:        ['name', 'narrator_name', 'narratorName', 'plain_name', 'short_name'],
  kunya:       ['kunya', 'kunyah', 'agnomen', 'abu'],
  nickname:    ['nickname', 'laqab', 'nick_name', 'alias'],
  lineage:     ['lineage', 'nasab', 'ancestry', 'parents'],
  relation:    ['relation', 'relations', 'relationship', 'family'],
  tabaqa:      ['class_of_narrators', 'tabaqa', 'tabaqah', 'generation',
                'classOfNarrators', 'rank_class', 'level'],
  school:      ['school', 'madhhab', 'madhab', 'jurisprudence', 'fiqh_school'],
  rankIbnHajar:['rank_ibn_hajar', 'rankIbnHajar', 'grade_ibn_hajar',
                'ibn_hajar', 'taqrib', 'rank1'],
  rankDhahabi: ['rank_dhahabi', 'rankDhahabi', 'grade_dhahabi', 'al_dhahabi',
                'dhahabi', 'rank2'],
  dateOfDeath: ['date_of_death', 'dateOfDeath', 'death', 'death_year',
                'wafat', 'died'],
};

const MENTION_FIELDS = {
  narratorId: ['narrator_id', 'narratorId', 'id', 'rawi_id'],
  plain:      ['plain', 'surface_plain', 'text_plain', 'name', 'word',
               'narrator', 'text'],
  diac:       ['diacritics', 'surface_diac', 'text_diac', 'name_diac',
               'word_diac', 'tashkeel'],
};

const CHAIN_NODE_FIELDS = {
  name:        ['name', 'narrator', 'raw_name', 'rawName', 'title', 'text',
                'display_name', 'narrator_name'],
  narratorId:  ['narrator_id', 'narratorId', 'id', 'rawi_id'],
  transmission:['transmission_word', 'transmissionWord', 'word', 'sigha',
                'seegha', 'tahammul', 'narration_word', 'connector'],
  position:    ['position', 'order', 'index', 'seq', 'level'],
};

// -----------------------------------------------------------------------------
function resolveGroup(candidates, sampleKeys, override = {}) {
  const keyset = new Map(sampleKeys.map((k) => [k.toLowerCase(), k]));
  const map = {};
  const missing = [];
  for (const [logical, opts] of Object.entries(candidates)) {
    if (override[logical]) { map[logical] = override[logical]; continue; }
    const hit = opts.find((o) => keyset.has(o.toLowerCase()));
    if (hit) map[logical] = keyset.get(hit.toLowerCase());
    else missing.push(logical);
  }
  const used = new Set(Object.values(map).map((v) => v.toLowerCase()));
  const unused = sampleKeys.filter((k) => !used.has(k.toLowerCase()));
  return { map, missing, unused };
}

// Collect keys across several records: optional fields are often absent from
// record #1, and resolving against one sample would drop them permanently.
function keyUnion(records, limit = 500) {
  const s = new Set();
  for (const r of records.slice(0, limit)) {
    if (r && typeof r === 'object') for (const k of Object.keys(r)) s.add(k);
  }
  return [...s];
}

export function detectHadithShape(records) {
  const ov = loadOverride().hadith || {};
  const shape = resolveGroup(HADITH_FIELDS, keyUnion(records), ov);
  if (!ov.mentions) pickMentionsField(records, shape);
  return shape;
}

// -----------------------------------------------------------------------------
// The mentions field cannot be chosen by name alone.
//
// Name-matching picks the first candidate key that EXISTS, which is how the
// Ifta load silently lost resolution Pass B: 'narrators' exists, so it won -- but
// it is a list of bare strings, so collectMentions found no objects, no mention
// shape was detected, and the extract wrote zero mention rows. Nothing failed.
// Pass B simply resolved nothing, and the corpus looked plausible.
//
// A mentions field is only usable if it actually yields narrator IDs, so test
// that against real records and take the first candidate that passes.
// -----------------------------------------------------------------------------
function pickMentionsField(records, shape) {
  const keys = new Set(keyUnion(records));
  const tried = [];
  for (const cand of HADITH_FIELDS.mentions) {
    const key = [...keys].find((k) => k.toLowerCase() === cand.toLowerCase());
    if (!key) continue;
    const ids = countMentionIds(records, key);
    tried.push(`${key}:${ids}`);
    if (ids > 0) {
      shape.map.mentions = key;
      shape.mentionsProbe = tried;
      shape.unused = shape.unused.filter((k) => k.toLowerCase() !== key.toLowerCase());
      return;
    }
  }
  delete shape.map.mentions;
  if (!shape.missing.includes('mentions')) shape.missing.push('mentions');
  shape.mentionsProbe = tried;
}

// How many narrator IDs does this field yield across a sample? Handles both
// object mentions ({narrator_id: N}) and positional arrays ([plain, diac, N]).
function countMentionIds(records, key, limit = 200) {
  let found = 0;
  for (const rec of records.slice(0, limit)) {
    const v = rec?.[key];
    if (!Array.isArray(v)) continue;
    for (const m of v) {
      if (Array.isArray(m)) {
        if (m.some((x) => Number.isInteger(x))) found++;
      } else if (m && typeof m === 'object') {
        for (const c of MENTION_FIELDS.narratorId) {
          if (toInt(m[c]) !== null) { found++; break; }
        }
      }
    }
  }
  return found;
}

export function detectNarratorShape(records) {
  const ov = loadOverride().narrator || {};
  return resolveGroup(NARRATOR_FIELDS, keyUnion(records), ov);
}

export function detectMentionShape(mentionObjs) {
  const ov = loadOverride().mention || {};
  if (!Object.keys(ov).length && mentionObjs.some(Array.isArray)) {
    return positionalMentionShape(mentionObjs);
  }
  return resolveGroup(MENTION_FIELDS, keyUnion(mentionObjs), ov);
}

// -----------------------------------------------------------------------------
// Positional mentions: [surface_plain, surface_diac, narrator_id].
//
// Ifta ships mentions as fixed-length tuples rather than objects, so there are
// no field NAMES to match -- keyUnion over an array returns "0","1","2" and
// every MENTION_FIELDS candidate misses. Infer by TYPE instead: the integer
// slot is the id, the string slots are the surfaces in plain/diacritised order.
//
// The resulting map holds numeric-string keys, which pick() reads unchanged --
// JS arrays accept string-index access, so arr["2"] is arr[2].
// -----------------------------------------------------------------------------
function positionalMentionShape(samples) {
  const rows = samples.filter(Array.isArray).slice(0, 200);
  const width = Math.max(0, ...rows.map((r) => r.length));
  const intCols = [], strCols = [];
  for (let i = 0; i < width; i++) {
    const vals = rows.map((r) => r[i]).filter((v) => v !== undefined && v !== null);
    if (!vals.length) continue;
    if (vals.every((v) => Number.isInteger(v))) intCols.push(i);
    else if (vals.every((v) => typeof v === 'string')) strCols.push(i);
  }
  const map = {};
  if (intCols.length) map.narratorId = String(intCols[0]);
  if (strCols.length) map.plain = String(strCols[0]);
  if (strCols.length > 1) map.diac = String(strCols[1]);

  const missing = ['narratorId', 'plain', 'diac'].filter((k) => !(k in map));
  return { map, missing, unused: [], positional: true, width };
}

export function detectChainNodeShape(nodeObjs) {
  const ov = loadOverride().chainNode || {};
  return resolveGroup(CHAIN_NODE_FIELDS, keyUnion(nodeObjs), ov);
}

let _override = null;
export function loadOverride() {
  if (_override) return _override;
  _override = exists(CFG.shapeOverride) ? readJson(CFG.shapeOverride) : {};
  return _override;
}

export const pick = (obj, shape, logical) => {
  const k = shape.map[logical];
  if (!k) return undefined;
  const v = obj[k];
  return v === '' ? undefined : v;
};

// =============================================================================
// CHAIN NORMALISATION
//
// chain_of_narrators may plausibly arrive as any of:
//   [[node, node], [node]]      -> array of sanads
//   [node, node]                -> one sanad, flat
//   { "1": [...], "2": [...] }  -> sanads keyed by number
//   [{ chain: [...] }, ...]     -> sanads wrapped in objects
// and a node may be a bare string or an object.
//
// All four collapse to: [{ sanadNo, nodes: [{ name, narratorId, transmission }] }]
// =============================================================================
export function normalizeChains(raw) {
  if (!raw) return [];
  let sanads;

  if (Array.isArray(raw)) {
    if (raw.length === 0) return [];
    if (Array.isArray(raw[0])) sanads = raw;
    else if (isWrapper(raw[0]))
      sanads = raw.map((w) => w[wrapperKey(w)]);
    else sanads = [raw];                       // flat: one sanad
  } else if (typeof raw === 'object') {
    sanads = Object.keys(raw)
      .sort((a, b) => Number(a) - Number(b))
      .map((k) => (Array.isArray(raw[k]) ? raw[k] : [raw[k]]));
  } else {
    return [];
  }

  return sanads
    .filter(Array.isArray)
    .map((nodes, i) => ({ sanadNo: i + 1, nodes: nodes.filter(Boolean) }));
}

const WRAPPER_KEYS = ['chain', 'narrators', 'nodes', 'sanad', 'isnad', 'links'];
const isWrapper = (o) =>
  o && typeof o === 'object' && !Array.isArray(o) && !!wrapperKey(o);
const wrapperKey = (o) => WRAPPER_KEYS.find((k) => Array.isArray(o[k]));

export function nodeToRecord(node, chainShape) {
  if (typeof node === 'string' || typeof node === 'number') {
    return { name: String(node), narratorId: null, transmission: null };
  }
  if (!node || typeof node !== 'object') return null;
  const name = pick(node, chainShape, 'name');
  return {
    name: name === undefined ? null : String(name),
    narratorId: toInt(pick(node, chainShape, 'narratorId')),
    transmission: nullish(pick(node, chainShape, 'transmission')),
  };
}

export function collectChainNodes(records, hadithShape, limit = 2000) {
  const out = [];
  for (const rec of records.slice(0, limit)) {
    for (const s of normalizeChains(pick(rec, hadithShape, 'chains'))) {
      for (const n of s.nodes) if (n && typeof n === 'object') out.push(n);
    }
    if (out.length > 4000) break;
  }
  return out;
}

export function collectMentions(records, hadithShape, limit = 2000) {
  const out = [];
  for (const rec of records.slice(0, limit)) {
    const m = pick(rec, hadithShape, 'mentions');
    if (Array.isArray(m)) for (const x of m) if (x && typeof x === 'object') out.push(x);
    if (out.length > 4000) break;
  }
  return out;
}

export const toInt = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number.parseInt(String(v).replace(/[^\d-]/g, ''), 10);
  return Number.isNaN(n) ? null : n;
};

export const nullish = (v) =>
  v === undefined || v === null || String(v).trim() === '' ? null : String(v).trim();

export function reportShape(label, shape) {
  log(`${label}:`);
  for (const [k, v] of Object.entries(shape.map)) {
    log(`    ${k.padEnd(14)} <- ${shape.positional ? `[${v}]` : v}`);
  }
  if (shape.positional)     log(`    (positional tuples, width ${shape.width})`);
  // How each mentions candidate scored. Printed always, not just on failure:
  // the field that WINS by name can still be the wrong one, and this is the
  // line that shows it.
  if (shape.mentionsProbe)  log(`    mentions probe (field:ids found): ${shape.mentionsProbe.join('  ')}`);
  if (shape.missing.length) log(`    UNRESOLVED: ${shape.missing.join(', ')}`);
  if (shape.unused.length)  log(`    unused source keys: ${shape.unused.join(', ')}`);
}
