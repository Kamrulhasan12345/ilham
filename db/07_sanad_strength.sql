-- =============================================================================
-- ILHAM — 07_sanad_strength.sql
-- Additive migration, run once against an already-bootstrapped database.
-- Exposes the per-sanad strength that corpus.chain_strength aggregates.
-- docs/backend-prd.md §8.4 prefers a view over a second function that
-- duplicates the arithmetic: the function keeps returning the best sanad,
-- and this view exposes every sanad. The API reads it for the grouped
-- chains in GET /hadiths/:id. Like 06, this file grants its own object
-- explicitly, because 05_post_load.sql sealed its schema-wide grant before
-- this view existed.
-- =============================================================================

\set ON_ERROR_STOP on

CREATE OR REPLACE VIEW corpus.sanad_strengths AS
SELECT l.hadith_id,
       l.sanad_no,
       greatest(min(
           CASE
               WHEN l.narrator_id IS NULL OR n.is_placeholder THEN 0.15
               WHEN n.rank_ibn_hajar IS NULL AND n.rank_dhahabi IS NULL THEN 0.50
               ELSE least(coalesce(rh.weight, 1), coalesce(rd.weight, 1))
           END
           - CASE WHEN l.transmission_norm IN ('عن', 'وعن') THEN 0.05 ELSE 0 END
       ), 0)::numeric(3,2) AS strength
  FROM corpus.isnad_links l
  LEFT JOIN corpus.narrators n ON n.narrator_id = l.narrator_id
  LEFT JOIN corpus.rank_levels rh ON rh.rank_code = n.rank_ibn_hajar
  LEFT JOIN corpus.rank_levels rd ON rd.rank_code = n.rank_dhahabi
 WHERE NOT l.is_compiler
 GROUP BY l.hadith_id, l.sanad_no;

GRANT SELECT ON corpus.sanad_strengths TO ilham_app;
