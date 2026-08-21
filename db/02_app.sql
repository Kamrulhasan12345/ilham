-- =============================================================================
-- ILHAM — 02_app.sql
-- Transactional study layer. Mirrors app.dot + the four crossings in
-- inter_layer.dot (set_items, progress, review_items, notes -> corpus.hadiths).
-- =============================================================================

\set ON_ERROR_STOP on

-- =============================================================================
-- IS-A SPECIALISATION VIA TABLE INHERITANCE  (app.dot: User -> {Student,Teacher,Admin}, d)
--
-- Rows live in exactly one child. SELECT FROM app.users scans the hierarchy;
-- FROM ONLY app.users returns none. tableoid::regclass names any row's subtype.
--
-- Postgres inherits columns, defaults, NOT NULL and CHECK — but NOT primary
-- keys, unique constraints, indexes, foreign keys, or identity. Everything
-- below restores those four guarantees. That is the price of IS-A here, paid
-- deliberately in one place rather than worked around per table.
--
-- IDENTITY: a shared sequence, not GENERATED ... AS IDENTITY. Identity is not
-- inherited (children would take NULL and fail NOT NULL); a plain DEFAULT is,
-- and one sequence keeps user_id unique across all three subtypes.
-- =============================================================================
CREATE SEQUENCE app.user_id_seq;

CREATE TABLE app.users (
    user_id       integer PRIMARY KEY DEFAULT nextval('app.user_id_seq'),
    email         text NOT NULL UNIQUE,
    password_hash text NOT NULL,                  -- bcrypt, in-house auth
    full_name     text NOT NULL,
    role          text NOT NULL CHECK (role IN ('student','teacher','admin')),
    created_at    timestamptz NOT NULL DEFAULT now()
);
ALTER SEQUENCE app.user_id_seq OWNED BY app.users.user_id;

CREATE TABLE app.students (
    student_level text CHECK (student_level IN ('beginner','intermediate','advanced'))
) INHERITS (app.users);

CREATE TABLE app.teachers (
    institution    text,
    specialization text
) INHERITS (app.users);

CREATE TABLE app.admins (
    admin_level text CHECK (admin_level IN ('super','content','support'))
) INHERITS (app.users);

-- Disjointness (the 'd' on the ISA edge): a row satisfies exactly one CHECK.
ALTER TABLE app.students ADD CONSTRAINT chk_students_role CHECK (role = 'student');
ALTER TABLE app.teachers ADD CONSTRAINT chk_teachers_role CHECK (role = 'teacher');
ALTER TABLE app.admins   ADD CONSTRAINT chk_admins_role   CHECK (role = 'admin');

-- Keys restored per child. Without these no FK can reference a subtype at all,
-- which is what makes circles/enrollments/progress/reviews below possible.
ALTER TABLE app.students ADD PRIMARY KEY (user_id);
ALTER TABLE app.teachers ADD PRIMARY KEY (user_id);
ALTER TABLE app.admins   ADD PRIMARY KEY (user_id);
ALTER TABLE app.students ADD UNIQUE (email);
ALTER TABLE app.teachers ADD UNIQUE (email);
ALTER TABLE app.admins   ADD UNIQUE (email);

-- GAP 1: UNIQUE is per-table, so the three above do not stop one email
-- appearing as both a student and a teacher — login would be ambiguous.
-- One function, three triggers; the check reads app.users, which scans the
-- whole hierarchy.
CREATE FUNCTION app.assert_email_unique()
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
-- see child rows, so it rejects every real user. Tables referencing a *specific*
-- subtype use a normal FK to that child and are unaffected; only genuinely
-- polymorphic references (study_sets.owner_id, notes.user_id) need this.
CREATE FUNCTION app.assert_user_exists()
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
'Referential integrity for polymorphic user references. Stands in for a FK to app.users, which inheritance cannot support. Existence only: no ON DELETE cascade.';

-- =============================================================================
-- Study structures
-- =============================================================================
CREATE TABLE app.circles (
    circle_id  integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    teacher_id integer NOT NULL REFERENCES app.teachers(user_id),
    name       text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON app.circles (teacher_id);

CREATE TABLE app.enrollments (
    circle_id   integer NOT NULL REFERENCES app.circles,
    student_id  integer NOT NULL REFERENCES app.students(user_id),
    enrolled_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (circle_id, student_id)
);
CREATE INDEX ON app.enrollments (student_id);   -- PK leads with circle_id

CREATE TABLE app.study_sets (
    set_id     integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    owner_id   integer NOT NULL,                 -- -> app.users, trigger-enforced
    name       text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_study_sets_owner BEFORE INSERT OR UPDATE OF owner_id ON app.study_sets
FOR EACH ROW EXECUTE FUNCTION app.assert_user_exists('owner_id');
CREATE INDEX ON app.study_sets (owner_id);

-- inter_layer.dot: StudySet --Contains-- Hadith  (M:N, no relationship attrs)
CREATE TABLE app.set_items (
    set_id    integer NOT NULL REFERENCES app.study_sets,
    hadith_id integer NOT NULL REFERENCES corpus.hadiths,
    PRIMARY KEY (set_id, hadith_id)
);
CREATE INDEX ON app.set_items (hadith_id);      -- reverse lookup: "which sets use this hadith"

CREATE TABLE app.assignments (
    assignment_id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    circle_id     integer NOT NULL REFERENCES app.circles,
    set_id        integer NOT NULL REFERENCES app.study_sets,
    due_date      date NOT NULL,
    created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON app.assignments (circle_id);
CREATE INDEX ON app.assignments (set_id);

-- -----------------------------------------------------------------------------
-- Progress. GRAIN: (student, hadith, assignment).
-- A hadith assigned twice — two circles, or the same set re-assigned next term
-- — is two obligations discharged separately, so two rows. Prior self-study is
-- a third (assignment_id IS NULL) and a later assignment never resets it.
-- assignment_id is nullable and NULLs cannot sit in a PRIMARY KEY, so identity
-- is a surrogate and uniqueness splits across two partial indexes.
-- (PG15+ could fold these into UNIQUE ... NULLS NOT DISTINCT; kept portable to
-- the declared 14+ baseline.)
-- -----------------------------------------------------------------------------
CREATE TABLE app.progress (
    progress_id    bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    student_id     integer NOT NULL REFERENCES app.students(user_id),
    hadith_id      integer NOT NULL REFERENCES corpus.hadiths,
    assignment_id  integer REFERENCES app.assignments,   -- NULL = self-study
    mastery        smallint NOT NULL DEFAULT 0 CHECK (mastery BETWEEN 0 AND 4),
    times_reviewed integer NOT NULL DEFAULT 0 CHECK (times_reviewed >= 0),
    last_reviewed  timestamptz
);
-- Dedup only — these cap nothing. They reject a second row for a triple that
-- already exists, i.e. the same hadith twice under one assignment.
CREATE UNIQUE INDEX progress_assigned_uq ON app.progress
    (student_id, hadith_id, assignment_id) WHERE assignment_id IS NOT NULL;
CREATE UNIQUE INDEX progress_self_uq ON app.progress
    (student_id, hadith_id)               WHERE assignment_id IS NULL;

-- NOT OPTIONAL. sync_student_stats() aggregates every progress row for a
-- student on every insert. Both unique indexes above lead with student_id but
-- both are PARTIAL, so neither can serve an unfiltered per-student scan —
-- without this index a 20-student x 50-hadith fan-out does 1,000 sequential
-- scans of app.progress.
CREATE INDEX progress_student_idx ON app.progress (student_id);
CREATE INDEX progress_assignment_idx ON app.progress (assignment_id);
CREATE INDEX progress_hadith_idx ON app.progress (hadith_id);

-- -----------------------------------------------------------------------------
-- Review: header/detail. A review is one pedagogical event (session) containing
-- many granular evaluations (items). Together they give the multi-table
-- transaction: insert session -> insert items -> update progress, atomically.
-- -----------------------------------------------------------------------------
CREATE TABLE app.review_sessions (
    session_id  integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    student_id  integer NOT NULL REFERENCES app.students(user_id),
    reviewer_id integer REFERENCES app.teachers(user_id),  -- NULL = self-study
    circle_id   integer REFERENCES app.circles,
    created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON app.review_sessions (student_id, created_at DESC);
CREATE INDEX ON app.review_sessions (circle_id);

CREATE TABLE app.review_items (
    session_id integer NOT NULL REFERENCES app.review_sessions,
    hadith_id  integer NOT NULL REFERENCES corpus.hadiths,
    result     text NOT NULL CHECK (result IN ('pass','partial','fail')),
    PRIMARY KEY (session_id, hadith_id)
);
CREATE INDEX ON app.review_items (hadith_id);

CREATE TABLE app.student_stats (
    student_id     integer PRIMARY KEY REFERENCES app.students(user_id),
    mastered_count integer NOT NULL DEFAULT 0,
    review_count   integer NOT NULL DEFAULT 0,
    updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE app.notes (
    note_id    integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id    integer NOT NULL,                 -- -> app.users, trigger-enforced
    hadith_id  integer NOT NULL REFERENCES corpus.hadiths,
    body       text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_notes_user BEFORE INSERT OR UPDATE OF user_id ON app.notes
FOR EACH ROW EXECUTE FUNCTION app.assert_user_exists('user_id');
CREATE INDEX ON app.notes (hadith_id);
CREATE INDEX ON app.notes (user_id);

-- Audit actor is polymorphic and deliberately NOT trigger-checked, unlike
-- study_sets/notes: audit rows are written from inside trg_progress_audit, and
-- a failed actor check there would roll back the legitimate user write it is
-- recording. changed_by is best-effort by design — nullable, read from a
-- session variable that may be unset (batch jobs, psql).
CREATE TABLE app.audit_log (
    audit_id   bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    table_name text NOT NULL,
    row_key    text NOT NULL,
    changed_by integer,
    old_value  jsonb,
    new_value  jsonb,
    changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON app.audit_log (table_name, row_key);
CREATE INDEX ON app.audit_log (changed_at DESC);

-- =============================================================================
-- TRIGGERS
-- =============================================================================
-- 4a: derived stats. Recompute-and-store on progress change — a derived value
-- is the appropriate trigger use; the app never maintains these counts.
CREATE FUNCTION app.sync_student_stats()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO app.student_stats (student_id, mastered_count, review_count, updated_at)
  SELECT NEW.student_id,
         -- DISTINCT: progress is one row per (hadith, assignment), so a hadith
         -- assigned twice would otherwise count as two mastered hadiths.
         count(DISTINCT hadith_id) FILTER (WHERE mastery >= 3),
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

-- 4b: audit — log mastery changes (teacher overrides included) to a shadow table.
CREATE FUNCTION app.audit_progress()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.mastery IS DISTINCT FROM OLD.mastery THEN
    INSERT INTO app.audit_log (table_name, row_key, changed_by, old_value, new_value)
    VALUES ('app.progress',
            OLD.progress_id::text,   -- row identity; student+hadith is no longer
                                     -- unique now that assignment is in the grain
            nullif(current_setting('ilham.user_id', true), '')::int,
            jsonb_build_object('student_id',    OLD.student_id,
                               'hadith_id',     OLD.hadith_id,
                               'assignment_id', OLD.assignment_id,
                               'mastery',       OLD.mastery),
            jsonb_build_object('mastery', NEW.mastery));
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_progress_audit
AFTER UPDATE ON app.progress
FOR EACH ROW EXECUTE FUNCTION app.audit_progress();

-- API sets the actor per connection: SELECT set_config('ilham.user_id', $1, false);

-- =============================================================================
-- PROCEDURE: assign_study_set — multi-table fan-out that owns its transaction.
-- PROCEDURE, not function, precisely because it COMMITs: Postgres functions
-- cannot. No exception handler: BEGIN...EXCEPTION opens a subtransaction and
-- COMMIT inside one raises "cannot commit while a subtransaction is active".
-- An unhandled error already aborts and rolls back the whole call, which is the
-- all-or-nothing behaviour required.
-- =============================================================================
CREATE PROCEDURE app.assign_study_set(p_circle integer, p_set integer, p_due date)
LANGUAGE plpgsql AS $$
DECLARE v_assignment integer;
BEGIN
    INSERT INTO app.assignments (circle_id, set_id, due_date)
    VALUES (p_circle, p_set, p_due)
    RETURNING assignment_id INTO v_assignment;

    INSERT INTO app.progress (student_id, hadith_id, assignment_id)
    SELECT e.student_id, si.hadith_id, v_assignment
    FROM app.enrollments e
    CROSS JOIN app.set_items si
    WHERE e.circle_id = p_circle AND si.set_id = p_set
    -- Inference must name the partial index. Defensive only: the CROSS JOIN of
    -- two PK'd tables cannot collide with itself, so this guards a replayed
    -- fan-out against an assignment that already has rows. Each CALL mints a
    -- NEW assignment — calling twice deliberately creates two obligations, it
    -- does not deduplicate. Prior self-study (assignment_id IS NULL) sits under
    -- the other index entirely, so existing mastery is never reset.
    ON CONFLICT (student_id, hadith_id, assignment_id)
        WHERE assignment_id IS NOT NULL DO NOTHING;

    COMMIT;
END $$;
