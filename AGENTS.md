# AGENTS.md

Guidance for AI coding agents working in this repository. The full, canonical
guidance lives in [`CLAUDE.md`](CLAUDE.md) — read it first. This file is a
pointer so tools that look for `AGENTS.md` find the same rules.

## Quick orientation

Ilham (إلهام) is a DBMS course term project: a teacher-led hadith study
platform. The current deliverable is a **database design** — DDL, ERD set, and
product spec. `backend/` and `frontend/` are empty; no app code exists yet.

Source of truth:
- `docs/prd.md` — product requirements and the graded requirement mapping.
- `db/schema.sql` — complete annotated DDL.
- `docs/` — prose docs (`architecture.md`, `database.md`, `data-and-etl.md`); start at `docs/README.md`.
- `docs/erd/README.md` — ERD index and Chen-notation legend.

## Non-negotiables (see CLAUDE.md for the why)

- Three schemas in one Postgres instance: `staging` (transient) / `corpus`
  (read-only) / `app` (OLTP). **Never add a runtime write path into `corpus.*`.**
- Isnad positions are stored explicitly → aggregation, **not** `WITH RECURSIVE`.
- `app.assign_study_set` stays a **procedure** (owns its `COMMIT`). It must have
  **no `EXCEPTION` handler** — that opens a subtransaction and makes the
  `COMMIT` illegal at runtime.
- Rijal grades: raw strings for display, `rank_levels` ordinals for math.
  `staging.rank_map` is load-time only; narrators FK into `rank_levels` directly.
- `app.progress` is keyed **(student, hadith, assignment)**. Count mastered
  hadiths with `count(DISTINCT hadith_id)`.
- IS-A uses **table inheritance**, with per-child keys and the
  `assert_user_exists` / `assert_email_unique` triggers that compensate for what
  Postgres does not inherit. Do not remove them — integrity breaks silently.
- Triggers fire on `app` writes only; the corpus never fires triggers.
- Every routine must be simple and defensible line-by-line; add each feature
  once, where it belongs.

## Git

- **No `Co-Authored-By` / AI-attribution trailers** on commits.
- Branch for feature work; don't commit to `master` directly. Commit/push only
  when asked. Use conventional messages (`feat:`, `initial:`, …).
- Keep the ERD diagrams, prose docs, and PRD consistent with `db/schema.sql`.
