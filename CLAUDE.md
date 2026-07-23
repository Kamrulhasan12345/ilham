# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Ilham (إلهام) is a **DBMS course term project** (2-person team): a teacher-led hadith study platform. The current deliverable is a **database design** — the DDL, the ERD set, and the product spec. `backend/` and `frontend/` are empty placeholders; the app code has not been written yet.

**Stack (planned):** PERN — PostgreSQL, Express, React, Node.

Start from these files — they are the source of truth and the "big picture" lives across them:
- `docs/prd.md` — final product requirements: datasets, personas, features, the graded requirement mapping (§5), ownership split (§7), milestones, risks.
- `db/schema.sql` — the complete annotated DDL. Comments justify each design decision and tag it to a course requirement.
- `docs/architecture.md` · `docs/database.md` · `docs/data-and-etl.md` — prose docs derived from the two above; `docs/README.md` is the index.
- `docs/erd/README.md` — ERD diagram index and Chen-notation legend.

## The core architectural idea

One PostgreSQL instance, **three schemas**, deliberately mixing an analytical read-only corpus with a transactional study layer — separated by schema design, not separate systems:

| Schema | Role | Runtime writes |
|---|---|---|
| `staging` | Transient typed/JSONB tables for the ELT load | Dropped after load |
| `corpus` | Read-only reference data (hadiths, isnad chains, narrators, gradings) | **None** — revoked from the app role |
| `app` | User & study layer (circles, sets, assignments, progress, reviews) | Yes (OLTP) |

"Read-only" is enforced by permissions (`REVOKE` on `corpus.*` + `DROP SCHEMA staging`), not by convention. This is a graded requirement, not a nicety — preserve it. **Never introduce a runtime write path into `corpus.*`.**

## Design invariants (do not "fix" these — they are intentional and graded)

- **Isnad positions are stored explicitly** in `corpus.isnad_links` (a weak entity, propagation order: Companion first, compiler last). Chain traversal is therefore **aggregation, not recursion** — do not rewrite it with `WITH RECURSIVE`; that would be artificial (PRD req 8).
- **`app.assign_study_set` is a PROCEDURE, not a function**, specifically because it owns its own `COMMIT`/`ROLLBACK` (Postgres functions cannot). This is the deliberate req-5-vs-req-6 distinction.
- **Rijal grades: raw strings are for display, ordinals are for math.** `narrators.rank_*_raw` strings render as-is; computation goes through `rank_map → rank_levels`. Keep the three-way distinction graded / named-but-ungraded / unnamed.
- **Triggers fire on user (`app`) writes only** — `trg_progress_stats` (derived counts) and `trg_progress_audit` (mastery changes → `audit_log` shadow table). The corpus never fires triggers.
- **`corpus.chain_strength(hadith_id)`** is a transparent, documented metric (weakest-link per sanad, best sanad wins; ʿanʿana penalized; placeholders/unresolved weakening). Keep it simple and explainable — every routine must be defensible line-by-line (req 9).
- User role specialization (`students` / `teachers` / `admins`) uses **table inheritance** (IS-A) off `app.users`.

Each feature appears **once**, where it belongs — no redundant routines, no corpus writes at runtime, no fake recursion. Restraint is explicitly graded (req 8); read `docs/prd.md` §5 before adding any routine.

## Commands

Load the schema into a local Postgres (14+; 11+ works for `CREATE PROCEDURE`):

```bash
createdb ilham
psql -d ilham -f db/schema.sql
```

Re-render an ERD diagram from its Graphviz source (font: DejaVu Sans Mono, covers Arabic labels):

```bash
dot -Tsvg docs/erd/full/01_overview.dot -o docs/erd/full/01_overview.svg
```

There is no build/test/lint tooling yet (no app code). When `backend/`/`frontend/` are scaffolded, add their commands here.

## Data & ETL context

The corpus is loaded once via an ELT pipeline: raw JSON (mini data lake) → Node streams into `staging.raw_*` JSONB → **all shaping done in SQL** (`jsonb_array_elements WITH ORDINALITY` explodes chains) → typed `corpus` tables → narrator resolution passes A/B → `REVOKE` + `DROP SCHEMA staging`. The corpus is fully Arabic; English is available only where MIS/LK sources align, with Arabic fallback. Primary dataset is the Ifta Sunnah Hadith & Narrators Dataset; MIS provides validation + English narrator names; LK is optional English enrichment.

## Git conventions

- **Do not add a `Co-Authored-By` trailer** to commits (or any AI-attribution trailer).
- Keep proper git hygiene: never commit directly to `master` for feature work — branch first, then open a PR. Commit and push only when asked.
- Write clear, conventional commit messages matching the existing history (e.g. `feat: ...`, `initial: ...`).
- After changing the schema, keep the ERD `.dot`/rendered images (`docs/erd/`), the prose docs (`docs/`), and `docs/prd.md` consistent with the DDL — they are graded deliverables that must not drift from `db/schema.sql`.
