-- =============================================================================
-- ILHAM — 03_staging.sql
-- Transient ETL surface. Strict typed columns, not permissive all-text: the
-- source structure was characterised by sample inspection, so the types are
-- known. Type violations are caught by the Node preflight BEFORE the COPY, not
-- by loosening these columns — a strict COPY that aborts on one bad row is the
-- correct failure, provided something upstream reports the row first.
--
-- Division of labour: Node does STRUCTURAL flattening (nesting -> rows,
-- front-matter filter, "N - " prefix strip, transmission-word alignment,
-- chapter sequencing). SQL does ALL SEMANTIC shaping (dimension extraction,
-- resolution, normalisation, typed loads).
--
-- Dropped at the end of 05_post_load.sql.
-- =============================================================================

\set ON_ERROR_STOP on

-- Book manifest: slug -> real titles. Loaded as data rather than patched in
-- afterwards, so corpus.collections is correct on first insert.
CREATE TABLE staging.book_manifest (
    book_slug text PRIMARY KEY,
    title_ar  text NOT NULL,
    title_en  text
);

CREATE TABLE staging.hadiths (
    hadith_id   integer PRIMARY KEY,       -- mainId
    book_slug   text NOT NULL REFERENCES staging.book_manifest,
    chapter_seq smallint NOT NULL,         -- ADDED: source order of first appearance.
                                           -- Chapter identity cannot be the title:
                                           -- many chapters are titled bare باب and
                                           -- would collapse under SELECT DISTINCT.
    chapter_ar  text NOT NULL,
    hadith_num  text NOT NULL,             -- front-matter ('') filtered by loader
    text_plain  text NOT NULL,             -- "N - " prefix stripped by loader
    text_diac   text NOT NULL,
    matn_plain  text,
    matn_diac   text,
    sanad_count smallint NOT NULL CHECK (sanad_count >= 1),
    raw_doc     text                       -- original JSON string, inert. Debug
                                           -- window only, never read by a
                                           -- transform. Recovers shape evidence
                                           -- without JSON operators.
);
CREATE INDEX ON staging.hadiths (book_slug, chapter_seq);

CREATE TABLE staging.chain_rows (          -- flattened chain_of_narrators
    hadith_id         integer  NOT NULL REFERENCES staging.hadiths,
    sanad_no          smallint NOT NULL,
    position          smallint NOT NULL,   -- propagation order (Companion = 1)
    raw_name          text NOT NULL,       -- canonical disambiguated string
    transmission_word text,                -- NULL where multi-sanad alignment
                                           -- is ambiguous (loader logs it)
    is_compiler       boolean NOT NULL,
    PRIMARY KEY (hadith_id, sanad_no, position)
);

-- Consumed ONLY by resolution Pass B (positional zip). Never loaded into corpus.
CREATE TABLE staging.mentions (
    hadith_id     integer  NOT NULL REFERENCES staging.hadiths,
    mention_order smallint NOT NULL,
    surface_plain text NOT NULL,
    surface_diac  text NOT NULL,
    narrator_id   integer  NOT NULL,       -- NO FK: may reference a narrator
                                           -- absent from the profile file. Pass B
                                           -- joins through corpus.narrators to
                                           -- filter orphans rather than aborting.
    PRIMARY KEY (hadith_id, mention_order)
);

CREATE TABLE staging.narrators (           -- flattened ifta_narrators.json
    narrator_id        integer PRIMARY KEY,
    display_name       text NOT NULL,
    name               text NOT NULL,
    kunya              text,
    nickname           text,
    lineage            text,
    relation           text,
    tabaqa_raw         text,
    school             text,
    rank_ibn_hajar_raw text,
    rank_dhahabi_raw   text,
    date_of_death      text
);

-- Curated during ETL: normalised raw rijal string -> rank_code. Lives in
-- staging because it is applied once and never read at runtime — narrators
-- reference corpus.rank_levels directly. Kept in the DDL as the record of the
-- mapping decisions, then dropped with the rest of staging.
--
-- match_kind exists because the grades are COMPOUND verdicts: the grade word is
-- the first token and everything after it is qualification
-- ('ثقة حافظ فقيه , إمام حجة إلا أنه تغير حفظه بأخرة'). Matching the whole
-- string treats every distinct qualification as a distinct grade, which needs
-- ~1,300 map entries to cover 99% of Ibn Hajar rather than ~55.
--   'exact' -- whole normalised string must equal raw_string. Curated entries
--              win, so a nuanced verdict can be pinned away from its first token.
--   'token' -- first whitespace-delimited token equals raw_string. The fallback.
CREATE TABLE staging.rank_map (
    raw_string text PRIMARY KEY,           -- normalize_arabic() already applied
    rank_code  text NOT NULL REFERENCES corpus.rank_levels,
    match_kind text NOT NULL DEFAULT 'exact'
                   CHECK (match_kind IN ('exact','token'))
);
CREATE INDEX ON staging.rank_map (match_kind);

-- Per-narrator grade overrides, applied last and by narrator_id rather than by
-- string.
--
-- The rijal literature writes ENCOMIUM for the eminent instead of grading them:
-- Ibn Hajar on Abu Hurayra is 'الصحابي الجليل ، حافظ الصحابة', on al-Zuhri
-- 'الفقيه الحافظ ، متفق على جلالته'. Neither is a gradeable verdict, because
-- grading presupposes doubt and there is none to express.
--
-- That matters disproportionately: 178 narrators carry 16.8% of all chain
-- positions in Bukhari+Muslim, and they are the giants (al-Zuhri 2,209
-- mentions, Abu Hurayra 2,336, Aisha 1,616, Malik 1,033). chain_strength is
-- weakest-link, so one uncoded al-Zuhri at the neutral 0.50 CAPS the whole
-- chain -- scoring the strongest isnads lowest. An inversion, not a gap.
--
-- `note` is not decoration: every row here is a scholarly assertion about a
-- named person and must be defensible line-by-line (report req 9).
CREATE TABLE staging.narrator_rank_override (
    narrator_id integer NOT NULL,
    scholar     text NOT NULL CHECK (scholar IN ('ibn_hajar','dhahabi')),
    rank_code   text NOT NULL REFERENCES corpus.rank_levels,
    note        text NOT NULL,
    PRIMARY KEY (narrator_id, scholar)
);

-- WAS MISSING FROM THE DRAFT: referenced by the translation transform but never
-- created. Optional feeder; the load runs to completion without it.
--
-- The key is a surrogate, NOT (book_slug, hadith_num). Two reasons, both
-- measured against the real LK-Hadith-Corpus:
--
--   1. hadith_num is not unique in LK. Bukhari repeats 19 numbers across 39
--      rows, and 129 more rows carry a RANGE ('3450-3451-3452') where LK merged
--      what Ifta splits. A (book_slug, hadith_num) primary key aborts the COPY.
--   2. hadith_num is not a join key either. LK numbers Muslim 1..7314
--      sequentially; Ifta uses the traditional grouped 1..3033. Of the Muslim
--      hadiths that match on TEXT, 100.0% carry a different number (6,755 of
--      6,758), and 32.1% of Bukhari's do. Joining on the number attaches the
--      wrong English to a real hadith, silently.
--
-- So arabic_text is carried into staging and the join is made on normalised
-- Arabic text (see etl/sql/14_translations.sql). hadith_num is kept only as a
-- reported cross-check, never as a key.
CREATE TABLE staging.lk_hadiths (
    lk_row_id    integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    book_slug    text NOT NULL,
    hadith_num   text,               -- nullable: LK ranges are not numbers
    text_en      text NOT NULL,
    arabic_text  text NOT NULL,      -- the join key's source
    arabic_matn  text                -- nullable: absent on 530 LK rows
);
CREATE INDEX ON staging.lk_hadiths (book_slug);

-- -----------------------------------------------------------------------------
-- Text-matching helpers for the translation join. They live in staging, not
-- corpus: nothing reads them at runtime and they drop with the schema — the
-- same rule staging.rank_map follows.
-- -----------------------------------------------------------------------------

-- match_key: normalize_arabic, then discard everything that is not an Arabic
-- letter. Ifta and LK punctuate, space and vocalise differently; only the letter
-- sequence is common to both editions.
CREATE FUNCTION staging.match_key(p_text text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
    SELECT regexp_replace(corpus.normalize_arabic(coalesce(p_text, '')),
                          '[^ء-ي]', '', 'g')
$$;

-- anchor: cut everything before the first narration verb.
--
-- Ifta prepends the باب chapter heading to text_plain on 4,462 hadiths, often
-- followed by a Qur'anic or commentary preamble that is NOT in chapters.title_ar
-- and so cannot be stripped by comparing against it. LK stores the hadith alone.
-- Both editions begin the hadith proper at the same word, so cutting there is
-- symmetric: it removes Ifta's preamble and leaves LK untouched. Measured: the
-- match rate rises from 53% to 90% on this one step.
CREATE FUNCTION staging.anchor(p_text text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
    SELECT CASE WHEN p IS NULL OR p = 0 THEN p_text ELSE substr(p_text, p) END
    FROM (SELECT min(x) FILTER (WHERE x > 0) FROM unnest(ARRAY[
              position('حدثنا'  in p_text), position('حدثني'  in p_text),
              position('اخبرنا' in p_text), position('اخبرني' in p_text),
              position('انبانا' in p_text), position('سمعت'   in p_text)
          ]) x) s(p)
$$;

-- -----------------------------------------------------------------------------
-- name_index — the fix for the draft's non-deterministic Pass A.
--
-- The draft did:
--     UPDATE corpus.isnad_links l SET narrator_id = n.narrator_id
--     FROM corpus.narrators n WHERE n.name_norm = normalize_arabic(l.raw_name);
--
-- name_norm has no unique constraint and cannot have one: 21K narrators after
-- diacritic-stripping and alef-unification collide heavily. When UPDATE ... FROM
-- finds several matching n rows, Postgres silently picks an arbitrary one — so
-- that statement assigns narrator identity by coin flip and stamps it 'A', the
-- path the report presents as trustworthy.
--
-- Materialising the candidate count first makes ambiguity visible and lets
-- resolution fire only where the match is unique.
-- -----------------------------------------------------------------------------
CREATE TABLE staging.name_index (
    name_norm   text PRIMARY KEY,
    narrator_id integer NOT NULL,          -- meaningful only when n_cand = 1
    n_cand      integer NOT NULL
);

-- Rejects: nothing is dropped silently. Two payoffs — real data-quality numbers
-- for the report, and when counts fail to reconcile you know exactly where the
-- rows leaked.
CREATE TABLE staging.rejects (
    reject_id  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    stage      text NOT NULL,
    reason     text NOT NULL,
    source_key text,
    payload    text,
    logged_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON staging.rejects (stage, reason);

-- A-vs-B disagreement report. The draft folded this into the Pass B UPDATE, but
-- that statement's WHERE clause contains `l.narrator_id IS NULL` while Pass A
-- always sets narrator_id when it sets 'A' — so the cross-check branch was
-- unreachable. The agreement rate between two independent resolution methods is
-- the most credible validation number in the load; it gets its own table.
CREATE TABLE staging.resolution_conflicts (
    hadith_id   integer NOT NULL,
    sanad_no    smallint NOT NULL,
    position    smallint NOT NULL,
    raw_name    text NOT NULL,
    a_narrator  integer,
    b_narrator  integer,
    PRIMARY KEY (hadith_id, sanad_no, position)
);
