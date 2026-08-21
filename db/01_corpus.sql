-- =============================================================================
-- ILHAM — 01_corpus.sql
-- Read-only reference layer. Mirrors corpus.dot one-for-one:
--   strong entities  -> Collection, Chapter, Hadith, Narrator, RankLevel
--   weak entities    -> IsnadLink (hadith + sanad_no + position)
--                       Translation (hadith + lang)
--   derived attrs    -> Narrator.name_norm (generated), Hadith.chain_strength (fn)
-- =============================================================================

\set ON_ERROR_STOP on

-- -----------------------------------------------------------------------------
-- Collection
-- -----------------------------------------------------------------------------
CREATE TABLE corpus.collections (
    collection_id smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    slug          text NOT NULL UNIQUE,
    title_ar      text NOT NULL,
    title_en      text
);

-- -----------------------------------------------------------------------------
-- Chapter
--
-- CHANGED FROM DRAFT: identity is (collection_id, seq), not (collection_id,
-- title_ar). Hadith collections routinely carry many chapters titled bare باب;
-- keying on the title makes SELECT DISTINCT collapse them into one row and
-- misfiles every hadith beneath them, irreversibly. The loader supplies seq
-- from source order, which is the only identity the source actually provides.
-- title_ar stays as a plain (non-unique) attribute, matching corpus.dot.
-- -----------------------------------------------------------------------------
CREATE TABLE corpus.chapters (
    chapter_id    integer  GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    collection_id smallint NOT NULL REFERENCES corpus.collections,
    seq           smallint NOT NULL,
    title_ar      text NOT NULL,
    UNIQUE (collection_id, seq)
);
CREATE INDEX ON corpus.chapters (collection_id, title_ar);

-- -----------------------------------------------------------------------------
-- Hadith
-- chapter_id stays nullable: the ETL LEFT JOINs to chapters, so a hadith whose
-- chapter failed to materialise lands with a NULL rather than vanishing.
-- -----------------------------------------------------------------------------
CREATE TABLE corpus.hadiths (
    hadith_id     integer PRIMARY KEY,            -- Ifta mainId (natural key)
    collection_id smallint NOT NULL REFERENCES corpus.collections,
    chapter_id    integer  REFERENCES corpus.chapters,
    hadith_num    text NOT NULL,                  -- text: compound numbering exists
    text_plain    text NOT NULL,
    text_diac     text NOT NULL,
    matn_plain    text,                           -- NULL = sanad/matn not split
    matn_diac     text,
    sanad_count   smallint NOT NULL DEFAULT 1 CHECK (sanad_count >= 1)
);
CREATE INDEX ON corpus.hadiths (collection_id, hadith_num);
CREATE INDEX ON corpus.hadiths (chapter_id);
-- NOTE: the matn normalisation index is deliberately NOT here. It is an
-- expression index that nothing reads during the load, so maintaining it
-- through the bulk COPY buys nothing. Built in 05_post_load.sql.
-- Current load is 14,901 hadiths (Bukhari + Muslim); the full Ifta dataset is
-- 276K across 33 books, which is the scale this defers against.

-- -----------------------------------------------------------------------------
-- RankLevel — the ordinal scale. Raw rijal strings are NOT here; the raw->code
-- lookup is a load-time concern living in staging.rank_map.
-- -----------------------------------------------------------------------------
CREATE TABLE corpus.rank_levels (
    rank_code text PRIMARY KEY,
    label_ar  text NOT NULL,
    ordinal   smallint NOT NULL UNIQUE,           -- higher = stronger
    weight    numeric(3,2) NOT NULL CHECK (weight BETWEEN 0 AND 1)
);

-- -----------------------------------------------------------------------------
-- Narrator
-- -----------------------------------------------------------------------------
CREATE TABLE corpus.narrators (
    narrator_id        integer PRIMARY KEY,       -- Ifta narrator_id
    display_name       text NOT NULL,
    name               text NOT NULL,
    name_norm          text GENERATED ALWAYS AS (corpus.normalize_arabic(name)) STORED,
    display_norm       text GENERATED ALWAYS AS (corpus.normalize_arabic(display_name)) STORED,
    name_en            text,                      -- MIS, after validation match
    kunya              text,
    lineage            text,
    relation           text,
    tabaqa_raw         text,
    school             text,
    rank_ibn_hajar_raw text,                      -- kept for display honesty
    rank_dhahabi_raw   text,
    rank_ibn_hajar     text REFERENCES corpus.rank_levels,   -- code, for arithmetic
    rank_dhahabi       text REFERENCES corpus.rank_levels,
    -- HOW each code was derived. Same honesty argument as isnad_links.resolution:
    -- collapsing four very different derivations into one column turns a
    -- defensible number into an unexplained one.
    --   E = exact whole-string match against staging.rank_map
    --   T = first-token match      (compound verdicts: 'ثقة حافظ فقيه' -> thiqa)
    --   S = tabaqa says Companion  (the sources praise the eminent, never grade them)
    --   O = per-narrator override  (staging.narrator_rank_override, with a note)
    rank_ibn_hajar_via char(1) CHECK (rank_ibn_hajar_via IN ('E','T','S','O')),
    rank_dhahabi_via   char(1) CHECK (rank_dhahabi_via   IN ('E','T','S','O')),
    date_of_death      text,
    is_placeholder     boolean NOT NULL DEFAULT false        -- [راو موضع إبهام]
);
-- display_norm added because chain strings are disambiguated forms and may sit
-- closer to display_name than to name. Resolution tries both (see 12_resolve).
CREATE INDEX ON corpus.narrators (name_norm);
CREATE INDEX ON corpus.narrators (display_norm);
CREATE INDEX ON corpus.narrators (rank_ibn_hajar);
CREATE INDEX ON corpus.narrators (rank_dhahabi);

-- -----------------------------------------------------------------------------
-- IsnadLink — weak entity. Path model is the source of truth; edges are derived.
--
-- resolution codes (widened from the draft's A/B/X):
--   A = matched on a canonical name that was UNIQUE among narrators
--   B = matched by positional zip against mentions (single-sanad only)
--   C = name matched, but ambiguously (>1 narrator shares the normalised form)
--   X = no match at all
-- C exists because collapsing it into X destroys the most interesting data
-- quality number in the whole load: how much of the corpus is unresolvable
-- because the name is absent vs. because the name is not discriminating.
-- -----------------------------------------------------------------------------
CREATE TABLE corpus.isnad_links (
    hadith_id         integer  NOT NULL REFERENCES corpus.hadiths,
    sanad_no          smallint NOT NULL,
    position          smallint NOT NULL CHECK (position >= 1),
    narrator_id       integer  REFERENCES corpus.narrators,   -- NULL = unresolved
    raw_name          text NOT NULL,
    transmission_word text,
    transmission_norm text GENERATED ALWAYS AS
                        (corpus.normalize_arabic(transmission_word)) STORED,
    is_compiler       boolean NOT NULL DEFAULT false,
    resolution        char(1) CHECK (resolution IN ('A','B','C','X')),
    PRIMARY KEY (hadith_id, sanad_no, position)
);
CREATE INDEX ON corpus.isnad_links (narrator_id);
CREATE INDEX ON corpus.isnad_links (resolution);
-- transmission_norm is generated because chain_strength compares against it.
-- The draft compared raw text to 'عن', which never fires on vocalised عَنْ —
-- the an'ana penalty would have been silently dead on the whole corpus.

-- -----------------------------------------------------------------------------
-- Transmission edges: fully determined by paths, so a VIEW. Storing both would
-- be redundancy inviting drift. Direction: position runs in propagation order,
-- so from = teacher (earlier), to = student (later) — same convention as MIS,
-- which makes this view the join surface for MIS validation.
-- -----------------------------------------------------------------------------
CREATE VIEW corpus.isnad_edges AS
SELECT a.hadith_id,
       a.sanad_no,
       a.narrator_id AS from_narrator,
       a.raw_name    AS from_raw_name,
       b.narrator_id AS to_narrator,
       b.raw_name    AS to_raw_name,
       b.transmission_word,
       b.transmission_norm,
       b.is_compiler AS to_is_compiler
FROM corpus.isnad_links a
JOIN corpus.isnad_links b
  ON b.hadith_id = a.hadith_id
 AND b.sanad_no  = a.sanad_no
 AND b.position  = a.position + 1;

-- -----------------------------------------------------------------------------
-- Translation — weak entity, source-tagged. One canonical translation per
-- (hadith, lang): the reader needs one English text, not a choice of three.
-- -----------------------------------------------------------------------------
-- match_via records HOW the translation was attached, on the same principle as
-- isnad_links.resolution and narrators.rank_*_via: a derived row must say how
-- confident it is. LK and Ifta share no usable identifier, so every row here is
-- the result of a text match and the tier is the evidence for it.
--
--   E  full normalised text identical         (strongest)
--   P  first 100 letters identical, 1:1
--   6  first 60 letters identical, 1:1
--   4  first 40 letters identical, 1:1
--   M  matn identical, 1:1                    (isnad differs between editions)
--
-- A hadith with no acceptable match simply has no row. It keeps its Arabic and
-- the reader sees Arabic — absence is the honest outcome, never a guess.
CREATE TABLE corpus.hadith_translations (
    hadith_id integer NOT NULL REFERENCES corpus.hadiths,
    lang      char(2) NOT NULL DEFAULT 'en' CHECK (lang ~ '^[a-z]{2}$'),
    text_full text NOT NULL,
    source    text NOT NULL DEFAULT 'LK',
    match_via char(1) CHECK (match_via IN ('E','P','6','4','M')),
    PRIMARY KEY (hadith_id, lang)
);

-- -----------------------------------------------------------------------------
-- ETL metrics — survives DROP SCHEMA staging on purpose.
-- Every reconciliation number quoted in the report is computed from staging,
-- which stops existing at the end of the load. Snapshot them here or they are
-- unrecomputable forever.
-- -----------------------------------------------------------------------------
CREATE TABLE corpus.etl_metrics (
    metric_id  integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    stage      text NOT NULL,
    metric     text NOT NULL,
    scope      text,                     -- collection slug, or NULL for global
    value_num  numeric,
    value_text text,
    recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON corpus.etl_metrics (stage, metric);

-- =============================================================================
-- chain_strength — weakest link per sanad, best sanad wins.
--   graded              -> min of the two scholars' weights
--   named but ungraded  -> 0.50   (ungraded is not the same as criticised)
--   placeholder/unnamed -> 0.15   (mubham genuinely weakens the chain)
--   an'ana link         -> -0.05
-- Compiler excluded. Returns 0..1, NULL when the hadith has no non-compiler links.
--
-- Aggregation, not recursion: positions are stored explicitly, so WITH RECURSIVE
-- here would be artificial (report §req8).
-- =============================================================================
CREATE FUNCTION corpus.chain_strength(p_hadith integer)
RETURNS numeric
LANGUAGE sql
STABLE
PARALLEL SAFE
AS $$
WITH link_weights AS (
  SELECT l.sanad_no,
         CASE
           WHEN l.narrator_id IS NULL OR n.is_placeholder THEN 0.15
           WHEN n.rank_ibn_hajar IS NULL AND n.rank_dhahabi IS NULL THEN 0.50
           ELSE least(coalesce(rh.weight, 1), coalesce(rd.weight, 1))
         END
         - CASE WHEN l.transmission_norm IN ('عن', 'وعن') THEN 0.05 ELSE 0 END
         AS w
  FROM corpus.isnad_links l
  LEFT JOIN corpus.narrators   n  ON n.narrator_id = l.narrator_id
  LEFT JOIN corpus.rank_levels rh ON rh.rank_code  = n.rank_ibn_hajar
  LEFT JOIN corpus.rank_levels rd ON rd.rank_code  = n.rank_dhahabi
  WHERE l.hadith_id = p_hadith
    AND NOT l.is_compiler
)
SELECT max(sanad_strength)
FROM (
  SELECT sanad_no, greatest(min(w), 0)::numeric(3,2) AS sanad_strength
  FROM link_weights
  GROUP BY sanad_no
) per_sanad;
$$;

COMMENT ON FUNCTION corpus.chain_strength IS
'Weakest-link isnad score, best sanad wins. Aggregation not recursion: positions are explicit.';
