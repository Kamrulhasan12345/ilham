# CLAUDE.md

This file gives instructions to Claude Code (claude.ai/code) for work in this
repository.

Every document in this repository uses ASD-STE100 Simplified Technical English.
Keep new documentation in that style: short sentences, active voice, simple
present tense, and one instruction in each sentence.

## What this is

Ilham (إلهام) is a term project for a database course. Two persons build it. It
is a hadith study platform, and a teacher leads the study.

The current deliverable is a **database design**: the DDL, the ERD set, and the
product specification. The directories `backend/` and `frontend/` are empty. No
application code exists yet.

**Planned stack:** PERN — PostgreSQL, Express, React, Node.

Start from these files. They are correct, and the whole picture lives across
them:

- `docs/prd.md` — the product requirements: datasets, personas, features, the
  graded requirement map (§5), the ownership split (§7), milestones, and risks.
- `db/00_init.sql` … `db/05_post_load.sql` — the complete DDL with comments. Run
  the files in numeric order. `db/run_ddl.sh` runs `00` to `04` and the smoke
  test. `05` is destructive and runs one time, after the ETL. The comments give a
  reason for each decision and name the course requirement.
- `etl/` — the pipeline. `etl/src/` holds the Node code, which does structural
  work only. `etl/sql/` holds stages 10 to 19, which do all semantic work.
  `etl/rank_map.sql` and `etl/narrator_overrides.sql` are curated and committed.
- `docs/architecture.md`, `docs/database.md`, `docs/data-and-etl.md` — prose
  derived from the two groups above. `docs/README.md` is the index.
- `docs/erd/README.md` — the diagram index and the notation legend.

## The central idea

One PostgreSQL instance holds **three schemas**. The design mixes an analytical
read-only corpus with a transactional study layer. Schema design separates them,
not different systems.

| Schema | Role | Runtime writes |
|---|---|---|
| `staging` | Flat typed tables for the load. There is no JSONB | Deleted after the load |
| `corpus` | Read-only reference data: hadiths, chains, narrators, grades | **None.** The app role loses permission |
| `app` | Users and study data: circles, sets, assignments, progress, reviews | Yes |

Permission enforces "read-only", not convention. The database runs `REVOKE` on
`corpus.*` and then `DROP SCHEMA staging`. A course requirement grades this, so
keep it. **Never add a runtime write path into `corpus.*`.**

## Design rules — deliberate and graded. Do not "fix" them

- **Isnad positions are explicit rows** in `corpus.isnad_links`, a weak entity.
  The order is the order of transmission: the Companion is first and the compiler
  is last. A chain walk is therefore **aggregation, not recursion**. Do not
  rewrite it with `WITH RECURSIVE`. That would be artificial (PRD req 8).
- **`app.assign_study_set` is a PROCEDURE, not a function.** It owns its
  `COMMIT`, and a PostgreSQL function cannot do that. This is the deliberate
  difference between requirement 5 and requirement 6.

  It has **no `EXCEPTION` handler**. A `BEGIN … EXCEPTION` block opens a
  subtransaction, and a `COMMIT` inside one fails at run time with *"cannot commit
  while a subtransaction is active"*. An unhandled error already rolls the call
  back.
- **Rijal grades: raw strings for display, ordinals for arithmetic.** The
  `narrators.rank_*_raw` strings render as they are. Computation goes from
  `narrators.rank_ibn_hajar` and `narrators.rank_dhahabi` to
  `corpus.rank_levels` **directly**. The map from string to code is
  `staging.rank_map`. The ETL applies it one time, and it goes away with staging.
  It is never on a read path. Keep the three states apart: graded, named but
  ungraded, and unnamed.
- **The grain of `app.progress` is `(student, hadith, assignment)`.** The key is
  the surrogate `progress_id`, with two partial unique indexes, because a nullable
  `assignment_id` cannot sit in a primary key. A hadith assigned two times is two
  obligations. A later assignment never resets private study, where
  `assignment_id IS NULL`. **Anything that counts mastered hadiths must use
  `count(DISTINCT hadith_id)`.**
- **Triggers fire on user writes only**, that is on `app`. They are
  `trg_progress_stats` for the derived counts, and `trg_progress_audit`, which
  records mastery changes in the `audit_log` shadow table. The corpus fires no
  trigger.
- **English text attaches by Arabic text, never by `hadith_num`.** LK and Ifta
  number on different systems. LK runs Muslim from 1 to 7314 straight through.
  Ifta uses the grouped 1 to 3033.

  Of the pairs that match on text, and are therefore the same hadith, **99.94% of
  Muslim and 31.96% of Bukhari carry a different number**. A number join attaches
  the English of one hadith to a different hadith, and nothing detects it.

  `staging.lk_hadiths` therefore uses a surrogate key, because LK numbers are not
  unique either. It keeps `hadith_num` only as a reported cross-check.

  Stage 14 anchors both sides at the first narration verb, because Ifta puts the
  <span dir="rtl">باب</span> heading in front of `text_plain`. It then matches in
  five tiers, and `hadith_translations.match_via` records the tier (`E/P/6/4/M`).

  **Do not "simplify" this back to a number join.** Coverage is 95.3%. The rest
  keeps its Arabic, and the loader never deletes it.
- **`corpus.chain_strength(hadith_id)` is a clear, documented metric.** It takes
  the weakest link in each sanad, and the best sanad wins. An anʿana link takes a
  penalty. A placeholder or an unresolved name weakens the chain. Keep the
  function simple. Every routine must be defensible line by line (req 9).
- **Role specialization uses table inheritance.** `students`, `teachers`, and
  `admins` inherit from `app.users`. This is an academic requirement, and the
  design makes it load-bearing instead of decorative.

  PostgreSQL does not inherit primary keys, unique constraints, foreign keys, or
  identity. The schema restores each one: a shared `app.user_id_seq` through an
  inherited `DEFAULT`, `ADD PRIMARY KEY` and `ADD UNIQUE` on each child, and the
  `assert_email_unique` and `assert_user_exists` trigger functions.

  **Do not remove any of them.** Each failure is silent. It gives bad data, not
  an error.

  A foreign key to a *subtype* needs no help and enforces the role rule for free.
  Only the truly polymorphic references, `study_sets.owner_id` and
  `notes.user_id`, use the trigger. See
  `docs/database.md#is-a-via-table-inheritance`.

Each feature appears **one time**, where it belongs. There are no duplicate
routines, no corpus writes at runtime, and no artificial recursion. Requirement 8
grades restraint. Read `docs/prd.md` §5 before you add a routine.

## Commands

Start PostgreSQL 16 in a container and load the schema. Podman and docker both
work:

```bash
podman compose up -d db          # the first start also runs db/98_smoke_test.sql
```

Or use a PostgreSQL that you already have. Version 14 or higher is the baseline,
and version 11 is enough for `CREATE PROCEDURE`:

```bash
createdb ilham
./db/run_ddl.sh ilham test       # 00 → 04, then the smoke test
```

Build the corpus. This needs the Ifta data — see `etl/README.md`:

```bash
cd etl && npm install && cp .env.example .env
npm run verify && npm run doctor
psql -f rank_map.sql -f narrator_overrides.sql
npm run all && npm run seed
```

Render an ERD diagram again from its Graphviz source. The font is DejaVu Sans
Mono, which covers the Arabic labels:

```bash
dot -Tsvg docs/erd/relational/schema.dot -o docs/erd/relational/schema.svg
```

There is no build, test, or lint tooling yet, because there is no application
code. Add those commands here when somebody creates `backend/` and `frontend/`.

## Data and ETL context

The pipeline loads the corpus one time:

1. Node streams the raw files and flattens the structure into **flat typed**
   `staging` tables. There is no JSONB.
2. SQL does **all semantic work**.
3. The stages fill the typed `corpus` tables.
4. Narrator resolution runs pass A and pass B. Pass B reads `staging.mentions`.
5. The pipeline applies `staging.rank_map` in four passes.
6. Stage 14 attaches the English text by Arabic text match.
7. The database runs `REVOKE` and `DROP SCHEMA staging`.

Arabic is canonical. English is optional in three places:
`corpus.hadith_translations` for the hadith text, `narrators.name_en` from MIS,
and `collections.title_en`. Each one falls back to Arabic when it is absent.

The primary dataset is the Ifta Sunnah Hadith & Narrators Dataset. MIS gives
validation and English narrator names. LK gives the English hadith text.

## Git conventions

- **Do not add a `Co-Authored-By` trailer** to a commit. Do not add any other
  AI-attribution trailer.
- Keep good git hygiene. Never commit feature work directly to `master`. Make a
  branch first, then open a pull request. Commit and push only when somebody asks
  you to.
- Write clear, conventional commit messages that match the existing history, for
  example `feat: ...` and `initial: ...`.
- After you change the schema, keep these consistent with the DDL: the ERD `.dot`
  files and their images in `docs/erd/`, the prose in `docs/`, and `docs/prd.md`.
  They are graded deliverables, and they must not drift from `db/*.sql`.
