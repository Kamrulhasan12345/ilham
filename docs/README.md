# Ilham documentation

Documentation for Ilham (إلهام), a teacher-led hadith study platform built as a
DBMS course term project. The current deliverable is the **database design**;
`backend/` and `frontend/` are not yet scaffolded.

## Index

| Document | What it covers |
|---|---|
| [`prd.md`](prd.md) | **Product requirements** — datasets, personas, features, the graded requirement mapping (§5), ownership split (§7), milestones, risks. The source of truth for *what* is being built. |
| [`architecture.md`](architecture.md) | The **big-picture design**: three-schema Postgres layout, the corpus/study (OLAP/OLTP) split, and how read-only is enforced. |
| [`database.md`](database.md) | **Schema reference**: tables per layer, the key routines/triggers, the analytics queries, and the design invariants that are graded (and must not be "fixed"). |
| [`data-and-etl.md`](data-and-etl.md) | **Datasets and the ELT pipeline**: sources, narrator resolution, and how the corpus is loaded once then locked read-only. |
| [`erd/`](erd/README.md) | **Entity–relationship diagrams** — seven Chen-notation diagrams (full + plain variants), the notation legend, and rebuild instructions. |

## Related files

- [`../db/schema.sql`](../db/schema.sql) — the complete annotated DDL. Its inline
  comments are authoritative; the docs here summarize and cross-link them.
- [`../README.md`](../README.md) — project overview and getting-started.
- [`../CLAUDE.md`](../CLAUDE.md) — guidance for AI coding agents.
