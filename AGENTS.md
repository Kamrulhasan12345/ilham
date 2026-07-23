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
- `app.assign_study_set` stays a **procedure** (owns its transaction).
- Rijal grades: raw strings for display, `rank_levels` ordinals for math.
- Triggers fire on `app` writes only; the corpus never fires triggers.
- Every routine must be simple and defensible line-by-line; add each feature
  once, where it belongs.

## Git

- **No `Co-Authored-By` / AI-attribution trailers** on commits.
- Branch for feature work; don't commit to `master` directly. Commit/push only
  when asked. Use conventional messages (`feat:`, `initial:`, …).
- Keep the ERD diagrams, prose docs, and PRD consistent with `db/schema.sql`.
