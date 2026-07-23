-- =============================================================================
-- ILHAM — Hadith Study Platform — PostgreSQL Schema
-- PERN stack. PostgreSQL 14+ assumed (any 11+ works for CREATE PROCEDURE).
-- Layers: staging (ETL only, dropped after load) | corpus (read-only) | app (OLTP)
-- Verify before loading Arabic: SHOW server_encoding;  -- must be UTF8
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS staging;   -- transient: flat typed tables, dropped post-ETL
CREATE SCHEMA IF NOT EXISTS corpus;    -- read-only reference data
CREATE SCHEMA IF NOT EXISTS app;       -- user/study layer (all runtime writes)

-- =============================================================================
-- 0. SHARED UTILITY — normalize_arabic
--    Used by: narrator resolution, rank/grade normalization, matn comparison
--    (spike #3), search. Written first; everything downstream depends on it.
-- =============================================================================

CREATE OR REPLACE FUNCTION corpus.normalize_arabic(p_text text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT translate(
           regexp_replace(
             regexp_replace(coalesce(p_text, ''),
               '[\u064B-\u0652\u0670\u0640]', '', 'g'),  -- harakat, dagger alif, tatweel
             '\s+', ' ', 'g'),                            -- collapse whitespace
           'أإآٱةى',                                       -- unify letter variants
           'اااا' || 'ه' || 'ي')
$$;

COMMENT ON FUNCTION corpus.normalize_arabic IS
'Strips diacritics/tatweel, unifies alef variants, ta-marbuta->ha, alef-maqsura->ya. Deliberate design decision documented in report §ETL.';

-- =============================================================================
-- 1. STAGING (flat typed tables; Node does structural flattening, SQL does all
--    semantic shaping. Dropped after load. NOTE: one Node pass emits ALL tables
--    per doc — never regenerate one without the others, or the positional
--    zip in resolution pass B silently misaligns.)
-- =============================================================================

CREATE TABLE staging.hadiths (
  hadith_id    integer PRIMARY KEY,      -- mainId
  book_slug    text NOT NULL,            -- from book_manifest.json
  chapter_ar   text NOT NULL,
  hadith_num   text NOT NULL,            -- front-matter ('') filtered by loader
  text_plain   text NOT NULL,            -- "N - " prefix stripped by loader
  text_diac    text NOT NULL,
  matn_plain   text,
  matn_diac    text,
  sanad_count  smallint NOT NULL,
  raw_doc      text                      -- original JSON string, inert; debug
                                         -- window only — never read by any
                                         -- transform. Recovers shape evidence
                                         -- (e.g. narration_words alignment
                                         -- disputes) without JSON operators.
);

CREATE TABLE staging.chain_rows (        -- flattened chain_of_narrators
  hadith_id    integer  NOT NULL,
  sanad_no     smallint NOT NULL,
  position     smallint NOT NULL,        -- propagation order (Companion = 1)
  raw_name     text NOT NULL,            -- canonical disambiguated string
  transmission_word text,                -- NULL where multi-sanad word
                                         -- alignment is ambiguous (loader logs)
  is_compiler  boolean NOT NULL,
  PRIMARY KEY (hadith_id, sanad_no, position)
);

CREATE TABLE staging.mentions (          -- flattened `names` triples, text order
  hadith_id     integer  NOT NULL,
  mention_order smallint NOT NULL,
  surface_plain text NOT NULL,
  surface_diac  text NOT NULL,
  narrator_id   integer NOT NULL,
  PRIMARY KEY (hadith_id, mention_order)
);

CREATE TABLE staging.narrators (         -- flattened ifta_narrators.json
  narrator_id integer PRIMARY KEY,
  display_name text NOT NULL,
  name         text NOT NULL,
  kunya        text, nickname text, lineage text, relation text,
  tabaqa_raw   text, school text,
  rank_ibn_hajar_raw text, rank_dhahabi_raw text,
  date_of_death text
);

-- =============================================================================
-- 2. CORPUS LAYER (read-only after seed; no runtime writes, ever)
-- =============================================================================

CREATE TABLE corpus.collections (
  collection_id  smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug           text NOT NULL UNIQUE,          -- manifest filename mapping
  title_ar       text NOT NULL,                 -- e.g. صحيح البخاري
  title_en       text                           -- optional (LK / manual)
);

CREATE TABLE corpus.chapters (
  chapter_id     integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  collection_id  smallint NOT NULL REFERENCES corpus.collections,
  title_ar       text NOT NULL,
  UNIQUE (collection_id, title_ar)
);

CREATE TABLE corpus.hadiths (
  hadith_id      integer PRIMARY KEY,           -- Ifta mainId (natural key)
  collection_id  smallint NOT NULL REFERENCES corpus.collections,
  chapter_id     integer  REFERENCES corpus.chapters,
  hadith_num     text NOT NULL,                 -- text: some books use compound nums
  text_plain     text NOT NULL,                 -- "N - " prefix stripped in ETL
  text_diac      text NOT NULL,
  matn_plain     text,                          -- 87.8% coverage; NULL = not split
  matn_diac      text,
  sanad_count    smallint NOT NULL DEFAULT 1
);
CREATE INDEX ON corpus.hadiths (collection_id, hadith_num);
CREATE INDEX hadiths_matn_norm_idx ON corpus.hadiths
  (corpus.normalize_arabic(left(matn_plain, 200)));   -- spike-3 join aid

-- Rank normalization: raw rijal strings -> ordinal scale (mapping table is
-- itself deliverable schema work; raw strings retained for display honesty).
CREATE TABLE corpus.rank_levels (
  rank_code   text PRIMARY KEY,       -- 'thiqa', 'saduq', 'maqbul', 'daif', ...
  label_ar    text NOT NULL,
  ordinal     smallint NOT NULL,      -- higher = stronger
  weight      numeric(3,2) NOT NULL CHECK (weight BETWEEN 0 AND 1)
);

CREATE TABLE corpus.rank_map (         -- populated during ETL curation
  raw_string  text PRIMARY KEY,        -- normalized raw rank text
  rank_code   text NOT NULL REFERENCES corpus.rank_levels
);

CREATE TABLE corpus.narrators (
  narrator_id      integer PRIMARY KEY,          -- Ifta narrator_id
  display_name     text NOT NULL,
  name             text NOT NULL,
  name_norm        text GENERATED ALWAYS AS (corpus.normalize_arabic(name)) STORED,
  name_en          text,                         -- from MIS after validation match
  kunya            text,
  lineage          text,
  relation         text,
  tabaqa_raw       text,                         -- class_of_narrators (free text)
  school           text,
  rank_ibn_hajar_raw   text,                     -- raw, for display
  rank_dhahabi_raw     text,
  rank_ibn_hajar   text REFERENCES corpus.rank_levels,  -- normalized via rank_map
  rank_dhahabi     text REFERENCES corpus.rank_levels,
  date_of_death    text,
  is_placeholder   boolean NOT NULL DEFAULT false -- [راو موضع إبهام] etc.
);
CREATE INDEX ON corpus.narrators (name_norm);

-- Isnad links: one row per (hadith, sanad, position). Propagation order:
-- position 1 = Companion/source ... last = compiler (kept, flagged).
CREATE TABLE corpus.isnad_links (
  hadith_id     integer  NOT NULL REFERENCES corpus.hadiths,
  sanad_no      smallint NOT NULL,
  position      smallint NOT NULL,
  narrator_id   integer  REFERENCES corpus.narrators,  -- NULL = unresolved
  raw_name      text NOT NULL,                         -- canonical chain string
  transmission_word text,                              -- حدثنا / أخبرني / عن ...
  is_compiler   boolean NOT NULL DEFAULT false,        -- last position
  resolution    char(1) CHECK (resolution IN ('A','B','X')), -- A=name, B=positional, X=unresolved
  PRIMARY KEY (hadith_id, sanad_no, position)
);
CREATE INDEX ON corpus.isnad_links (narrator_id);

-- ---------------------------------------------------------------------------
-- GRAPH MODEL: paths stored, edges derived.
-- The path model (position-indexed rows above) is the source of truth: it
-- matches the source data exactly and keeps ordering first-class. Transmission
-- EDGES (teacher -> student per link) are fully determined by paths, so they
-- are a VIEW, not a table — storing both would be redundancy inviting drift.
-- A narrator's "teachers" are per-(hadith, sanad) facts, not attributes of the
-- narrator row: a self-FK (teacher_narrator_id) could not model M:N-per-chain.
-- Direction: position runs in propagation order, so from = teacher (earlier),
-- to = student (later) — same convention as MIS edges; this view IS the join
-- surface for the MIS validation check.
-- Global teacher/student network = GROUP BY from_narrator, to_narrator.
-- Upgrade path if hot: CREATE MATERIALIZED VIEW + REFRESH after seed.
-- ---------------------------------------------------------------------------
CREATE VIEW corpus.isnad_edges AS
SELECT a.hadith_id,
       a.sanad_no,
       a.narrator_id AS from_narrator,     -- teacher side (earlier position)
       a.raw_name    AS from_raw_name,
       b.narrator_id AS to_narrator,       -- student side (later position)
       b.raw_name    AS to_raw_name,
       b.transmission_word,                -- word governing this link
       b.is_compiler AS to_is_compiler     -- filter for analytics
FROM corpus.isnad_links a
JOIN corpus.isnad_links b
  ON b.hadith_id = a.hadith_id
 AND b.sanad_no  = a.sanad_no
 AND b.position  = a.position + 1;

-- Surface mentions (from `names`): kept for search + resolution audit.
CREATE TABLE corpus.hadith_mentions (
  hadith_id     integer NOT NULL REFERENCES corpus.hadiths,
  mention_order smallint NOT NULL,
  surface_plain text NOT NULL,
  surface_diac  text NOT NULL,
  narrator_id   integer REFERENCES corpus.narrators,
  PRIMARY KEY (hadith_id, mention_order)
);

CREATE TABLE corpus.hadith_subjects (
  hadith_id  integer NOT NULL REFERENCES corpus.hadiths,
  subject    text NOT NULL,
  PRIMARY KEY (hadith_id, subject)
);

-- English text where LK numbering aligns (optional enrichment).
CREATE TABLE corpus.hadith_translations (
  hadith_id  integer NOT NULL REFERENCES corpus.hadiths,
  lang       char(2) NOT NULL DEFAULT 'en',
  text_full  text NOT NULL,
  source     text NOT NULL DEFAULT 'LK',
  PRIMARY KEY (hadith_id, lang)
);

-- =============================================================================
-- 3. ETL TRANSFORMS (staging -> corpus; run once; staging dropped afterwards)
--    Division of labor: Node did structural flattening (nesting -> rows,
--    front-matter filter, prefix strip, word alignment); SQL does ALL semantic
--    shaping: dimension extraction, resolution, normalization, typed loads.
-- =============================================================================

-- 3.0 Dimensions derived from staging
-- INSERT INTO corpus.collections (slug, title_ar)
-- SELECT DISTINCT book_slug, book_slug FROM staging.hadiths;  -- titles fixed from manifest
-- INSERT INTO corpus.chapters (collection_id, title_ar)
-- SELECT DISTINCT c.collection_id, s.chapter_ar
-- FROM staging.hadiths s JOIN corpus.collections c ON c.slug = s.book_slug;

-- 3.1 hadiths (plain join; loader already filtered and stripped)
-- INSERT INTO corpus.hadiths (hadith_id, collection_id, chapter_id, hadith_num,
--                             text_plain, text_diac, matn_plain, matn_diac, sanad_count)
-- SELECT s.hadith_id, c.collection_id, ch.chapter_id, s.hadith_num,
--        s.text_plain, s.text_diac, s.matn_plain, s.matn_diac, s.sanad_count
-- FROM staging.hadiths s
-- JOIN corpus.collections c ON c.slug = s.book_slug
-- JOIN corpus.chapters ch   ON ch.collection_id = c.collection_id
--                          AND ch.title_ar = s.chapter_ar;

-- 3.2 narrators, mentions, isnad_links: near-verbatim copies
-- INSERT INTO corpus.narrators (narrator_id, display_name, name, kunya, ...,
--                               is_placeholder)
-- SELECT narrator_id, display_name, name, kunya, ...,
--        name ~ '^\[.*\]$'                    -- bracketed = placeholder (مبهم)
-- FROM staging.narrators;
--
-- INSERT INTO corpus.hadith_mentions SELECT * FROM staging.mentions;
--
-- INSERT INTO corpus.isnad_links (hadith_id, sanad_no, position, raw_name,
--                                 transmission_word, is_compiler)
-- SELECT hadith_id, sanad_no, position, raw_name, transmission_word, is_compiler
-- FROM staging.chain_rows;

-- 3.3 Resolution pass A: canonical chain name -> profile name (any sanad count)
-- UPDATE corpus.isnad_links l
-- SET narrator_id = n.narrator_id, resolution = 'A'
-- FROM corpus.narrators n
-- WHERE l.narrator_id IS NULL
--   AND n.name_norm = corpus.normalize_arabic(l.raw_name);

-- 3.4 Resolution pass B: positional zip (single-sanad hadiths only).
--     Chain reversed minus compiler aligns 1:1 with mentions in text order:
--     mention_order m  <->  position (chain_len - m), where chain_len excludes
--     the compiler. Cross-checks pass A where both resolve; fills gaps.
-- UPDATE corpus.isnad_links l
-- SET narrator_id = m.narrator_id,
--     resolution  = CASE WHEN l.resolution = 'A'
--                        AND l.narrator_id <> m.narrator_id THEN l.resolution
--                        ELSE 'B' END      -- disagreement: keep A, log below
-- FROM corpus.hadiths h, corpus.hadith_mentions m
-- WHERE h.hadith_id = l.hadith_id AND h.sanad_count = 1
--   AND m.hadith_id = l.hadith_id
--   AND NOT l.is_compiler
--   AND m.mention_order = (SELECT max(position) - 1 FROM corpus.isnad_links x
--                          WHERE x.hadith_id = l.hadith_id) + 1 - l.position
--   AND l.narrator_id IS NULL;
--
-- Disagreement report (A vs B), unresolved report (resolution IS NULL -> 'X'):
-- both dumped to a log table / CSV; rates quoted in the report.

-- =============================================================================
-- 4. REQ 5 — FUNCTION: chain_strength
--    Weakest-link per sanad; best sanad wins. Three-way narrator treatment:
--      graded  -> rank weight (min of the two scholars where both exist)
--      ungraded (named) -> neutral 0.5   (ungraded ≠ criticized)
--      placeholder/unnamed -> 0.15       (mubham weakens the chain)
--    ʿanʿana penalty: links transmitted by عن lose 0.05.
--    Compiler position excluded. Returns numeric 0..1 (NULL if no chains).
--    NOTE: positions are stored explicitly, so aggregation—not recursion—is the
--    appropriate mechanism (req 8: no artificial WITH RECURSIVE here).
-- =============================================================================

CREATE OR REPLACE FUNCTION corpus.chain_strength(p_hadith integer)
RETURNS numeric
LANGUAGE sql
STABLE
AS $$
  WITH link_weights AS (
    SELECT l.sanad_no,
           CASE
             WHEN n.is_placeholder OR l.narrator_id IS NULL THEN 0.15
             WHEN n.rank_ibn_hajar IS NULL AND n.rank_dhahabi IS NULL THEN 0.50
             ELSE least(coalesce(rh.weight, 1), coalesce(rd.weight, 1))
           END
           - CASE WHEN l.transmission_word IN ('عن') THEN 0.05 ELSE 0 END
           AS w
    FROM corpus.isnad_links l
    LEFT JOIN corpus.narrators   n  ON n.narrator_id = l.narrator_id
    LEFT JOIN corpus.rank_levels rh ON rh.rank_code = n.rank_ibn_hajar
    LEFT JOIN corpus.rank_levels rd ON rd.rank_code = n.rank_dhahabi
    WHERE l.hadith_id = p_hadith
      AND NOT l.is_compiler
  )
  SELECT max(sanad_strength) FROM (
    SELECT sanad_no, greatest(min(w), 0)::numeric(3,2) AS sanad_strength
    FROM link_weights GROUP BY sanad_no
  ) per_sanad;
$$;

-- =============================================================================
-- 5. APP LAYER (OLTP — all runtime writes live here)
-- =============================================================================

CREATE TABLE app.users (
  user_id       integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email         text NOT NULL UNIQUE,
  password_hash text NOT NULL,                   -- bcrypt, in-house auth (req 1)
  full_name     text NOT NULL,
  role          text NOT NULL CHECK (role IN ('student','teacher','admin')),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE app.circles (
  circle_id   integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  teacher_id  integer NOT NULL REFERENCES app.users,
  name        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE app.enrollments (
  circle_id   integer NOT NULL REFERENCES app.circles,
  student_id  integer NOT NULL REFERENCES app.users,
  enrolled_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (circle_id, student_id)
);

CREATE TABLE app.study_sets (
  set_id     integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  owner_id   integer NOT NULL REFERENCES app.users,
  name       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE app.set_items (
  set_id     integer NOT NULL REFERENCES app.study_sets,
  hadith_id  integer NOT NULL REFERENCES corpus.hadiths,
  PRIMARY KEY (set_id, hadith_id)
);

CREATE TABLE app.assignments (
  assignment_id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  circle_id     integer NOT NULL REFERENCES app.circles,
  set_id        integer NOT NULL REFERENCES app.study_sets,
  due_date      date NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE app.assignment_targets (
  assignment_id integer NOT NULL REFERENCES app.assignments,
  student_id    integer NOT NULL REFERENCES app.users,
  status        text NOT NULL DEFAULT 'assigned'
                CHECK (status IN ('assigned','in_progress','submitted','reviewed')),
  PRIMARY KEY (assignment_id, student_id)
);

CREATE TABLE app.progress (
  student_id    integer NOT NULL REFERENCES app.users,
  hadith_id     integer NOT NULL REFERENCES corpus.hadiths,
  mastery       smallint NOT NULL DEFAULT 0 CHECK (mastery BETWEEN 0 AND 4),
  times_reviewed integer NOT NULL DEFAULT 0,
  last_reviewed timestamptz,
  PRIMARY KEY (student_id, hadith_id)
);

CREATE TABLE app.review_sessions (
  session_id  integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  student_id  integer NOT NULL REFERENCES app.users,
  reviewer_id integer REFERENCES app.users,      -- NULL = self-study
  circle_id   integer REFERENCES app.circles,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE app.review_items (
  session_id integer NOT NULL REFERENCES app.review_sessions,
  hadith_id  integer NOT NULL REFERENCES corpus.hadiths,
  result     text NOT NULL CHECK (result IN ('pass','partial','fail')),
  PRIMARY KEY (session_id, hadith_id)
);

CREATE TABLE app.student_stats (                  -- trigger-maintained (req 4a)
  student_id     integer PRIMARY KEY REFERENCES app.users,
  mastered_count integer NOT NULL DEFAULT 0,
  review_count   integer NOT NULL DEFAULT 0,
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE app.notes (
  note_id    integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id    integer NOT NULL REFERENCES app.users,
  hadith_id  integer NOT NULL REFERENCES corpus.hadiths,
  body       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE app.audit_log (                      -- shadow table (req 4b)
  audit_id   bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  table_name text NOT NULL,
  row_key    text NOT NULL,
  changed_by integer,                             -- set via set_config in API
  old_value  jsonb,
  new_value  jsonb,
  changed_at timestamptz NOT NULL DEFAULT now()
);

-- =============================================================================
-- 6. REQ 4 — TRIGGERS
-- =============================================================================

-- 4a: derived stats — recompute-and-store on progress change (derived value =
--     the appropriate trigger use; app never maintains these counts).
CREATE OR REPLACE FUNCTION app.sync_student_stats()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO app.student_stats (student_id, mastered_count, review_count, updated_at)
  SELECT NEW.student_id,
         count(*) FILTER (WHERE mastery >= 3),
         coalesce(sum(times_reviewed), 0),
         now()
  FROM app.progress WHERE student_id = NEW.student_id
  ON CONFLICT (student_id) DO UPDATE
    SET mastered_count = EXCLUDED.mastered_count,
        review_count   = EXCLUDED.review_count,
        updated_at     = EXCLUDED.updated_at;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_progress_stats
AFTER INSERT OR UPDATE ON app.progress
FOR EACH ROW EXECUTE FUNCTION app.sync_student_stats();

-- 4b: audit — log mastery changes (teacher overrides included) to shadow table.
CREATE OR REPLACE FUNCTION app.audit_progress()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.mastery IS DISTINCT FROM OLD.mastery THEN
    INSERT INTO app.audit_log (table_name, row_key, changed_by, old_value, new_value)
    VALUES ('app.progress',
            OLD.student_id || ':' || OLD.hadith_id,
            nullif(current_setting('ilham.user_id', true), '')::int,
            jsonb_build_object('mastery', OLD.mastery),
            jsonb_build_object('mastery', NEW.mastery));
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_progress_audit
AFTER UPDATE ON app.progress
FOR EACH ROW EXECUTE FUNCTION app.audit_progress();
-- API sets actor per-connection: SELECT set_config('ilham.user_id', $1, false);

-- =============================================================================
-- 7. REQ 6 — PROCEDURE: assign_study_set (multi-table fan-out, owns its txn)
--    PROCEDURE (not function) precisely because it controls the transaction:
--    Postgres functions cannot COMMIT; procedures can (req 6 vs req 5 line).
-- =============================================================================

CREATE OR REPLACE PROCEDURE app.assign_study_set(
  p_circle integer, p_set integer, p_due date)
LANGUAGE plpgsql AS $$
DECLARE v_assignment integer;
BEGIN
  INSERT INTO app.assignments (circle_id, set_id, due_date)
  VALUES (p_circle, p_set, p_due)
  RETURNING assignment_id INTO v_assignment;

  INSERT INTO app.assignment_targets (assignment_id, student_id)
  SELECT v_assignment, e.student_id
  FROM app.enrollments e WHERE e.circle_id = p_circle;

  INSERT INTO app.progress (student_id, hadith_id)     -- init rows, keep existing
  SELECT e.student_id, si.hadith_id
  FROM app.enrollments e
  CROSS JOIN app.set_items si
  WHERE e.circle_id = p_circle AND si.set_id = p_set
  ON CONFLICT (student_id, hadith_id) DO NOTHING;

  COMMIT;   -- explicit transaction control (req 3): all-or-nothing fan-out
EXCEPTION WHEN OTHERS THEN
  ROLLBACK;
  RAISE;
END $$;

-- Req 3 also demonstrated at the API layer: POST /review-sessions wraps
-- (insert session -> insert items -> update progress) in BEGIN/COMMIT/ROLLBACK
-- via node-postgres; triggers 4a/4b fire inside that transaction.

-- =============================================================================
-- 8. REQ 7 — THE COMPLEX QUERIES (analytics pages)
-- =============================================================================

-- Q1 Top Narrators (placeholder + compiler excluded)
-- SELECT n.narrator_id, coalesce(n.name_en, n.display_name) AS narrator,
--        count(DISTINCT l.hadith_id) AS hadith_count
-- FROM corpus.isnad_links l
-- JOIN corpus.narrators n USING (narrator_id)
-- WHERE NOT n.is_placeholder AND NOT l.is_compiler
-- GROUP BY 1, 2 ORDER BY hadith_count DESC LIMIT 25;

-- Q2 Contested Narrators (Ibn Hajar vs al-Dhahabi disagree)
-- SELECT n.display_name, n.rank_ibn_hajar_raw, n.rank_dhahabi_raw,
--        rh.ordinal AS ih_ord, rd.ordinal AS dh_ord
-- FROM corpus.narrators n
-- JOIN corpus.rank_levels rh ON rh.rank_code = n.rank_ibn_hajar
-- JOIN corpus.rank_levels rd ON rd.rank_code = n.rank_dhahabi
-- WHERE rh.ordinal <> rd.ordinal
-- ORDER BY abs(rh.ordinal - rd.ordinal) DESC;

-- Q3 Shared narrators between two hadiths' chains
-- SELECT n.display_name
-- FROM corpus.isnad_links a
-- JOIN corpus.isnad_links b USING (narrator_id)
-- JOIN corpus.narrators n USING (narrator_id)
-- WHERE a.hadith_id = $1 AND b.hadith_id = $2
--   AND NOT a.is_compiler AND NOT n.is_placeholder
-- GROUP BY n.display_name;

-- Q4 Circle overview (teacher dashboard; spans user + corpus layers)
-- SELECT u.full_name,
--        count(p.hadith_id) FILTER (WHERE p.mastery >= 3) AS mastered,
--        count(p.hadith_id)                               AS total_assigned,
--        round(100.0 * count(p.hadith_id) FILTER (WHERE p.mastery >= 3)
--              / nullif(count(p.hadith_id), 0), 1)        AS pct
-- FROM app.enrollments e
-- JOIN app.users u    ON u.user_id = e.student_id
-- LEFT JOIN app.progress p ON p.student_id = e.student_id
-- WHERE e.circle_id = $1
-- GROUP BY u.user_id, u.full_name ORDER BY pct DESC NULLS LAST;

-- Q5 Weakest chains among studied hadiths (function + aggregation across layers)
-- SELECT h.hadith_id, h.hadith_num, c.title_ar,
--        corpus.chain_strength(h.hadith_id) AS strength
-- FROM corpus.hadiths h
-- JOIN corpus.collections c USING (collection_id)
-- JOIN app.set_items si USING (hadith_id)
-- WHERE si.set_id = $1
-- ORDER BY strength ASC NULLS LAST LIMIT 20;

-- =============================================================================
-- 9. SEED NOTES
--  * rank_levels starter: thiqa(6,.95) saduq(5,.80) maqbul(4,.60)
--    layyin(3,.40) daif(2,.25) matruk(1,.10) — refine during rank_map curation.
--  * After ETL + MIS validation: UPDATE corpus.narrators SET name_en = ...
--  * Then: REVOKE INSERT/UPDATE/DELETE on corpus.* from the app role;
--    DROP SCHEMA staging CASCADE;   -- corpus becomes read-only in practice AND permissions
-- =============================================================================
