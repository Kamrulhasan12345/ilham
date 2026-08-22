# Ilham (إلهام)

> A hadith study platform. A teacher leads the study. The data is a fixed corpus
> of canonical hadith collections.

Ilham has two parts. The first part is a **read-only corpus**. It holds hadith
texts (matn), chains of narrators (isnad) in transmission order, the
transmission word for each link, and narrator profiles with classical *rijal*
grades. The second part is a **study layer**. Students join circles (halaqa).
They collect hadiths into study sets. They complete assignments. They record
review sessions.

The corpus is truly read-only. The pipeline loads it one time. The database then
removes write permission with `REVOKE`. Permission does the work, not
convention.

The design puts an analytical corpus and a transactional study layer in **one
PostgreSQL instance**. Schemas separate them, not different systems. This is
deliberate.

Ilham is a term project for a database course. Two persons build it. The current
deliverable is the **complete database design**: the DDL, the ERD set, and the
product specification.

Every document in this repository uses ASD-STE100 Simplified Technical English.

---

## Status

| Area | State |
|---|---|
| Product requirements (`docs/prd.md`) | ✅ Final |
| Database schema (`db/`) | ✅ Complete. Schemas, tables, functions, procedure, triggers, queries |
| ERD diagrams (`docs/erd/`) | ✅ Chen-notation set and crow's-foot set |
| ETL pipeline (`etl/`) | ✅ Loads the real corpus. 14,901 hadiths, 99.58% narrator resolution |
| Backend (`backend/`) | 🚧 Scaffolded. Hono + TypeScript API over the read-only corpus |
| Frontend (`frontend/`) | ⏳ Not started |

**Stack:** PostgreSQL · Hono (Node.js, TypeScript) · React

---

## Repository layout

```
ilham/
├── compose.yaml               # PostgreSQL 16 + optional ETL container
├── db/                        # DDL. Run the files in numeric order
│   ├── 00_init.sql            # Schemas + normalize_arabic, with a self-test
│   ├── 01_corpus.sql          # Read-only layer, isnad_edges, chain_strength
│   ├── 02_app.sql             # ISA hierarchy, OLTP tables, triggers, procedure
│   ├── 03_staging.sql         # Temporary ETL surface. Deleted after the load
│   ├── 04_seed_reference.sql  # The rank_levels ordinal scale
│   ├── 05_post_load.sql       # ONE TIME, destructive. Index, revoke, drop staging
│   ├── 98_smoke_test.sql      # 13 checks against synthetic data
│   ├── run_container.sh       # PostgreSQL in podman or docker, without compose
│   └── run_ddl.sh             # 00 → 04 and the smoke test, against a live server
├── etl/                       # Source files → staging → corpus
│   ├── src/                   # cli, extract, load, shape, stream readers
│   ├── sql/                   # Stages 10 → 19, staging → corpus
│   ├── rank_map.sql           # The curated rijal grade map
│   └── narrator_overrides.sql # Per-narrator grade claims, each one justified
├── docs/                      # Documentation. Start at docs/README.md
│   ├── README.md              # The index
│   ├── prd.md                 # Product requirements
│   ├── architecture.md        # The three-schema design
│   ├── database.md            # Schema reference
│   ├── data-and-etl.md        # Datasets and the pipeline
│   └── erd/                   # The diagram sets
├── backend/                   # Hono + TypeScript API (corpus reads scaffolded)
└── frontend/                  # React application (planned)
```

---

## Architecture

One PostgreSQL instance holds three schemas:

| Schema | Job | Writes at runtime |
|---|---|---|
| `staging` | Temporary typed tables for the load | Deleted after the load |
| `corpus` | Reference data: hadiths, chains, narrators, grades | **No.** Permission removed |
| `app` | Users and study data. Every runtime write | Yes |

### The corpus — read-only and analytical

- `collections → chapters → hadiths` is the bibliographic hierarchy.
  `hadith_translations` holds optional text in other languages.
- `isnad_links` is a **weak entity**. Each row stores the position of one
  narrator in one chain. The order is the order of transmission. The Companion is
  first and the compiler is last. The positions are explicit, so a chain walk is
  aggregation and **not** recursion. `isnad_edges` is a derived view.
- `narrators` holds the profiles and the classical *rijal* grades of Ibn Hajar
  and al-Dhahabi. The raw strings are for display. The ordinal codes
  (`rank_ibn_hajar` and `rank_dhahabi` → `rank_levels`) are for computation. The
  map from string to code runs at load time only. The schema keeps three
  different states apart: **graded**, **named but ungraded**, and **unnamed**.
- `chain_strength(hadith_id)` is a stored function. It gives a clear
  chain-quality value. It takes the weakest link in each sanad, then the best
  sanad. Graded ranks give weights. An ʿanʿana link gets a penalty. Placeholders
  and unresolved names make a chain weaker.

### The study layer — read-write and transactional

- `users` has three subtypes: `students`, `teachers`, and `admins`. The schema
  uses **table inheritance** for this IS-A relation.
- `circles → enrollments`, `study_sets → set_items`, `assignments`, `progress`
  (one row for each **student, hadith, and assignment**), `review_sessions →
  review_items`, and `notes`.
- `student_stats` holds derived counts. A trigger maintains them.
- `audit_log` is a shadow table. A trigger records mastery changes in it.

---

## Key database objects

| Object | Type | Purpose |
|---|---|---|
| `app.assign_study_set(circle, set, due)` | **Procedure** | Creates an assignment and one progress row for each student and hadith. It owns its `COMMIT`, which a function cannot do. It has no `EXCEPTION` handler, because a handler makes the `COMMIT` illegal |
| `corpus.chain_strength(hadith_id)` | Function | The chain-quality value. Aggregation, not recursion |
| `trg_progress_stats` | Trigger | Recomputes the derived student counts on each progress write |
| `trg_progress_audit` | Trigger | Records mastery changes in the `audit_log` shadow table |
| `assert_user_exists` and `assert_email_unique` | Trigger functions | Restore the integrity that table inheritance cannot give. See `docs/database.md` |
| Q1–Q6 | Analytical queries | Top narrators · Contested narrators · Shared narrators · Circle overview · Weakest chains · Assignment completion |

Triggers fire on **user writes only**. The corpus never takes a runtime write.

---

## Data sources

| Source | Role |
|---|---|
| **Ifta Sunnah Hadith & Narrators Dataset** (Kaggle; sunnah.alifta.gov.sa). 276,347 hadiths, 33 books, 20,957 narrator profiles | **Primary corpus.** Text, chains, narrator identifiers, and *rijal* grades. **Loaded now: Sahih al-Bukhari and Sahih Muslim = 14,901 hadiths.** A manifest drives the loader, so it extends to all 33 books |
| **Multi-IsnadSet (MIS)** (Mendeley, CC BY 4.0). Sahih Muslim, ordered chains | **Validation** and English narrator names |
| **LK-Hadith-Corpus** (Leeds and King Saud, LREC 2020) | English text for `hadith_translations`. The join is on Arabic text. Coverage is 95.3% |

Arabic is canonical. English is optional in three places: hadith text
(`hadith_translations`), narrator names (`narrators.name_en`), and collection
titles. Each one falls back to Arabic when it is absent.

### The pipeline

```
raw JSON and CSV on disk        (the data lake — read the schema on use)
  → Node streams the files and flattens the structure into staging
  → SQL does all the meaning: dimensions, resolution, grades, translations
  → typed corpus tables (loaded one time)
  → narrator resolution, pass A and pass B
  → apply staging.rank_map to the narrators
  → attach the English text by Arabic text match
  → REVOKE writes from the app role + DROP SCHEMA staging
```

---

## Getting started

You need a container engine on the host. **Podman and docker both work.** You do
not need a local PostgreSQL, and we do not recommend one. The schema needs
`server_encoding=UTF8` and a fixed collation. A container pins both. This is what
makes the numbers reproduce on a different machine.

### 1. Start the database

```bash
podman compose up -d db        # or: docker compose up -d db
podman compose logs -f db      # watch it load
```

This one command is enough on **any** host, including native Windows PowerShell
or cmd — no bash, no other tool required. The repo carries a committed snapshot
at `db/ilham.dump`: the real corpus (14,901 hadiths) and a seeded study layer,
already sealed. The container's own init script restores it automatically on
first start, in a few seconds.

If `db/ilham.dump` is ever absent, the same init script falls back to loading
just the empty schema plus `db/98_smoke_test.sql`, which makes 13 checks against
synthetic data. **In that case, make sure all 13 checks print `PASS`** — if one
fails, stop and read the log, because nothing after that point is correct.

The database listens on `127.0.0.1:5432`. The database name is `ilham`, the user
is `postgres`, and the password is `ilham`. The data lives in a named volume.
The command `down` keeps the data. The command `down -v` deletes it, and the next
`up` repeats the restore-or-fallback above.

```bash
podman compose exec db psql -U postgres -d ilham     # open a shell
```

<details>
<summary><b>Podman: <code>cannot connect to podman.sock</code></b></summary>

The command `podman compose` calls the Docker Compose binary. That binary speaks
the Docker API and needs the socket:

```bash
systemctl --user enable --now podman.socket
```

You can also use `podman-compose`, the Python implementation. It talks to podman
directly and needs no socket. Both accept this `compose.yaml` without a change.
</details>

<details>
<summary><b><code>psql: /db/00_init.sql: Permission denied</code></b></summary>

The init scripts run as the container user `postgres`, which is uid 70. A
rootless bind mount shows your files as root-owned, so mode `0600` is unreadable
to that user. Run `chmod 644 db/*.sql`.

Git does not track read bits, so a new clone does not have this problem. A
restrictive local umask does.
</details>

<details>
<summary><b>The container is <code>healthy</code>, but it refuses connections</b></summary>

`podman-compose` runs the services in a **pod**. The published port belongs to
the infra container of that pod, not to `ilham-pg`. If an older pod still exists,
the container joins it and takes its empty port map. The command
`podman port ilham-pg` then reports `5432/tcp -> 127.0.0.1:5432` while nothing
listens.

Use `podman compose down` and then `up`. Do not use `stop` and `start`. Only
`down` removes the pod. `down` keeps your data; only `down -v` deletes it. Docker
has no pods and does not have this problem.
</details>

### 2. Prefer the CLI? `db/run_container.sh`

`compose.yaml` above is the simplest path — it needs no bash. `db/run_container.sh`
wraps the same container with a few convenience commands, for anyone who'd
rather drive it directly:

```bash
./db/run_container.sh bootstrap  # same restore-or-fallback logic as compose,
                                  #   plus it's idempotent: safe to re-run,
                                  #   never touches data already there
./db/run_container.sh dump       # refresh db/ilham.dump after a schema/corpus
                                  #   change, from an already-populated instance
./db/run_container.sh reset      # destroy the container and start clean
```

**On Windows**, this script needs a real shell — plain PowerShell or cmd cannot
run it (`docker compose up -d db` above has no such requirement). Use **WSL2**
(real Linux bash, and Docker Desktop already needs it as its backend, so it's
usually already installed) or **Git Bash** — the script sets `MSYS_NO_PATHCONV`
itself, the standard fix for Git Bash's MSYS runtime otherwise mangling the
container-side paths it passes to `docker`.

### 3. Build the corpus from scratch (optional)

The committed dump above already has real data. This section is for rebuilding
it — from a newer Kaggle dump, or while working on the ETL pipeline itself. You
need the Ifta dataset of about 710 MB. It is not in the repository. See
[`etl/README.md`](etl/README.md) for the download and the full run order.

The short version, with node on the host:

```bash
cd etl && npm install && cp .env.example .env
npm run verify && npm run doctor        # check the hashes, then preflight
psql -f rank_map.sql -f narrator_overrides.sql
npm run all && npm run seed
```

This takes about one minute. It gives 14,901 hadiths, 139,629 chain positions,
and 20,957 narrators. Narrator resolution is 99.58%. A rijal grade covers 98.57%
of the chain positions. The pipeline writes every number to
`corpus.etl_metrics`. A full rebuild gives the same numbers again.

**Without node on the host**, run the same commands in a container:

```bash
podman compose --profile tools run --rm etl npm run doctor
podman compose --profile tools run --rm etl npm run all
```

Then run the last file one time. It is destructive. It removes write permission
on `corpus.*` and deletes the `staging` schema. After it, the corpus is
read-only **by permission** and not by convention:

```bash
psql -h 127.0.0.1 -U postgres -d ilham -f db/05_post_load.sql
```

To share the result instead of making everyone redo the steps above, refresh
the committed snapshot and commit it:

```bash
./db/run_container.sh dump      # writes db/ilham.dump
```

### Rebuild the ERD diagrams

The diagrams are Graphviz `.dot` files. To render one again:

```bash
dot -Tsvg docs/erd/relational/schema.dot -o docs/erd/relational/schema.svg
```

The font is DejaVu Sans Mono. It covers the Arabic labels. See
[`docs/erd/README.md`](docs/erd/README.md) for the diagram index and the notation
legend.

---

## Roadmap

The PRD gives a plan of 10 weeks:

1. Schema, pipeline, and authentication.
2. Routines: the procedure, the transactions, the triggers, and `chain_strength`.
3. React: browse the corpus, make sets, run circles, give assignments.
4. Analytics, review, and the teacher override flow.
5. Hardening.

Three stretch goals remain. Cut them in this order if time is short:
spaced-repetition scheduling, then more English text, then MIS validation.

## Scope

**Out of scope:** corpus content from users, new authenticity rulings, audio and
recitation detection, third-party authentication, and any growth past one
instance.

Ilham shows classical grades and one clear chain metric. It gives no religious
judgement.

---

## Documentation

The full documentation is in **[`docs/`](docs/README.md)**:

- **[`docs/prd.md`](docs/prd.md)** — product requirements: datasets, personas,
  features, the requirement map, the ownership split, milestones, and risks.
- **[`docs/architecture.md`](docs/architecture.md)** — the three-schema design and
  the request flows.
- **[`docs/database.md`](docs/database.md)** — schema reference: tables, routines,
  triggers, and the design rules.
- **[`docs/data-and-etl.md`](docs/data-and-etl.md)** — datasets and the pipeline.
- **[`docs/erd/README.md`](docs/erd/README.md)** — the diagram index and the
  notation legend.
- **[`db/README.md`](db/README.md)** — the DDL from `00` to `05`. The comments
  explain each decision.
- **[`etl/README.md`](etl/README.md)** — the pipeline: how to get the data, what
  the real corpus changed, and the coverage numbers.
