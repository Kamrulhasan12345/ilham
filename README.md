# Ilham (إلهام)

> A teacher-led hadith study platform built on a fixed, richly-structured corpus of canonical hadith collections.

Ilham pairs a **read-only scholarly corpus** — hadith texts (matn), chains of narrators (isnad) in propagation order, per-link transmission words, and narrator profiles bearing classical *rijal* gradings — with a **teacher-led study layer** where students join circles (halaqa), organize hadiths into study sets, complete assignments, and log review sessions.

The corpus is genuinely read-only: loaded once through a staging-JSONB ELT pipeline, then locked down by database permissions (`REVOKE`), not by convention. The design deliberately places a warehouse-like analytical corpus (OLAP-flavored) and a classic OLTP study layer in **one PostgreSQL instance, separated by schema** — not by separate systems.

This is a **DBMS course term project** (2-person team). The current deliverable is the **complete database design**: the DDL, the ERD set, and the product spec.

---

## Status

| Area | State |
|---|---|
| Product requirements (`docs/prd.md`) | ✅ Final |
| Database schema (`db/schema.sql`) | ✅ Complete DDL — schemas, tables, functions, procedure, triggers, queries |
| ERD diagrams (`docs/erd/`) | ✅ Seven Chen-notation diagrams |
| Backend (`backend/`) | ⏳ Not started |
| Frontend (`frontend/`) | ⏳ Not started |

**Stack:** PERN — **P**ostgreSQL · **E**xpress · **R**eact · **N**ode

---

## Repository layout

```
ilham/
├── db/
│   └── schema.sql             # Complete DDL: staging + corpus + app schemas, routines, triggers
├── docs/                      # Project documentation (start at docs/README.md)
│   ├── README.md              # Docs index
│   ├── prd.md                 # Final product requirements — the source of truth
│   ├── architecture.md        # Big-picture design: the three-schema split
│   ├── database.md            # Schema reference: tables, routines, triggers, invariants
│   ├── data-and-etl.md        # Datasets + the ELT pipeline
│   └── erd/                   # Chen-notation ERD set (full / plain / exports)
├── backend/                   # Express/Node API (planned)
└── frontend/                  # React app (planned)
```

---

## Architecture

Three PostgreSQL schemas inside a single instance:

| Schema | Role | Writable at runtime? |
|---|---|---|
| `staging` | Transient flat/typed tables for the ELT load | Dropped after load |
| `corpus` | Read-only reference data (hadiths, chains, narrators, gradings) | **No** — writes revoked from the app role |
| `app` | User & study layer — all runtime writes | Yes (OLTP) |

### The corpus (read-only, analytical)

- `collections → chapters → hadiths` — bibliographic hierarchy with natural keys; `hadith_translations` carries optional per-language text.
- `isnad_links` — a **weak entity** storing each narrator's position in a hadith's chain, in propagation order (Companion first, compiler last). Positions are stored explicitly, so chain traversal is aggregation, **not** recursion. `isnad_edges` is a derived view.
- `narrators` — profiles with classical *rijal* ranks from Ibn Hajar and al-Dhahabi. Raw strings are displayed; normalized ordinals (`rank_ibn_hajar` / `rank_dhahabi` → `rank_levels`) drive computation. The raw-string→code map is load-time only (`staging.rank_map`). A three-way distinction is preserved: **graded / named-but-ungraded / unnamed**.
- `chain_strength(hadith_id)` — a stored function computing a transparent chain-quality metric (weakest-link per sanad, best sanad wins; graded ranks weighted, ʿanʿana penalized, placeholders/unresolved treated as weakening).

### The study layer (read-write, transactional)

- `users` with role specialization (`students` / `teachers` / `admins`) via **table inheritance** (IS-A).
- `circles → enrollments`, `study_sets → set_items`, `assignments`, `progress` (keyed per **student × hadith × assignment**), `review_sessions → review_items`, `notes`.
- `student_stats` — trigger-maintained derived counts.
- `audit_log` — a shadow table capturing teacher overrides via trigger.

---

## Key database objects

| Object | Type | Purpose |
|---|---|---|
| `app.assign_study_set(circle, set, due)` | **Procedure** | Multi-table fan-out to enrolled students + progress init; owns its own `COMMIT` (procedures can, functions can't). No `EXCEPTION` handler — that would make the `COMMIT` illegal |
| `corpus.chain_strength(hadith_id)` | Function | Derived chain-strength metric (aggregation, not recursion) |
| `trg_progress_stats` | Trigger | Recompute-and-store derived student stats on progress writes |
| `trg_progress_audit` | Trigger | Log mastery changes to the `audit_log` shadow table |
| `assert_user_exists` / `assert_email_unique` | Trigger fns | Restore the referential integrity table inheritance cannot express (see `docs/database.md`) |
| Q1–Q6 | Analytics queries | Top Narrators · Contested Narrators (Ibn Hajar vs al-Dhahabi) · Shared narrators · Circle overview · Weakest chains · Assignment completion |

Triggers fire on **user writes only** — the corpus never takes runtime writes.

---

## Data sources

| Source | Role |
|---|---|
| **Ifta Sunnah Hadith & Narrators Dataset** (Kaggle; sunnah.alifta.gov.sa) — 276K hadiths, 33 books, 20,957 narrator profiles | **Primary corpus** — text, chains, narrator IDs, *rijal* ranks |
| **Multi-IsnadSet (MIS)** (Mendeley, CC BY 4.0) — Sahih Muslim, ordered chains | **Validation** + English narrator names |
| **LK-Hadith-Corpus** (Leeds/King Saud, LREC 2020) | Optional bulk feeder for `hadith_translations` |

The corpus is canonically Arabic, with optional English for hadith text (`hadith_translations`), narrator names (`narrators.name_en`, MIS) and collection titles — always with graceful Arabic fallback.

### ELT pipeline

```
raw JSON on disk (mini data lake, schema-on-read)
  → Node streams book arrays, flattening structurally into staging typed tables
  → all SEMANTIC shaping in SQL (dimensions, normalization, typed loads)
  → typed corpus tables (warehouse-like, loaded once)
  → narrator resolution passes A/B (canonical-name match + positional zip)
  → apply staging.rank_map to narrators
  → REVOKE writes from app role + DROP SCHEMA staging
```

---

## Getting started

### Prerequisites

- PostgreSQL **14+** (11+ works for `CREATE PROCEDURE`)

### Load the schema

```bash
createdb ilham
psql -d ilham -f db/schema.sql
```

This creates the `staging`, `corpus`, and `app` schemas with all tables, the `chain_strength` function, the `assign_study_set` procedure, and both triggers. The corpus is seeded separately by the (planned) ELT loader; after loading, writes to `corpus.*` are revoked and `staging` is dropped so the corpus is read-only **by permissions**.

### Rebuild the ERD diagrams

Diagrams are Graphviz `.dot` sources. To re-render:

```bash
dot -Tsvg docs/erd/full/01_overview.dot -o docs/erd/full/01_overview.svg
```

Font used: DejaVu Sans Mono (covers the Arabic labels). See [`docs/erd/README.md`](docs/erd/README.md) for the full diagram index and Chen-notation legend.

---

## Roadmap

The PRD lays out a 10-week plan: schema + ELT + auth → routines (procedure, transactions, triggers, `chain_strength`) → React corpus browse / sets / circles / assignments → analytics & review/override flow → hardening. Stretch goals (cut in this order if slipping): spaced-repetition scheduling → LK bulk translation import → MIS validation.

## Scope

**Out of scope:** user-generated corpus content, new authenticity rulings, audio/recitation detection, third-party auth, and any scaling beyond a single instance. Ilham displays classical gradings and a transparently-derived chain metric — it issues no religious judgments.

---

## Documentation

Full documentation lives in **[`docs/`](docs/README.md)**:

- **[`docs/prd.md`](docs/prd.md)** — the complete product requirements: datasets, personas, features, requirement mapping, ownership split, milestones, and risks.
- **[`docs/architecture.md`](docs/architecture.md)** — the big-picture three-schema design and request flows.
- **[`docs/database.md`](docs/database.md)** — schema reference: tables, routines, triggers, and the graded design invariants.
- **[`docs/data-and-etl.md`](docs/data-and-etl.md)** — datasets and the ELT pipeline.
- **[`docs/erd/README.md`](docs/erd/README.md)** — ERD diagram index and Chen-notation legend.
- **[`db/schema.sql`](db/schema.sql)** — the annotated DDL; comments explain each design decision.
