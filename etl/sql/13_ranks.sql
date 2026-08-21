-- =============================================================================
-- ILHAM ETL — 13_ranks.sql
-- Apply the curated rijal grade mapping, in four ordered passes.
--
-- Raw strings stay on corpus.narrators for display honesty; the codes are what
-- rank_levels (and therefore chain_strength) do arithmetic on. An unmapped raw
-- string leaves the code NULL, which chain_strength treats as ungraded (0.50) —
-- NOT as criticised. That asymmetry is deliberate and must stay: silently
-- scoring an unmapped grade as weak would defame narrators the source praised.
--
-- WHY FOUR PASSES. A single exact-string map does not fit this source.
--
--   1. The grades are COMPOUND. 'ثقة حافظ فقيه , إمام حجة إلا أنه تغير حفظه
--      بأخرة' is the verdict thiqa plus four clauses of qualification. Matching
--      whole strings makes every distinct qualification its own grade: covering
--      99% of Ibn Hajar that way needs ~1,300 map entries instead of ~55.
--   2. al-Dhahabi barely uses labels. His frequent values are verbs and
--      attributions — وثق (674), وثقوه, وثقه النسائي, ضعفوه, تركوه — which share
--      no form with 'ثقة' and can only be mapped by meaning.
--   3. The eminent are not graded at all. The literature writes ENCOMIUM for
--      them: Ibn Hajar on Abu Hurayra is 'الصحابي الجليل ، حافظ الصحابة'.
--      Grading presupposes doubt, and for the giants there is none to express.
--
-- Point 3 is not a rounding error. 178 narrators hold 16.8% of every chain
-- position in Bukhari+Muslim and they are exactly these giants (al-Zuhri 2,209
-- mentions, Abu Hurayra 2,336, Aisha 1,616, Malik 1,033). chain_strength is
-- weakest-link, so ONE uncoded al-Zuhri at the neutral 0.50 caps the whole
-- sanad — which would score the strongest isnads in the corpus lowest. Passes
-- 3 and 4 exist to stop the metric pointing backwards.
--
-- Each pass fills only what the previous left NULL, so specific beats general —
-- the same shape as resolution's A/A'/B/C/X. rank_*_via records which pass won,
-- because collapsing four very different derivations into one column turns a
-- defensible number into an unexplained one.
--
-- Run `node src/cli.js rankmap` to emit the frequency-ordered worklist.
-- =============================================================================

\set ON_ERROR_STOP on

BEGIN;

UPDATE corpus.narrators
   SET rank_ibn_hajar = NULL, rank_dhahabi = NULL,
       rank_ibn_hajar_via = NULL, rank_dhahabi_via = NULL;
DELETE FROM staging.rejects WHERE stage = '13_ranks';

-- =============================================================================
-- PASS 1 — exact whole-string match.  via = 'E'
-- Curated entries go first so a nuanced verdict can be pinned away from the
-- code its first token would otherwise imply.
-- =============================================================================
UPDATE corpus.narrators n
SET rank_ibn_hajar = rm.rank_code, rank_ibn_hajar_via = 'E'
FROM staging.rank_map rm
WHERE rm.match_kind = 'exact'
  AND n.rank_ibn_hajar_raw IS NOT NULL
  AND rm.raw_string = corpus.normalize_arabic(n.rank_ibn_hajar_raw);

UPDATE corpus.narrators n
SET rank_dhahabi = rm.rank_code, rank_dhahabi_via = 'E'
FROM staging.rank_map rm
WHERE rm.match_kind = 'exact'
  AND n.rank_dhahabi_raw IS NOT NULL
  AND rm.raw_string = corpus.normalize_arabic(n.rank_dhahabi_raw);

-- =============================================================================
-- PASS 2 — first-token match.  via = 'T'
-- The grade word leads and the qualification follows, so the first
-- whitespace-delimited token carries the verdict. This is the single largest
-- coverage lever: Ibn Hajar goes from ~48% to ~71% of graded narrators for
-- roughly the same curation effort.
-- =============================================================================
UPDATE corpus.narrators n
SET rank_ibn_hajar = rm.rank_code, rank_ibn_hajar_via = 'T'
FROM staging.rank_map rm
WHERE rm.match_kind = 'token'
  AND n.rank_ibn_hajar IS NULL
  AND n.rank_ibn_hajar_raw IS NOT NULL
  AND rm.raw_string = split_part(corpus.normalize_arabic(n.rank_ibn_hajar_raw), ' ', 1);

UPDATE corpus.narrators n
SET rank_dhahabi = rm.rank_code, rank_dhahabi_via = 'T'
FROM staging.rank_map rm
WHERE rm.match_kind = 'token'
  AND n.rank_dhahabi IS NULL
  AND n.rank_dhahabi_raw IS NOT NULL
  AND rm.raw_string = split_part(corpus.normalize_arabic(n.rank_dhahabi_raw), ' ', 1);

-- =============================================================================
-- PASS 3 — the Companion rule.  via = 'S'
--
-- Companion-ness is a TABAQA (generation), not a grade, and it lives in
-- class_of_narrators. الصحابة كلهم عدول is the standing methodological position,
-- so a Companion needs no grade and the sources give none.
--
-- The tabaqa field is free text, so the pattern has to be wider than bare
-- 'صحابي': Abu Sa'id al-Khudri reads 'له ولأبيه صحبة', Ali 'أحد العشرة', the
-- Prophet's wives 'أم المؤمنين'. normalize_arabic has already folded ة->ه and
-- أ->ا, hence the spellings below.
--
-- via='S' rather than 'E'/'T' precisely BECAUSE this is not a scholar's verdict.
-- Both scholar columns are set — the claim is about the man, not about who said
-- it — and the via column is what keeps that distinction visible in the report.
-- =============================================================================
UPDATE corpus.narrators n
SET rank_ibn_hajar = 'thiqa', rank_ibn_hajar_via = 'S'
WHERE n.rank_ibn_hajar IS NULL
  AND NOT n.is_placeholder
  AND corpus.normalize_arabic(n.tabaqa_raw) ~ '(صحاب|صحبه|ام المومنين|احد العشره)';

UPDATE corpus.narrators n
SET rank_dhahabi = 'thiqa', rank_dhahabi_via = 'S'
WHERE n.rank_dhahabi IS NULL
  AND NOT n.is_placeholder
  AND corpus.normalize_arabic(n.tabaqa_raw) ~ '(صحاب|صحبه|ام المومنين|احد العشره)';

-- =============================================================================
-- PASS 4 — per-narrator overrides.  via = 'O'
--
-- Deliberately UNCONDITIONAL: an override is a hand-written assertion about a
-- named person carrying a written justification, so it outranks every inference
-- above it. This is where the non-Companion giants land — al-Zuhri, Malik,
-- Sa'id b. al-Musayyib — whose entries are praise rather than verdict.
-- =============================================================================
UPDATE corpus.narrators n
SET rank_ibn_hajar = o.rank_code, rank_ibn_hajar_via = 'O'
FROM staging.narrator_rank_override o
WHERE o.narrator_id = n.narrator_id AND o.scholar = 'ibn_hajar';

UPDATE corpus.narrators n
SET rank_dhahabi = o.rank_code, rank_dhahabi_via = 'O'
FROM staging.narrator_rank_override o
WHERE o.narrator_id = n.narrator_id AND o.scholar = 'dhahabi';

-- -----------------------------------------------------------------------------
-- Unmapped strings, frequency-ordered: the worklist for extending rank_map.
-- Only strings that survived all four passes uncoded.
-- -----------------------------------------------------------------------------
INSERT INTO staging.rejects (stage, reason, source_key, payload)
SELECT '13_ranks', 'unmapped_rank_string', raw_norm, 'occurrences=' || n
FROM (
  SELECT corpus.normalize_arabic(rank_ibn_hajar_raw) AS raw_norm, count(*) AS n
  FROM corpus.narrators
  WHERE rank_ibn_hajar_raw IS NOT NULL AND rank_ibn_hajar IS NULL
  GROUP BY 1
  UNION ALL
  SELECT corpus.normalize_arabic(rank_dhahabi_raw), count(*)
  FROM corpus.narrators
  WHERE rank_dhahabi_raw IS NOT NULL AND rank_dhahabi IS NULL
  GROUP BY 1
) t
WHERE raw_norm <> '';

-- =============================================================================
-- Metrics
-- =============================================================================
INSERT INTO corpus.etl_metrics (stage, metric, scope, value_num)
SELECT '13_ranks', 'graded_ibn_hajar', NULL, count(*)
FROM corpus.narrators WHERE rank_ibn_hajar IS NOT NULL
UNION ALL
SELECT '13_ranks', 'graded_dhahabi', NULL, count(*)
FROM corpus.narrators WHERE rank_dhahabi IS NOT NULL
UNION ALL
SELECT '13_ranks', 'graded_by_both', NULL, count(*)
FROM corpus.narrators WHERE rank_ibn_hajar IS NOT NULL AND rank_dhahabi IS NOT NULL
UNION ALL
SELECT '13_ranks', 'ungraded_entirely', NULL, count(*)
FROM corpus.narrators
WHERE rank_ibn_hajar IS NULL AND rank_dhahabi IS NULL AND NOT is_placeholder
UNION ALL
SELECT '13_ranks', 'contested_narrators', NULL, count(*)
FROM corpus.narrators n
JOIN corpus.rank_levels rh ON rh.rank_code = n.rank_ibn_hajar
JOIN corpus.rank_levels rd ON rd.rank_code = n.rank_dhahabi
WHERE rh.ordinal <> rd.ordinal
UNION ALL
SELECT '13_ranks', 'distinct_unmapped_strings', NULL, count(*)
FROM staging.rejects WHERE stage = '13_ranks'
-- Derivation mix. This is the number the report quotes: "62% graded" is not
-- defensible on its own, "48% exact, 23% by token, 7% by tabaqa" is.
UNION ALL
SELECT '13_ranks', 'via_ibn_hajar_' || rank_ibn_hajar_via, NULL, count(*)
FROM corpus.narrators WHERE rank_ibn_hajar_via IS NOT NULL GROUP BY rank_ibn_hajar_via
UNION ALL
SELECT '13_ranks', 'via_dhahabi_' || rank_dhahabi_via, NULL, count(*)
FROM corpus.narrators WHERE rank_dhahabi_via IS NOT NULL GROUP BY rank_dhahabi_via
-- What chain_strength actually sees: coverage weighted by CHAIN POSITIONS, not
-- by narrator. Distinct-narrator coverage flatters the result, because the
-- narrators that repeat most are the ones hardest to grade.
UNION ALL
SELECT '13_ranks', 'pct_positions_graded', NULL,
       round(100.0 * count(*) FILTER (
         WHERE n.rank_ibn_hajar IS NOT NULL OR n.rank_dhahabi IS NOT NULL)
             / nullif(count(*), 0), 2)
FROM corpus.isnad_links l
JOIN corpus.narrators n ON n.narrator_id = l.narrator_id
WHERE NOT l.is_compiler;

COMMIT;

\echo '13_ranks done'
