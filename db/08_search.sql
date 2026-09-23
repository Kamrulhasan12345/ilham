-- =============================================================================
-- ILHAM — 08_search.sql
-- Additive migration, run once against an already-bootstrapped database, as
-- the database owner (CREATE EXTENSION needs a superuser; ilham_app cannot
-- run it). Adds the trigram index docs/backend-prd.md §8.2 specifies for
-- the Arabic substring search in GET /hadiths?q=. The number is 08, not 06:
-- §8.2 predates db/06_refresh_tokens.sql. Do not put this in
-- db/05_post_load.sql, which is destructive and already ran. Regenerate
-- db/ilham.dump afterwards, or a fresh clone restores a corpus with no
-- search index and no error that says so.
-- =============================================================================

\set ON_ERROR_STOP on

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX hadiths_text_trgm_idx ON corpus.hadiths
    USING gin (corpus.normalize_arabic(text_plain) gin_trgm_ops);
