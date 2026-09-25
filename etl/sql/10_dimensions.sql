-- =============================================================================
-- ILHAM ETL — 10_dimensions.sql
-- staging -> corpus.collections, corpus.kitabs, corpus.surahs, corpus.babs
--
-- Every stage 10-19 is idempotent against a freshly loaded staging: it
-- truncates its own targets first. Rerun any one of them without replaying the
-- whole pipeline.
-- =============================================================================

\set ON_ERROR_STOP on

BEGIN;

TRUNCATE corpus.collections, corpus.surahs RESTART IDENTITY CASCADE;

-- Titles come from the manifest, loaded as data. The draft seeded title_ar from
-- the slug and patched it later; a later UPDATE that nobody runs leaves the
-- corpus permanently wrong, so the correct value goes in on the first insert.
INSERT INTO corpus.collections (slug, title_ar, title_en)
SELECT bm.book_slug, bm.title_ar, bm.title_en
FROM staging.book_manifest bm
WHERE EXISTS (SELECT 1 FROM staging.hadiths s WHERE s.book_slug = bm.book_slug)
ORDER BY bm.book_slug;

-- Kitabs, surahs and babs from the curated structure (etl/sunnah_structure.sql,
-- loaded into staging by psql before the transform). Only books that have
-- hadiths get a structure.
INSERT INTO corpus.kitabs (collection_id, kitab_num, title_en, title_ar)
SELECT c.collection_id, k.kitab_num, k.title_en, k.title_ar
FROM staging.site_kitabs k
JOIN corpus.collections c ON c.slug = k.book_slug
ORDER BY c.collection_id, k.kitab_num;

-- One surah is one title pair. A second spelling for the same number would be a
-- scrape error; GROUP BY + HAVING turns it into a failed insert, not a pick.
INSERT INTO corpus.surahs (surah_num, title_en, title_ar)
SELECT surah_num, min(surah_en), min(surah_ar)
FROM staging.site_babs
WHERE surah_num IS NOT NULL
GROUP BY surah_num
HAVING count(DISTINCT (surah_en, surah_ar)) = 1;

INSERT INTO corpus.babs (kitab_id, seq, bab_num, surah_num, title_en, title_ar)
SELECT k.kitab_id, b.seq, b.bab_num, b.surah_num, b.title_en, b.title_ar
FROM staging.site_babs b
JOIN corpus.collections c ON c.slug = b.book_slug
JOIN corpus.kitabs k ON k.collection_id = c.collection_id AND k.kitab_num = b.kitab_num
ORDER BY k.kitab_id, b.seq;

INSERT INTO corpus.etl_metrics (stage, metric, scope, value_num)
SELECT '10_dimensions', 'collections_loaded', NULL, count(*) FROM corpus.collections
UNION ALL
SELECT '10_dimensions', 'kitabs_loaded', c.slug, count(*)
FROM corpus.kitabs k JOIN corpus.collections c USING (collection_id)
GROUP BY c.slug
UNION ALL
SELECT '10_dimensions', 'babs_loaded', c.slug, count(*)
FROM corpus.babs b JOIN corpus.kitabs k USING (kitab_id)
JOIN corpus.collections c USING (collection_id)
GROUP BY c.slug
UNION ALL
SELECT '10_dimensions', 'surahs_loaded', NULL, count(*) FROM corpus.surahs;

COMMIT;

\echo '10_dimensions done'
