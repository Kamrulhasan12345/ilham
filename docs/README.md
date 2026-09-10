# Ilham documentation

Ilham (إلهام) is a hadith study platform. A teacher leads the study. The project
is a term project for a database course. The current deliverable is the
**database design**. `backend/` holds a read-only API over the corpus. `frontend/`
is empty, and [`frontend-prd.md`](frontend-prd.md) says what goes in it.

Every document in this project uses ASD-STE100 Simplified Technical English.

## Index

| Document | Contents |
|---|---|
| [`prd.md`](prd.md) | **Product requirements.** Datasets, personas, features, the graded requirement map (§5), the ownership split (§7), milestones, and risks. This document says *what* the team builds. |
| [`frontend-prd.md`](frontend-prd.md) | **The React application.** The settled decisions, the Docker topology, authentication, the routes, the screens, the API contract, the build order, and the states the interface must show. |
| [`design/`](design/README.md) | **The design system.** The tokens, the type and colour rules, the isnad ladder, progressive disclosure, and the plain-language rules. It holds a live specimen and a prototype. |
| [`architecture.md`](architecture.md) | **The design as a whole.** The three schemas, the split between the corpus and the study layer, and how the database makes the corpus read-only. |
| [`database.md`](database.md) | **Schema reference.** The tables in each layer, the routines and triggers, the analytical queries, and the design rules that you must not change. |
| [`data-and-etl.md`](data-and-etl.md) | **Datasets and the pipeline.** The sources, narrator resolution, grade mapping, translations, and how the load seals the corpus. |
| [`erd/`](erd/README.md) | **Entity-relationship diagrams.** The Chen-notation set, the crow's-foot set, the notation legend, and the rebuild commands. |

## Related files

- [`../db/README.md`](../db/README.md) — the DDL. The files run in numeric order,
  from `00_init` to `05_post_load`. The comments in those files are correct. The
  documents here give a summary and link to them.
- [`../etl/README.md`](../etl/README.md) — the pipeline. How to get the data, what
  the real source changed, and the coverage numbers.
- [`../README.md`](../README.md) — the project overview and the first steps.
- [`../CLAUDE.md`](../CLAUDE.md) — instructions for AI coding agents.
