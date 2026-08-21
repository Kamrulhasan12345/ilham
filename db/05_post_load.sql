-- =============================================================================
-- ILHAM — 05_post_load.sql
-- Runs ONCE, after the ETL. Builds the indexes that are expensive to maintain
-- during a bulk load, freezes the corpus, and drops staging.
--
-- DO NOT run this before the ETL: it drops the staging schema.
-- =============================================================================

\set ON_ERROR_STOP on

-- Heavy expression index, deferred out of 01_corpus.sql. Nothing reads it
-- during the load, so building it once at the end costs less than maintaining
-- it through the COPY — by a wide margin at the full dataset's 276K rows, and
-- still the right shape at the 14,901 currently loaded.
CREATE INDEX hadiths_matn_norm_idx ON corpus.hadiths
    (corpus.normalize_arabic(left(matn_plain, 200)))
    WHERE matn_plain IS NOT NULL;

-- resolution is fully populated by now; make the guarantee structural.
ALTER TABLE corpus.isnad_links ALTER COLUMN resolution SET NOT NULL;

ANALYZE corpus.collections;
ANALYZE corpus.chapters;
ANALYZE corpus.hadiths;
ANALYZE corpus.narrators;
ANALYZE corpus.isnad_links;
ANALYZE corpus.hadith_translations;
ANALYZE corpus.rank_levels;

-- -----------------------------------------------------------------------------
-- Final reconciliation gate. These are the report's §ETL numbers and they are
-- unrecomputable after the DROP below, so they are already snapshotted into
-- corpus.etl_metrics by the ETL. This block only refuses to seal a corpus that
-- is visibly broken.
-- -----------------------------------------------------------------------------
DO $$
DECLARE v_orphan int; v_unres numeric; v_nochain int;
BEGIN
  SELECT count(*) INTO v_orphan FROM corpus.hadiths WHERE chapter_id IS NULL;
  IF v_orphan > 0 THEN
    RAISE WARNING '% hadiths have no chapter — check the chapter_seq load', v_orphan;
  END IF;

  SELECT round(100.0 * count(*) FILTER (WHERE resolution = 'X') / nullif(count(*),0), 2)
    INTO v_unres FROM corpus.isnad_links WHERE NOT is_compiler;
  RAISE NOTICE 'unresolved narrator positions: % percent', v_unres;

  SELECT count(*) INTO v_nochain
  FROM corpus.hadiths h
  WHERE NOT EXISTS (SELECT 1 FROM corpus.isnad_links l
                    WHERE l.hadith_id = h.hadith_id AND NOT l.is_compiler);
  IF v_nochain > 0 THEN
    RAISE NOTICE '% hadiths have no non-compiler chain (chain_strength returns NULL)', v_nochain;
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- Lockdown. "Read-only" becomes a permission, not a convention.
-- Assumes an application role named ilham_app; create it before running.
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ilham_app') THEN
    CREATE ROLE ilham_app LOGIN;
    RAISE NOTICE 'created role ilham_app (set a password before deploying)';
  END IF;
END $$;

GRANT USAGE ON SCHEMA corpus, app TO ilham_app;

REVOKE ALL ON ALL TABLES IN SCHEMA corpus FROM ilham_app;
GRANT SELECT ON ALL TABLES IN SCHEMA corpus TO ilham_app;
GRANT EXECUTE ON FUNCTION corpus.chain_strength(integer)    TO ilham_app;
GRANT EXECUTE ON FUNCTION corpus.normalize_arabic(text)     TO ilham_app;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA app TO ilham_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA app TO ilham_app;
-- Inheritance children are separate relations; the blanket grant above covers
-- them, but the shared sequence needs an explicit grant since users.user_id
-- defaults to nextval() on every subtype insert.
GRANT USAGE, SELECT ON SEQUENCE app.user_id_seq TO ilham_app;

-- The audit shadow table is append-only from the application's point of view.
REVOKE UPDATE, DELETE ON app.audit_log FROM ilham_app;

DROP SCHEMA staging CASCADE;

\echo '--- CORPUS SEALED, STAGING DROPPED ---'
