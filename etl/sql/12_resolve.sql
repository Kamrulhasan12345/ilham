-- =============================================================================
-- ILHAM ETL — 12_resolve.sql
-- Narrator resolution. The load's centre of gravity.
--
-- Codes written to corpus.isnad_links.resolution:
--   A  canonical name matched exactly ONE narrator
--   B  positional zip against mentions (single-sanad hadiths only)
--   C  name matched, but more than one narrator shares the normalised form
--   X  no match at all
--
-- Why C exists: normalising 21K Arabic narrator names collapses many distinct
-- people onto the same string. The draft's Pass A joined straight against
-- name_norm, and UPDATE ... FROM silently picks an arbitrary row when several
-- match — assigning narrator identity by coin flip and stamping it 'A'. Making
-- ambiguity its own code costs one column value and turns a fake 90% resolution
-- rate into three honest numbers.
-- =============================================================================

\set ON_ERROR_STOP on

BEGIN;

UPDATE corpus.isnad_links SET narrator_id = NULL, resolution = NULL;
TRUNCATE staging.name_index;
TRUNCATE staging.resolution_conflicts;
DELETE FROM staging.rejects WHERE stage = '12_resolve';

-- -----------------------------------------------------------------------------
-- Candidate index. Placeholders are excluded: a bracketed non-name must never
-- win a resolution, it is the source declaring the narrator unknown.
--
-- Two surfaces, because chain strings are disambiguated forms and may sit
-- closer to display_name than to name. name_norm is tried first (it is the
-- plainer form and the likelier match); display_norm only fills what name_norm
-- could not, and never overrides it.
-- -----------------------------------------------------------------------------
INSERT INTO staging.name_index (name_norm, narrator_id, n_cand)
SELECT name_norm, min(narrator_id), count(*)
FROM corpus.narrators
WHERE NOT is_placeholder AND name_norm <> ''
GROUP BY name_norm;

CREATE TEMP TABLE display_index ON COMMIT DROP AS
SELECT display_norm AS name_norm, min(narrator_id) AS narrator_id, count(*) AS n_cand
FROM corpus.narrators
WHERE NOT is_placeholder AND display_norm <> ''
GROUP BY display_norm;
CREATE UNIQUE INDEX ON display_index (name_norm);

-- Normalised chain names, computed once. Without this the normalize_arabic call
-- is re-evaluated per candidate lookup across every link in the corpus.
CREATE TEMP TABLE link_norm ON COMMIT DROP AS
SELECT hadith_id, sanad_no, position,
       corpus.normalize_arabic(raw_name) AS raw_norm
FROM corpus.isnad_links
WHERE NOT is_compiler;
CREATE UNIQUE INDEX ON link_norm (hadith_id, sanad_no, position);
CREATE INDEX ON link_norm (raw_norm);
ANALYZE link_norm;

-- =============================================================================
-- PASS A — unique canonical name match
-- =============================================================================
UPDATE corpus.isnad_links l
SET narrator_id = x.narrator_id, resolution = 'A'
FROM link_norm ln, staging.name_index x
WHERE ln.hadith_id = l.hadith_id AND ln.sanad_no = l.sanad_no
  AND ln.position = l.position
  AND x.name_norm = ln.raw_norm
  AND x.n_cand = 1
  AND l.narrator_id IS NULL;

-- Pass A', same rule against display_name. Only fills gaps.
UPDATE corpus.isnad_links l
SET narrator_id = d.narrator_id, resolution = 'A'
FROM link_norm ln, display_index d
WHERE ln.hadith_id = l.hadith_id AND ln.sanad_no = l.sanad_no
  AND ln.position = l.position
  AND d.name_norm = ln.raw_norm
  AND d.n_cand = 1
  AND l.narrator_id IS NULL;

-- =============================================================================
-- PASS B candidate set — positional zip, single-sanad hadiths only
--
-- The chain minus its compiler, reversed, aligns 1:1 with the narrator mentions
-- in text order: the compiler's immediate teacher is named first, the Companion
-- last. So mention_order = chain_len + 1 - position.
--
-- Three guards the draft lacked, each of which silently corrupts the alignment:
--
--  1. chain_len is derived from the compiler FLAG, not from max(position) - 1.
--     A chain with no flagged compiler is off by one along its entire length,
--     producing plausible-looking wrong narrators rather than an obvious error.
--  2. mention count must equal chain_len. A mismatch means the two structures
--     do not describe the same set of people and the zip is meaningless.
--  3. the mention's narrator_id must exist in corpus.narrators. staging.mentions
--     carries no FK on purpose (orphans exist); joining through the table is
--     what stops an orphan from aborting the stage on FK violation.
--
-- Materialised as a table rather than a correlated subquery: the draft
-- recomputed max(position) per row, which is ~1.4M correlated aggregates.
-- =============================================================================
CREATE TEMP TABLE chain_len ON COMMIT DROP AS
SELECT hadith_id, sanad_no,
       max(position) FILTER (WHERE NOT is_compiler) AS len
FROM corpus.isnad_links
GROUP BY hadith_id, sanad_no;
CREATE UNIQUE INDEX ON chain_len (hadith_id, sanad_no);

CREATE TEMP TABLE mention_len ON COMMIT DROP AS
SELECT hadith_id, count(*) AS n_mentions
FROM staging.mentions GROUP BY hadith_id;
CREATE UNIQUE INDEX ON mention_len (hadith_id);

CREATE TEMP TABLE b_candidate ON COMMIT DROP AS
SELECT l.hadith_id, l.sanad_no, l.position, m.narrator_id
FROM corpus.isnad_links l
JOIN corpus.hadiths  h  ON h.hadith_id = l.hadith_id AND h.sanad_count = 1
JOIN chain_len       cl ON cl.hadith_id = l.hadith_id AND cl.sanad_no = l.sanad_no
JOIN mention_len     ml ON ml.hadith_id = l.hadith_id AND ml.n_mentions = cl.len
JOIN staging.mentions m ON m.hadith_id = l.hadith_id
                       AND m.mention_order = cl.len + 1 - l.position
JOIN corpus.narrators n ON n.narrator_id = m.narrator_id
WHERE NOT l.is_compiler
  AND cl.len IS NOT NULL;
CREATE UNIQUE INDEX ON b_candidate (hadith_id, sanad_no, position);
ANALYZE b_candidate;

-- -----------------------------------------------------------------------------
-- A-vs-B agreement. Recorded BEFORE Pass B writes anything.
--
-- The draft folded this into the Pass B UPDATE as a CASE branch, but that
-- statement's WHERE clause contains `l.narrator_id IS NULL` while Pass A always
-- sets narrator_id when it sets 'A' — so the branch was unreachable and the
-- cross-check never happened. The agreement rate between two independent
-- resolution methods is the most credible validation number in the whole load;
-- it gets its own table.
-- -----------------------------------------------------------------------------
INSERT INTO staging.resolution_conflicts
    (hadith_id, sanad_no, position, raw_name, a_narrator, b_narrator)
SELECT l.hadith_id, l.sanad_no, l.position, l.raw_name, l.narrator_id, b.narrator_id
FROM corpus.isnad_links l
JOIN b_candidate b ON b.hadith_id = l.hadith_id
                  AND b.sanad_no  = l.sanad_no
                  AND b.position  = l.position
WHERE l.resolution = 'A'
  AND b.narrator_id IS DISTINCT FROM l.narrator_id;

-- =============================================================================
-- PASS B — fill the gaps Pass A left. Never overrides an A.
-- =============================================================================
UPDATE corpus.isnad_links l
SET narrator_id = b.narrator_id, resolution = 'B'
FROM b_candidate b
WHERE b.hadith_id = l.hadith_id
  AND b.sanad_no  = l.sanad_no
  AND b.position  = l.position
  AND l.narrator_id IS NULL;

-- =============================================================================
-- Terminal codes. Nothing may be left NULL: 05_post_load.sql sets the column
-- NOT NULL and will refuse to seal a corpus that still has unclassified links.
-- =============================================================================

-- C: the name IS known, but it does not identify one person.
UPDATE corpus.isnad_links l
SET resolution = 'C'
FROM link_norm ln
WHERE ln.hadith_id = l.hadith_id AND ln.sanad_no = l.sanad_no
  AND ln.position = l.position
  AND l.narrator_id IS NULL
  AND l.resolution IS NULL
  AND (EXISTS (SELECT 1 FROM staging.name_index x
               WHERE x.name_norm = ln.raw_norm AND x.n_cand > 1)
    OR EXISTS (SELECT 1 FROM display_index d
               WHERE d.name_norm = ln.raw_norm AND d.n_cand > 1));

-- X: everything else, compiler positions included. The compiler is tagged, not
-- dropped — the chain stays complete for display and every analytical query
-- filters on NOT is_compiler. Dropping it at load time would bake an analytics
-- decision into the data with no way back short of a reload.
UPDATE corpus.isnad_links SET resolution = 'X' WHERE resolution IS NULL;

-- =============================================================================
-- Metrics. Per-collection resolution rate is the number that decides which
-- collections are safe to build curated study sets from.
-- =============================================================================
INSERT INTO corpus.etl_metrics (stage, metric, scope, value_num)
SELECT '12_resolve', 'links_' || l.resolution, NULL, count(*)
FROM corpus.isnad_links l WHERE NOT l.is_compiler GROUP BY l.resolution
UNION ALL
SELECT '12_resolve', 'pct_resolved', NULL,
       round(100.0 * count(*) FILTER (WHERE narrator_id IS NOT NULL)
             / nullif(count(*),0), 2)
FROM corpus.isnad_links WHERE NOT is_compiler
UNION ALL
SELECT '12_resolve', 'pct_resolved', c.slug,
       round(100.0 * count(*) FILTER (WHERE l.narrator_id IS NOT NULL)
             / nullif(count(*),0), 2)
FROM corpus.isnad_links l
JOIN corpus.hadiths h USING (hadith_id)
JOIN corpus.collections c USING (collection_id)
WHERE NOT l.is_compiler
GROUP BY c.slug
UNION ALL
SELECT '12_resolve', 'ab_compared', NULL, count(*)
FROM corpus.isnad_links l
JOIN b_candidate b USING (hadith_id, sanad_no, position)
WHERE l.resolution = 'A'
UNION ALL
SELECT '12_resolve', 'ab_conflicts', NULL, count(*) FROM staging.resolution_conflicts
UNION ALL
SELECT '12_resolve', 'pct_ab_agreement', NULL,
       round(100.0 * (1 - (SELECT count(*)::numeric FROM staging.resolution_conflicts)
             / nullif((SELECT count(*) FROM corpus.isnad_links l
                       JOIN b_candidate b USING (hadith_id, sanad_no, position)
                       WHERE l.resolution = 'A'), 0)), 2)
UNION ALL
SELECT '12_resolve', 'b_candidates', NULL, count(*) FROM b_candidate
UNION ALL
SELECT '12_resolve', 'hadiths_chain_mention_len_mismatch', NULL, count(*)
FROM chain_len cl
JOIN corpus.hadiths h ON h.hadith_id = cl.hadith_id AND h.sanad_count = 1
LEFT JOIN mention_len ml ON ml.hadith_id = cl.hadith_id
WHERE coalesce(ml.n_mentions, -1) <> cl.len;

COMMIT;

\echo '12_resolve done'
