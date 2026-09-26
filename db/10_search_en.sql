-- =============================================================================
-- ILHAM — 10_search_en.sql
-- Additive migration, run once against an already-bootstrapped database, as
-- the database owner. Adds the trigram index for the English substring search
-- in GET /hadiths?q=. The API searches the English text when the query holds
-- no Arabic letter, and the Arabic text (08_search.sql) otherwise.
-- It adds an index only. It writes no row, so corpus stays read-only.
-- Needs pg_trgm, which 08_search.sql creates. Regenerate db/ilham.dump
-- afterwards, or a fresh clone restores a corpus with no English index.
-- =============================================================================

\set ON_ERROR_STOP on

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX hadith_translations_text_trgm_idx ON corpus.hadith_translations
    USING gin (lower(text_full) gin_trgm_ops);
