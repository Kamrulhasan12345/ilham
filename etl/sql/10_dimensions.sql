-- =============================================================================
-- ILHAM ETL — 10_dimensions.sql
-- staging -> corpus.collections, corpus.chapters
--
-- Every stage 10-19 is idempotent against a freshly loaded staging: it
-- truncates its own targets first. Rerun any one of them without replaying the
-- whole pipeline.
-- =============================================================================

\set ON_ERROR_STOP on

BEGIN;

TRUNCATE corpus.collections RESTART IDENTITY CASCADE;

-- Titles come from the manifest, loaded as data. The draft seeded title_ar from
-- the slug and patched it later; a later UPDATE that nobody runs leaves the
-- corpus permanently wrong, so the correct value goes in on the first insert.
INSERT INTO corpus.collections (slug, title_ar, title_en)
SELECT bm.book_slug, bm.title_ar, bm.title_en
FROM staging.book_manifest bm
WHERE EXISTS (SELECT 1 FROM staging.hadiths s WHERE s.book_slug = bm.book_slug)
ORDER BY bm.book_slug;

-- Chapters keyed on (collection, seq). DISTINCT ON collapses the repeated
-- (book, seq, title) rows that every hadith in a chapter contributes; the title
-- is carried along as an attribute, NOT as identity — bare باب chapters are
-- common and title-keyed identity silently merges them.
INSERT INTO corpus.chapters (collection_id, seq, title_ar)
SELECT DISTINCT ON (c.collection_id, s.chapter_seq)
       c.collection_id, s.chapter_seq, s.chapter_ar
FROM staging.hadiths s
JOIN corpus.collections c ON c.slug = s.book_slug
ORDER BY c.collection_id, s.chapter_seq, s.chapter_ar;

-- A chapter_seq that carries two different titles means the loader's chapter
-- sequencing disagrees with the source; the DISTINCT ON above silently picked
-- one. Surface it rather than let it pass.
INSERT INTO staging.rejects (stage, reason, source_key, payload)
SELECT '10_dimensions', 'chapter_seq_title_conflict',
       s.book_slug || '#' || s.chapter_seq,
       string_agg(DISTINCT s.chapter_ar, ' | ')
FROM staging.hadiths s
GROUP BY s.book_slug, s.chapter_seq
HAVING count(DISTINCT s.chapter_ar) > 1;

INSERT INTO corpus.etl_metrics (stage, metric, scope, value_num)
SELECT '10_dimensions', 'collections_loaded', NULL, count(*) FROM corpus.collections
UNION ALL
SELECT '10_dimensions', 'chapters_loaded', NULL, count(*) FROM corpus.chapters
UNION ALL
SELECT '10_dimensions', 'chapters_loaded', c.slug, count(*)
FROM corpus.chapters ch JOIN corpus.collections c USING (collection_id)
GROUP BY c.slug
UNION ALL
SELECT '10_dimensions', 'chapter_seq_title_conflicts', NULL, count(*)
FROM staging.rejects WHERE stage = '10_dimensions';

COMMIT;

\echo '10_dimensions done'
