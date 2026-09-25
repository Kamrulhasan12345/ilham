-- =============================================================================
-- ILHAM ETL — 11_corpus_load.sql
-- staging -> corpus.hadiths, corpus.narrators, corpus.isnad_links
-- Narrator resolution is NOT done here; links land with narrator_id NULL.
-- =============================================================================

\set ON_ERROR_STOP on

BEGIN;

TRUNCATE corpus.isnad_links, corpus.hadith_translations, corpus.hadiths CASCADE;
TRUNCATE corpus.narrators CASCADE;

-- -----------------------------------------------------------------------------
-- Hadiths. LEFT JOIN to the placement, not INNER.
-- An inner join drops every hadith that the placement file does not cover —
-- silently, and the row counts still look plausible because you never see what
-- left. kitab_id is nullable precisely so the loss is visible instead.
-- A placement that names a bab the structure lacks leaves bab_id NULL while
-- p.bab_seq is set; that is a reject too.
-- -----------------------------------------------------------------------------
INSERT INTO corpus.hadiths (hadith_id, collection_id, kitab_id, bab_id, hadith_num,
                            text_plain, text_diac, matn_plain, matn_diac, sanad_count)
SELECT s.hadith_id, c.collection_id, k.kitab_id, b.bab_id, s.hadith_num,
       s.text_plain, s.text_diac, s.matn_plain, s.matn_diac, s.sanad_count
FROM staging.hadiths s
JOIN corpus.collections c ON c.slug = s.book_slug
LEFT JOIN staging.placement p ON p.hadith_id = s.hadith_id
LEFT JOIN corpus.kitabs k ON k.collection_id = c.collection_id AND k.kitab_num = p.kitab_num
LEFT JOIN corpus.babs b   ON b.kitab_id = k.kitab_id AND b.seq = p.bab_seq;

INSERT INTO staging.rejects (stage, reason, source_key, payload)
SELECT '11_corpus_load',
       CASE WHEN p.hadith_id IS NULL THEN 'hadith_not_placed'
            WHEN h.kitab_id IS NULL  THEN 'placement_kitab_missing'
            ELSE 'placement_bab_missing' END,
       h.hadith_id::text,
       'collection=' || c.slug || coalesce(' kitab=' || p.kitab_num || ' bab=' || p.bab_seq, '')
FROM corpus.hadiths h
JOIN corpus.collections c USING (collection_id)
LEFT JOIN staging.placement p USING (hadith_id)
WHERE h.kitab_id IS NULL OR (h.bab_id IS NULL AND p.bab_seq IS NOT NULL);

-- -----------------------------------------------------------------------------
-- Narrators. is_placeholder from the bracketed-name convention: [راو موضع إبهام]
-- and friends are not people, they are the source admitting it does not know
-- who this was. chain_strength gives them 0.15 rather than treating them as
-- ordinary ungraded narrators.
-- -----------------------------------------------------------------------------
INSERT INTO corpus.narrators (narrator_id, display_name, name, kunya, lineage,
                              relation, tabaqa_raw, school, rank_ibn_hajar_raw,
                              rank_dhahabi_raw, date_of_death, is_placeholder)
SELECT n.narrator_id,
       n.display_name,
       n.name,
       nullif(btrim(n.kunya), ''),
       nullif(btrim(n.lineage), ''),
       nullif(btrim(n.relation), ''),
       nullif(btrim(n.tabaqa_raw), ''),
       nullif(btrim(n.school), ''),
       nullif(btrim(n.rank_ibn_hajar_raw), ''),
       nullif(btrim(n.rank_dhahabi_raw), ''),
       nullif(btrim(n.date_of_death), ''),
       btrim(n.name) ~ '^\[.*\]$' OR btrim(n.display_name) ~ '^\[.*\]$'
FROM staging.narrators n;

-- -----------------------------------------------------------------------------
-- Isnad links. narrator_id deliberately NULL — stage 12 owns resolution.
-- Only chains whose hadith survived the load: a chain row pointing at a hadith
-- that was rejected upstream would fail the FK and abort the whole stage.
-- -----------------------------------------------------------------------------
INSERT INTO corpus.isnad_links (hadith_id, sanad_no, position, raw_name,
                                transmission_word, is_compiler)
SELECT cr.hadith_id, cr.sanad_no, cr.position, cr.raw_name,
       nullif(btrim(cr.transmission_word), ''), cr.is_compiler
FROM staging.chain_rows cr
JOIN corpus.hadiths h ON h.hadith_id = cr.hadith_id;

INSERT INTO staging.rejects (stage, reason, source_key, payload)
SELECT '11_corpus_load', 'chain_row_orphan_hadith',
       cr.hadith_id || '/' || cr.sanad_no || '/' || cr.position, cr.raw_name
FROM staging.chain_rows cr
LEFT JOIN corpus.hadiths h ON h.hadith_id = cr.hadith_id
WHERE h.hadith_id IS NULL;

-- -----------------------------------------------------------------------------
-- Compiler-flag sanity. Pass B's positional zip derives chain length from the
-- compiler flag; a chain whose LAST position is not flagged compiler shifts the
-- whole alignment by one and produces plausible-looking wrong narrators.
-- Counted here so stage 12 can be trusted (or not).
-- -----------------------------------------------------------------------------
INSERT INTO staging.rejects (stage, reason, source_key, payload)
SELECT '11_corpus_load', 'chain_last_position_not_compiler',
       hadith_id || '/' || sanad_no, 'max_position=' || max_pos
FROM (
  SELECT hadith_id, sanad_no, max(position) AS max_pos,
         bool_or(is_compiler) AS has_compiler,
         max(position) FILTER (WHERE is_compiler) AS compiler_pos
  FROM corpus.isnad_links GROUP BY hadith_id, sanad_no
) t
WHERE NOT has_compiler OR compiler_pos <> max_pos;

INSERT INTO corpus.etl_metrics (stage, metric, scope, value_num)
SELECT '11_corpus_load', 'hadiths_loaded', NULL, count(*) FROM corpus.hadiths
UNION ALL
SELECT '11_corpus_load', 'hadiths_loaded', c.slug, count(*)
FROM corpus.hadiths h JOIN corpus.collections c USING (collection_id) GROUP BY c.slug
UNION ALL
SELECT '11_corpus_load', 'hadiths_staged', NULL, count(*) FROM staging.hadiths
UNION ALL
SELECT '11_corpus_load', 'hadiths_without_kitab', NULL, count(*)
FROM corpus.hadiths WHERE kitab_id IS NULL
UNION ALL
SELECT '11_corpus_load', 'hadiths_at_kitab_level', NULL, count(*)
FROM corpus.hadiths WHERE kitab_id IS NOT NULL AND bab_id IS NULL
UNION ALL
SELECT '11_corpus_load', 'placement_via_' || p.via, NULL, count(*)
FROM corpus.hadiths h JOIN staging.placement p USING (hadith_id) GROUP BY p.via
UNION ALL
SELECT '11_corpus_load', 'narrators_loaded', NULL, count(*) FROM corpus.narrators
UNION ALL
SELECT '11_corpus_load', 'narrators_placeholder', NULL, count(*)
FROM corpus.narrators WHERE is_placeholder
UNION ALL
SELECT '11_corpus_load', 'isnad_links_loaded', NULL, count(*) FROM corpus.isnad_links
UNION ALL
SELECT '11_corpus_load', 'isnad_links_staged', NULL, count(*) FROM staging.chain_rows
UNION ALL
SELECT '11_corpus_load', 'single_sanad_hadiths', NULL, count(*)
FROM corpus.hadiths WHERE sanad_count = 1
UNION ALL
SELECT '11_corpus_load', 'pct_single_sanad', NULL,
       round(100.0 * count(*) FILTER (WHERE sanad_count = 1) / nullif(count(*),0), 2)
FROM corpus.hadiths
UNION ALL
SELECT '11_corpus_load', 'chains_bad_compiler_flag', NULL, count(*)
FROM staging.rejects WHERE reason = 'chain_last_position_not_compiler'
UNION ALL
SELECT '11_corpus_load', 'transmission_word_null', NULL, count(*)
FROM corpus.isnad_links WHERE transmission_word IS NULL AND NOT is_compiler;

COMMIT;

\echo '11_corpus_load done'
