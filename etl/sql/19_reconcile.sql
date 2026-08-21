-- =============================================================================
-- ILHAM ETL — 19_reconcile.sql
-- The gate before 05_post_load.sql seals the corpus and drops staging.
--
-- Everything here is computed from staging, which stops existing at the end of
-- the load. Whatever is not snapshotted into corpus.etl_metrics now is
-- unrecomputable forever — including every number the report quotes in §ETL.
-- =============================================================================

\set ON_ERROR_STOP on

BEGIN;

DELETE FROM corpus.etl_metrics WHERE stage = '19_reconcile';

-- -----------------------------------------------------------------------------
-- Row-count reconciliation. Source -> staging -> corpus, with the delta named.
-- -----------------------------------------------------------------------------
INSERT INTO corpus.etl_metrics (stage, metric, scope, value_num)
SELECT '19_reconcile', 'hadiths_staged_minus_loaded', NULL,
       (SELECT count(*) FROM staging.hadiths) - (SELECT count(*) FROM corpus.hadiths)
UNION ALL
SELECT '19_reconcile', 'chain_rows_staged_minus_loaded', NULL,
       (SELECT count(*) FROM staging.chain_rows) - (SELECT count(*) FROM corpus.isnad_links)
UNION ALL
SELECT '19_reconcile', 'narrators_staged_minus_loaded', NULL,
       (SELECT count(*) FROM staging.narrators) - (SELECT count(*) FROM corpus.narrators)
UNION ALL
SELECT '19_reconcile', 'rejects_total', NULL, (SELECT count(*) FROM staging.rejects);

INSERT INTO corpus.etl_metrics (stage, metric, scope, value_num)
SELECT '19_reconcile', 'rejects_' || reason, NULL, count(*)
FROM staging.rejects GROUP BY reason;

-- -----------------------------------------------------------------------------
-- Corpus health: what the analytics layer will actually see.
-- -----------------------------------------------------------------------------
INSERT INTO corpus.etl_metrics (stage, metric, scope, value_num)
SELECT '19_reconcile', 'hadiths_with_no_chain', NULL, count(*)
FROM corpus.hadiths h
WHERE NOT EXISTS (SELECT 1 FROM corpus.isnad_links l
                  WHERE l.hadith_id = h.hadith_id AND NOT l.is_compiler)
UNION ALL
SELECT '19_reconcile', 'hadiths_with_matn', NULL, count(*)
FROM corpus.hadiths WHERE matn_plain IS NOT NULL
UNION ALL
SELECT '19_reconcile', 'pct_hadiths_with_matn', NULL,
       round(100.0 * count(*) FILTER (WHERE matn_plain IS NOT NULL)
             / nullif(count(*),0), 2)
FROM corpus.hadiths
UNION ALL
SELECT '19_reconcile', 'avg_chain_length', NULL,
       round(avg(len), 2)
FROM (SELECT count(*) AS len FROM corpus.isnad_links
      WHERE NOT is_compiler GROUP BY hadith_id, sanad_no) t
UNION ALL
SELECT '19_reconcile', 'distinct_narrators_in_chains', NULL, count(DISTINCT narrator_id)
FROM corpus.isnad_links WHERE narrator_id IS NOT NULL AND NOT is_compiler
UNION ALL
SELECT '19_reconcile', 'anana_links', NULL, count(*)
FROM corpus.isnad_links
WHERE NOT is_compiler AND transmission_norm IN ('عن', 'وعن');

-- chain_strength distribution over a sample. Running it across the whole
-- corpus at reconcile time is wasteful; a sample is enough to prove the
-- function returns a sane spread rather than a constant or all-NULL.
INSERT INTO corpus.etl_metrics (stage, metric, scope, value_num)
SELECT '19_reconcile', 'sample_chain_strength_' || stat, NULL, val
FROM (
  WITH s AS (
    SELECT corpus.chain_strength(hadith_id) AS cs
    FROM (SELECT hadith_id FROM corpus.hadiths ORDER BY hadith_id LIMIT 2000) t
  )
  SELECT 'min' AS stat, min(cs) AS val FROM s
  UNION ALL SELECT 'max', max(cs) FROM s
  UNION ALL SELECT 'avg', round(avg(cs), 3) FROM s
  UNION ALL SELECT 'null_count', count(*) FILTER (WHERE cs IS NULL) FROM s
  UNION ALL SELECT 'distinct_values', count(DISTINCT cs) FROM s
) q;

-- -----------------------------------------------------------------------------
-- Hard gate. These are conditions under which the load is wrong, not merely
-- imperfect, and sealing the corpus would bake the error in permanently.
-- -----------------------------------------------------------------------------
DO $$
DECLARE v_left int; v_dup int; v_bad int; v_res numeric; v_distinct int;
BEGIN
  SELECT count(*) INTO v_left FROM corpus.isnad_links WHERE resolution IS NULL;
  IF v_left > 0 THEN
    RAISE EXCEPTION 'GATE: % links still have resolution NULL — rerun 12_resolve', v_left;
  END IF;

  SELECT count(*) INTO v_dup FROM (
    SELECT hadith_id, sanad_no, position FROM corpus.isnad_links
    GROUP BY 1,2,3 HAVING count(*) > 1) t;
  IF v_dup > 0 THEN
    RAISE EXCEPTION 'GATE: % duplicate chain positions', v_dup;
  END IF;

  SELECT count(*) INTO v_bad FROM corpus.hadiths h
  WHERE NOT EXISTS (SELECT 1 FROM corpus.collections c
                    WHERE c.collection_id = h.collection_id);
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'GATE: % hadiths reference a missing collection', v_bad;
  END IF;

  SELECT count(DISTINCT corpus.chain_strength(hadith_id)) INTO v_distinct
  FROM (SELECT hadith_id FROM corpus.hadiths ORDER BY hadith_id LIMIT 500) t;
  IF v_distinct <= 1 THEN
    RAISE EXCEPTION
      'GATE: chain_strength returns a single value across 500 hadiths — '
      'ranks or resolution did not land';
  END IF;

  SELECT value_num INTO v_res FROM corpus.etl_metrics
  WHERE stage = '12_resolve' AND metric = 'pct_resolved' AND scope IS NULL;
  IF v_res < 25 THEN
    RAISE WARNING
      'resolution rate is %%% — usable, but check the raw_name/display_name '
      'question before building study sets', v_res;
  END IF;

  RAISE NOTICE 'GATE PASSED — corpus is internally consistent';
END $$;

COMMIT;

-- -----------------------------------------------------------------------------
-- The report table. Everything §ETL needs, in one query.
-- -----------------------------------------------------------------------------
\echo ''
\echo '=== ETL RECONCILIATION ==='
SELECT stage, metric, coalesce(scope, '(global)') AS scope, value_num
FROM corpus.etl_metrics
WHERE scope IS NULL
ORDER BY stage, metric;

\echo ''
\echo '=== PER-COLLECTION RESOLUTION RATE ==='
SELECT scope AS collection, value_num AS pct_resolved
FROM corpus.etl_metrics
WHERE stage = '12_resolve' AND metric = 'pct_resolved' AND scope IS NOT NULL
ORDER BY value_num DESC;

\echo ''
\echo '=== TOP UNMAPPED RANK STRINGS (extend staging.rank_map) ==='
SELECT source_key AS raw_string, payload
FROM staging.rejects
WHERE stage = '13_ranks'
ORDER BY (regexp_replace(payload, '\D', '', 'g'))::int DESC
LIMIT 25;

\echo '19_reconcile done'
