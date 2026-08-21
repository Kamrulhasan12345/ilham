-- =============================================================================
-- ILHAM — 00_init.sql
-- Schemas + the one utility everything downstream depends on.
-- Run order: 00 -> 01 -> 02 -> 03 -> 04 -> (ETL) -> 05
-- Requires PostgreSQL 14+ (tested on 16). server_encoding must be UTF8.
-- =============================================================================

\set ON_ERROR_STOP on

DO $$ BEGIN
  IF current_setting('server_encoding') <> 'UTF8' THEN
    RAISE EXCEPTION 'server_encoding is %, must be UTF8 for Arabic corpus',
                    current_setting('server_encoding');
  END IF;
END $$;

DROP SCHEMA IF EXISTS staging CASCADE;
DROP SCHEMA IF EXISTS app     CASCADE;
DROP SCHEMA IF EXISTS corpus  CASCADE;

CREATE SCHEMA corpus;    -- read-only reference data
CREATE SCHEMA app;       -- OLTP: every runtime write
CREATE SCHEMA staging;   -- transient ETL surface, dropped after load

-- -----------------------------------------------------------------------------
-- normalize_arabic
--
-- Three changes from the draft, each load-bearing for narrator resolution:
--
--   1. btrim(). The whitespace regexp collapses interior runs but leaves the
--      edges, so ' علي ' normalized to ' علي ' and every equality join against
--      it silently missed. Verified on PG16 before the fix.
--   2. Combining range widened 064B-0652 -> 064B-065F. The original covered
--      fathatan..sukun only; maddah/hamza-above/below (0653-0655) and the
--      extended marks (0656-065F) appear in vocalised Ifta text and blocked
--      matches that should have succeeded.
--   3. Hamza carriers ؤ/ئ folded to و/ي. Sources disagree on carrier spelling
--      for the same narrator; not folding them splits one person into two.
--
-- The \uXXXX escapes are ARE (Postgres regex) escapes, not string escapes, and
-- require standard_conforming_strings=on so the backslash reaches the engine.
-- That is the default; the guard below fails loudly if it ever is not.
--
-- IMMUTABLE is required, not cosmetic: corpus.narrators.name_norm is a
-- GENERATED ... STORED column over this function, and stored generation rejects
-- anything weaker.
-- -----------------------------------------------------------------------------
DO $$ BEGIN
  IF current_setting('standard_conforming_strings') <> 'on' THEN
    RAISE EXCEPTION 'standard_conforming_strings must be on; regex \u escapes break otherwise';
  END IF;
END $$;

CREATE FUNCTION corpus.normalize_arabic(p_text text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
SELECT btrim(
  regexp_replace(
    translate(
      regexp_replace(
        regexp_replace(coalesce(p_text, ''),
          '[\u064B-\u065F\u0670\u0640]', '', 'g'),   -- harakat, dagger alif, tatweel
        '\s+', ' ', 'g'),                            -- collapse interior whitespace
      'أإآٱةىؤئ',                                    -- 8 chars in
      'اااا'  || 'ه' || 'ي' || 'و' || 'ي'),         -- 8 chars out
    '^[.,،؛:]+|[.,،؛:]+$', '', 'g')                 -- edge punctuation
)
$$;
COMMENT ON FUNCTION corpus.normalize_arabic IS
'Strips diacritics/tatweel, unifies alef variants and hamza carriers, ta-marbuta->ha, alef-maqsura->ya, trims, drops edge punctuation. Basis of narrator resolution (report §ETL).';

-- Self-test: fails the load rather than corrupting resolution silently.
DO $$
DECLARE v text;
BEGIN
  v := corpus.normalize_arabic('  مُحَمَّدُ   بْنُ  إِسْمَاعِيلَ  ');
  IF v <> 'محمد بن اسماعيل' THEN
    RAISE EXCEPTION 'normalize_arabic self-test failed: got [%]', v;
  END IF;
  IF corpus.normalize_arabic('abc 123') <> 'abc 123' THEN
    RAISE EXCEPTION 'normalize_arabic is eating ASCII: \u escapes not honoured';
  END IF;

  -- Edge punctuation. The Ifta rijal grades carry trailing full stops on a
  -- meaningful slice of rows -- 'ثقة.' (72 occurrences) against 'ثقة' (1422).
  -- Without this, 13_ranks.sql treats them as two different verdicts and ~350
  -- narrators silently lose their grade to a period.
  IF corpus.normalize_arabic('ثقة.') <> 'ثقه' THEN
    RAISE EXCEPTION 'normalize_arabic is not stripping trailing punctuation: got [%]',
                    corpus.normalize_arabic('ثقة.');
  END IF;
  IF corpus.normalize_arabic('، مالك ،') <> 'مالك' THEN
    RAISE EXCEPTION 'normalize_arabic is not stripping leading punctuation: got [%]',
                    corpus.normalize_arabic('، مالك ،');
  END IF;
  -- Interior punctuation must SURVIVE: it separates clauses in the compound
  -- verdicts that pass 2 tokenises, and appears inside narrator lineage strings.
  IF corpus.normalize_arabic('ثقة، حافظ') <> 'ثقه، حافظ' THEN
    RAISE EXCEPTION 'normalize_arabic is eating interior punctuation: got [%]',
                    corpus.normalize_arabic('ثقة، حافظ');
  END IF;
END $$;
