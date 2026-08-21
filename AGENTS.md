# AGENTS.md

Instructions for AI coding agents that work in this repository. The full
instructions are in [`CLAUDE.md`](CLAUDE.md). Read that file first. This file is
a pointer, so that tools which look for `AGENTS.md` find the same rules.

Every document in this repository uses ASD-STE100 Simplified Technical English.
Write new documentation in that style.

## Quick orientation

Ilham (إلهام) is a term project for a database course. It is a hadith study
platform, and a teacher leads the study.

The current deliverable is a **database design**: the DDL, the ERD set, and the
product specification. The directories `backend/` and `frontend/` are empty. No
application code exists yet.

These files are correct:

- `docs/prd.md` — the product requirements and the graded requirement map.
- `db/00_init.sql` … `db/05_post_load.sql` — the complete DDL with comments.
  `db/run_ddl.sh` runs the files in numeric order. `05` is destructive and runs
  one time, after the ETL.
- `docs/` — the prose documents `architecture.md`, `database.md`, and
  `data-and-etl.md`. Start at `docs/README.md`.
- `docs/erd/README.md` — the diagram index and the notation legend.

## Rules you must not break

See `CLAUDE.md` for the reason behind each one.

- One PostgreSQL instance holds three schemas: `staging`, which is temporary;
  `corpus`, which is read-only; and `app`, which takes every write. **Never add a
  runtime write path into `corpus.*`.**
- Isnad positions are explicit rows, so a chain walk is aggregation. Do **not**
  use `WITH RECURSIVE`.
- `app.assign_study_set` stays a **procedure**, because it owns its `COMMIT`. It
  must have **no `EXCEPTION` handler**. A handler opens a subtransaction and makes
  the `COMMIT` illegal at run time.
- Rijal grades: raw strings for display, `rank_levels` ordinals for arithmetic.
  `staging.rank_map` runs at load time only. Narrators point at `rank_levels`
  directly.
- `app.progress` is keyed by **(student, hadith, assignment)**. Count mastered
  hadiths with `count(DISTINCT hadith_id)`.
- IS-A uses **table inheritance**. Each child has its own keys, and the
  `assert_user_exists` and `assert_email_unique` triggers replace what PostgreSQL
  does not inherit. Do not remove them. Integrity then breaks in silence.
- Triggers fire on `app` writes only. The corpus fires no trigger.
- English text attaches by **Arabic text**, never by `hadith_num`. The two sources
  number differently, and 99.94% of the matched Muslim pairs disagree. A number
  join attaches the wrong English and nothing detects it. Do not simplify stage 14
  back to a number join.
- Every routine must be simple and defensible line by line. Add each feature one
  time, where it belongs.

## Git

- **Do not add a `Co-Authored-By` trailer** or any other AI-attribution trailer.
- Make a branch for feature work. Do not commit to `master` directly. Commit and
  push only when somebody asks you to. Use conventional messages, such as `feat:`
  and `initial:`.
- Keep the ERD diagrams, the prose documents, and the PRD consistent with the DDL
  in `db/`.
