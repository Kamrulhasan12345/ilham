-- =============================================================================
-- ILHAM — Hadith Study Platform — PostgreSQL Schema (FINAL)
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
--    semantic shaping. Dropped after load.)
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

-- Kept in staging ONLY for ETL Pass B (positional zip). Not loaded into corpus.
CREATE TABLE staging.mentions (
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

-- Curated during ETL: normalized raw rijal string -> rank_code. Lives in
-- staging, not corpus: it is applied once (§3.5) to populate the narrators'
-- rank_* code columns and is never read at runtime — narrators reference
-- corpus.rank_levels directly. Kept in the DDL as the record of the mapping
-- decisions (req 9), then dropped with the rest of staging.
CREATE TABLE staging.rank_map (
    raw_string  text PRIMARY KEY,        -- normalize_arabic() applied
    rank_code   text NOT NULL            -- FK'd after corpus.rank_levels seeds
);

-- =============================================================================
-- 2. CORPUS LAYER (read-only after seed; no runtime writes, ever)
-- =============================================================================
CREATE TABLE corpus.collections (
    collection_id  smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    slug           text NOT NULL UNIQUE,          -- manifest filename mapping
    title_ar       text NOT NULL,                 -- e.g. صحيح البخاري
    title_en       text                           -- optional, manual (33 books;
                                                  -- LK is out of scope)
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

-- Rank normalization: raw rijal strings -> ordinal scale. The raw->code lookup
-- is a load-time concern and lives in staging.rank_map; only the scale itself
-- is corpus data. Raw strings are retained on narrators for display honesty.
CREATE TABLE corpus.rank_levels (
    rank_code   text PRIMARY KEY,       -- 'thiqa', 'saduq', 'maqbul', 'daif', ...
    label_ar    text NOT NULL,
    ordinal     smallint NOT NULL,      -- higher = stronger
    weight      numeric(3,2) NOT NULL CHECK (weight BETWEEN 0 AND 1)
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
    rank_ibn_hajar   text REFERENCES corpus.rank_levels,  -- code, for math (§3.5)
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

-- Translated hadith text. Core corpus structure: the hadith detail page renders
-- Arabic alongside a translation where one exists, falling back to Arabic alone.
-- SOURCE-TAGGED, not LK-specific: LK is one optional bulk feeder (prd.md cut
-- order), but manual or later imports land in the same table under a different
-- `source`. Cutting the LK import therefore costs rows, not the capability.
-- KEY (hadith_id, lang): one canonical translation per language per hadith —
-- the reader needs one English text, not a choice of three. Holding rival
-- translations side by side would mean adding `source` to the key; deliberately
-- not done, since nothing in the product picks between them.
CREATE TABLE corpus.hadith_translations (
    hadith_id  integer NOT NULL REFERENCES corpus.hadiths,
    lang       char(2) NOT NULL DEFAULT 'en' CHECK (lang ~ '^[a-z]{2}$'), -- ISO 639-1
    text_full  text NOT NULL,
    source     text NOT NULL DEFAULT 'LK',   -- provenance: 'LK', 'manual', ...
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

-- (staging.mentions is NOT loaded into corpus — Pass B below is its only
--  consumer, and it runs while staging still exists.)

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
-- FROM corpus.hadiths h, staging.mentions m
-- WHERE h.hadith_id = l.hadith_id AND h.sanad_count = 1
--   AND m.hadith_id = l.hadith_id
--   AND NOT l.is_compiler
--   AND m.mention_order = (SELECT max(position) - 1 FROM corpus.isnad_links x
--                          WHERE x.hadith_id = l.hadith_id) + 1 - l.position
--   AND l.narrator_id IS NULL;

-- Disagreement report (A vs B), unresolved report (resolution IS NULL -> 'X'):
-- both dumped to a log table / CSV; rates quoted in the report.

-- 3.4b Translations (optional feeder — the table stands with or without it).
--      LK numbering is matched to Ifta per book; only rows that align are kept,
--      so partial coverage is expected and the UI falls back to Arabic.
-- INSERT INTO corpus.hadith_translations (hadith_id, lang, text_full, source)
-- SELECT h.hadith_id, 'en', l.text_en, 'LK'
-- FROM staging.lk_hadiths l
-- JOIN corpus.collections c ON c.slug = l.book_slug
-- JOIN corpus.hadiths h ON h.collection_id = c.collection_id
--                      AND h.hadith_num = l.hadith_num
-- ON CONFLICT (hadith_id, lang) DO NOTHING;   -- first source wins

-- 3.5 Rank normalization: apply the curated map, then keep only the codes.
--     Raw strings stay on the narrator row for display; the codes are what
--     rank_levels (and therefore chain_strength) do arithmetic on.
-- UPDATE corpus.narrators n
-- SET rank_ibn_hajar = rm.rank_code
-- FROM staging.rank_map rm
-- WHERE rm.raw_string = corpus.normalize_arabic(n.rank_ibn_hajar_raw);
--   (same for rank_dhahabi / rank_dhahabi_raw)
-- Unmapped raw strings are reported before DROP SCHEMA staging — an unmapped
-- grade leaves the code NULL, which chain_strength treats as ungraded (0.50).

-- =============================================================================
-- 4. REQ 5 — FUNCTION: chain_strength
--    Weakest-link per sanad; best sanad wins. Three-way narrator treatment:
--      graded  -> rank weight (min of the two scholars where both exist)
--      ungraded (named) -> neutral 0.5   (ungraded ≠ criticized)
--      placeholder/unnamed -> 0.15       (mubham weakens the chain)
--    anʿana penalty: links transmitted by عن lose 0.05.
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

-- IS-A SPECIALIZATION VIA TABLE INHERITANCE
-- Rows live in exactly one child; the parent is a read surface that scans the
-- whole hierarchy (SELECT ... FROM app.users returns every user, FROM ONLY
-- app.users returns none). tableoid::regclass names the subtype of any row.
--
-- Postgres inherits columns, defaults, NOT NULL and CHECK — but NOT primary
-- keys, unique constraints, indexes, foreign keys, or identity. Everything
-- below exists to restore those four guarantees; that is the price of IS-A
-- here, paid deliberately and in one place rather than worked around per table.
--
-- IDENTITY: a shared sequence, not GENERATED ... AS IDENTITY. Identity is not
-- inherited, so children would take NULL and fail NOT NULL; a plain DEFAULT is
-- inherited, and one sequence keeps user_id unique across all three subtypes.
CREATE SEQUENCE app.user_id_seq;

-- Supertype: shared authentication (all users)
CREATE TABLE app.users (
    user_id       integer PRIMARY KEY DEFAULT nextval('app.user_id_seq'),
    email         text NOT NULL UNIQUE,
    password_hash text NOT NULL,                   -- bcrypt, in-house auth (req 1)
    full_name     text NOT NULL,
    role          text NOT NULL CHECK (role IN ('student','teacher','admin')),
    created_at    timestamptz NOT NULL DEFAULT now()
);
ALTER SEQUENCE app.user_id_seq OWNED BY app.users.user_id;

-- Subtypes: role-specific attributes (reqs 1-2)
CREATE TABLE app.students (
    student_level text CHECK (student_level IN ('beginner','intermediate','advanced'))
) INHERITS (app.users);

CREATE TABLE app.teachers (
    institution    text,
    specialization text                            -- e.g. "Rijal expert"
) INHERITS (app.users);

-- Admins: platform administrators with system-level access
CREATE TABLE app.admins (
    admin_level text CHECK (admin_level IN ('super','content','support'))
) INHERITS (app.users);

-- Disjointness: a row satisfies exactly one subtype's role CHECK.
ALTER TABLE app.students ADD CONSTRAINT chk_students_role CHECK (role = 'student');
ALTER TABLE app.teachers ADD CONSTRAINT chk_teachers_role CHECK (role = 'teacher');
ALTER TABLE app.admins   ADD CONSTRAINT chk_admins_role   CHECK (role = 'admin');

-- Keys, restored per child. Without these no FK can reference a subtype at all
-- ("there is no unique constraint matching given keys for referenced table"),
-- which is what makes circles/enrollments/progress/reviews below possible.
ALTER TABLE app.students ADD PRIMARY KEY (user_id);
ALTER TABLE app.teachers ADD PRIMARY KEY (user_id);
ALTER TABLE app.admins   ADD PRIMARY KEY (user_id);
ALTER TABLE app.students ADD UNIQUE (email);
ALTER TABLE app.teachers ADD UNIQUE (email);
ALTER TABLE app.admins   ADD UNIQUE (email);

-- GAP 1: a UNIQUE constraint is per-table, so the three above do not stop the
-- same email appearing once as a student and once as a teacher. Login would be
-- ambiguous. One function, three triggers — the check reads app.users, which
-- scans the whole hierarchy.
CREATE OR REPLACE FUNCTION app.assert_email_unique()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM app.users
             WHERE email = NEW.email AND user_id IS DISTINCT FROM NEW.user_id) THEN
    RAISE unique_violation USING
      MESSAGE = format('email %s is already registered to another user', NEW.email);
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_students_email BEFORE INSERT OR UPDATE OF email ON app.students
FOR EACH ROW EXECUTE FUNCTION app.assert_email_unique();
CREATE TRIGGER trg_teachers_email BEFORE INSERT OR UPDATE OF email ON app.teachers
FOR EACH ROW EXECUTE FUNCTION app.assert_email_unique();
CREATE TRIGGER trg_admins_email   BEFORE INSERT OR UPDATE OF email ON app.admins
FOR EACH ROW EXECUTE FUNCTION app.assert_email_unique();

-- GAP 2: a FOREIGN KEY to app.users is checked with ONLY semantics — it cannot
-- see rows that live in the children, so it rejects every real user. Tables
-- that reference a *specific* subtype (circles, enrollments, progress,
-- review_sessions, student_stats) use a normal FK to that child and are
-- unaffected; only genuinely polymorphic references need this. Column name is
-- passed as a trigger argument so one function serves all of them (req 8).
CREATE OR REPLACE FUNCTION app.assert_user_exists()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_id integer;
BEGIN
  EXECUTE format('SELECT ($1).%I', TG_ARGV[0]) INTO v_id USING NEW;
  IF v_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM app.users WHERE user_id = v_id) THEN
    RAISE foreign_key_violation USING
      MESSAGE = format('%s.%s = %s references no row in app.users',
                       TG_TABLE_NAME, TG_ARGV[0], v_id);
  END IF;
  RETURN NEW;
END $$;
COMMENT ON FUNCTION app.assert_user_exists IS
'Referential integrity for polymorphic user references. Stands in for a FK to app.users, which inheritance cannot support. Enforces existence only: no ON DELETE cascade, so deleting a user is an application-level concern.';

-- Circles: only teachers can teach → reference app.teachers
CREATE TABLE app.circles (
    circle_id   integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    teacher_id  integer NOT NULL REFERENCES app.teachers(user_id),
    name        text NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now()
);

-- Enrollments: only students enroll → reference app.students
CREATE TABLE app.enrollments (
    circle_id   integer NOT NULL REFERENCES app.circles,
    student_id  integer NOT NULL REFERENCES app.students(user_id),
    enrolled_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (circle_id, student_id)
);

-- Study sets: any user can own → polymorphic, so no FK (see GAP 2 above)
CREATE TABLE app.study_sets (
    set_id     integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    owner_id   integer NOT NULL,          -- → app.users, enforced by trigger
    name       text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_study_sets_owner BEFORE INSERT OR UPDATE OF owner_id ON app.study_sets
FOR EACH ROW EXECUTE FUNCTION app.assert_user_exists('owner_id');

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

-- CONSOLIDATION: assignment_targets removed — progress carries assignment_id,
-- so one row = one unit of work a student owes (or did on their own).
-- GRAIN: (student, hadith, assignment). A hadith assigned twice — two circles,
-- or the same set re-assigned next term — is two obligations the student must
-- discharge separately, so it is two rows. Prior self-study is a third
-- (assignment_id IS NULL), and its mastery is never reset by a later assignment.
-- KEY: assignment_id is nullable and NULLs cannot sit in a PRIMARY KEY, so
-- identity is a surrogate and uniqueness is split across two partial indexes.
-- (PG15+ could fold these into one UNIQUE ... NULLS NOT DISTINCT; kept portable
-- to the 14+ baseline declared at the top of this file.)
CREATE TABLE app.progress (
    progress_id    bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    student_id     integer NOT NULL REFERENCES app.students(user_id),
    hadith_id      integer NOT NULL REFERENCES corpus.hadiths,
    assignment_id  integer REFERENCES app.assignments,  -- NULL = self-study
    mastery        smallint NOT NULL DEFAULT 0 CHECK (mastery BETWEEN 0 AND 4),
    times_reviewed integer NOT NULL DEFAULT 0,
    last_reviewed  timestamptz
);
-- Dedup only — they cap nothing: a student may hold rows for any number of
-- distinct hadiths. What they reject is a second row for a triple that already
-- exists, i.e. the same hadith twice under one assignment.
CREATE UNIQUE INDEX progress_assigned_uq ON app.progress
    (student_id, hadith_id, assignment_id) WHERE assignment_id IS NOT NULL;
CREATE UNIQUE INDEX progress_self_uq ON app.progress
    (student_id, hadith_id)               WHERE assignment_id IS NULL;

-- REVIEW ARCHITECTURE: Header/Detail Pattern (Req 3: Transactional Depth)
-- Why two tables? A "review" is a distinct pedagogical event (the session)
-- that contains multiple granular evaluations (the items).
-- 1. app.review_sessions (Header): Captures the context of the event.
--    Who was reviewed, who reviewed them, in what circle, and when.
--    This satisfies the domain requirement that reviews happen in a halaqa context.
-- 2. app.review_items (Detail): Captures the specific hadith-by-hadith results.
--    This allows a single session to test 10 hadiths with mixed results (pass/fail).
-- Together, they enable the multi-table transaction required by Req 3, where
-- inserting the session, items, and updating progress must succeed or fail together.
CREATE TABLE app.review_sessions (
  session_id  integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  student_id  integer NOT NULL REFERENCES app.students(user_id),
  reviewer_id integer REFERENCES app.teachers(user_id),  -- NULL = self-study
  circle_id   integer REFERENCES app.circles,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE app.review_items (
  session_id integer NOT NULL REFERENCES app.review_sessions,
  hadith_id  integer NOT NULL REFERENCES corpus.hadiths,
  result     text NOT NULL CHECK (result IN ('pass','partial','fail')),
  PRIMARY KEY (session_id, hadith_id)
);

-- Student stats: only for students → reference app.students
CREATE TABLE app.student_stats (                  -- trigger-maintained (req 4a)
    student_id     integer PRIMARY KEY REFERENCES app.students(user_id),
    mastered_count integer NOT NULL DEFAULT 0,
    review_count   integer NOT NULL DEFAULT 0,
    updated_at     timestamptz NOT NULL DEFAULT now()
);

-- Notes: any user can write → polymorphic, so no FK (see GAP 2 above)
CREATE TABLE app.notes (
    note_id    integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id    integer NOT NULL,          -- → app.users, enforced by trigger
    hadith_id  integer NOT NULL REFERENCES corpus.hadiths,
    body       text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_notes_user BEFORE INSERT OR UPDATE OF user_id ON app.notes
FOR EACH ROW EXECUTE FUNCTION app.assert_user_exists('user_id');

-- Audit log: actor is polymorphic. Deliberately NOT trigger-checked, unlike
-- study_sets/notes — audit rows are written from inside trg_progress_audit, and
-- a failed actor check there would roll back the legitimate user write it is
-- recording. changed_by is best-effort by design: it is nullable and read from
-- a session variable that may be unset (batch jobs, psql).
CREATE TABLE app.audit_log (                      -- shadow table (req 4b)
    audit_id   bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    table_name text NOT NULL,
    row_key    text NOT NULL,
    changed_by integer,                            -- → app.users, set via set_config
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
         -- DISTINCT: progress has one row per (hadith, assignment), so a hadith
         -- assigned twice would otherwise be counted as two mastered hadiths.
         count(DISTINCT hadith_id) FILTER (WHERE mastery >= 3),
         coalesce(sum(times_reviewed), 0),   -- total reviews, repeats included
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
            OLD.progress_id::text,   -- row identity; student+hadith is no longer
                                     -- unique now that assignment is in the grain
            nullif(current_setting('ilham.user_id', true), '')::int,
            jsonb_build_object('student_id', OLD.student_id,
                               'hadith_id',  OLD.hadith_id,
                               'assignment_id', OLD.assignment_id,
                               'mastery', OLD.mastery),
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
--    Postgres functions cannot COMMIT; procedures can (req 5 vs req 6 line).
--    NO exception handler: a BEGIN...EXCEPTION block is a subtransaction, and
--    COMMIT inside one raises "cannot commit while a subtransaction is active".
--    An unhandled error already aborts and rolls back the whole call, which is
--    the all-or-nothing behaviour req 3 wants — the handler only broke it.
-- =============================================================================
CREATE OR REPLACE PROCEDURE app.assign_study_set(
    p_circle integer, p_set integer, p_due date)
LANGUAGE plpgsql AS $$
DECLARE v_assignment integer;
BEGIN
    INSERT INTO app.assignments (circle_id, set_id, due_date)
    VALUES (p_circle, p_set, p_due)
    RETURNING assignment_id INTO v_assignment;

    -- CONSOLIDATION: assignment_targets removed — progress rows carry the
    -- assignment, one per (student, hadith) owed under it.
    INSERT INTO app.progress (student_id, hadith_id, assignment_id)
    SELECT e.student_id, si.hadith_id, v_assignment
    FROM app.enrollments e
    CROSS JOIN app.set_items si
    WHERE e.circle_id = p_circle AND si.set_id = p_set
    -- inference must name the partial index. Defensive: the CROSS JOIN of two
    -- PK'd tables cannot itself collide, so this only guards a replayed fan-out
    -- against an assignment that already has rows. Note each CALL mints a NEW
    -- assignment — calling twice deliberately creates two obligations, it does
    -- not deduplicate. Prior self-study (assignment_id IS NULL) sits under the
    -- other index entirely, so existing mastery is never reset.
    ON CONFLICT (student_id, hadith_id, assignment_id)
        WHERE assignment_id IS NOT NULL DO NOTHING;

    COMMIT;   -- explicit transaction control (req 3): all-or-nothing fan-out
END $$;

-- Req 3 also demonstrated at the API layer: POST /review-sessions wraps
-- (insert session -> insert items -> update progress) in BEGIN/COMMIT/ROLLBACK
-- via node-postgres; triggers 4a/4b fire inside that transaction.

-- =============================================================================
-- 8. REQ 7 — THE COMPLEX QUERIES (analytics pages)
-- =============================================================================
-- Q1 Top Narrators
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
--    DISTINCT throughout: progress is per (hadith, assignment), so a hadith
--    assigned twice is two rows but one hadith.
-- SELECT u.full_name,
--        count(DISTINCT p.hadith_id) FILTER (WHERE p.mastery >= 3) AS mastered,
--        count(DISTINCT p.hadith_id)                               AS total_assigned,
--        round(100.0 * count(DISTINCT p.hadith_id) FILTER (WHERE p.mastery >= 3)
--              / nullif(count(DISTINCT p.hadith_id), 0), 1)        AS pct
-- FROM app.enrollments e
-- JOIN app.students u    ON u.user_id = e.student_id
-- LEFT JOIN app.progress p ON p.student_id = e.student_id
-- WHERE e.circle_id = $1
-- GROUP BY u.user_id, u.full_name ORDER BY pct DESC NULLS LAST;

-- Q6 Assignment completion (the task view: what is owed vs what is done)
--    Counts obligations, not knowledge — a hadith the student already mastered
--    under another assignment is still outstanding here until worked.
-- SELECT s.full_name, a.due_date,
--        count(*)                               AS owed,
--        count(*) FILTER (WHERE p.mastery >= 3) AS done
-- FROM app.assignments a
-- JOIN app.enrollments e ON e.circle_id = a.circle_id
-- JOIN app.students   s  ON s.user_id   = e.student_id
-- LEFT JOIN app.progress p ON p.student_id    = e.student_id
--                         AND p.assignment_id = a.assignment_id
-- WHERE a.assignment_id = $1
-- GROUP BY s.user_id, s.full_name, a.due_date ORDER BY done, s.full_name;

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
--    layyin(3,.40) daif(2,.25) matruk(1,.10) — refine during staging.rank_map
--    curation, then ALTER TABLE staging.rank_map ADD FOREIGN KEY (rank_code)
--    REFERENCES corpus.rank_levels once the scale above is seeded.
--  * After ETL + MIS validation: UPDATE corpus.narrators SET name_en = ...
--  * Then: REVOKE INSERT/UPDATE/DELETE on corpus.* from the app role;
--    DROP SCHEMA staging CASCADE;   -- corpus becomes read-only in practice AND permissions
-- =============================================================================
