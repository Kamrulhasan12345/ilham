# Ilham — the SQL layer

The tables here come from the Chen ERDs in `../docs/erd/`. Those diagrams stay
the conceptual reference. Each table below maps to an entity or a relationship in
one of them.

The DDL is checked against PostgreSQL 16. The minimum version is 14.

## Run order

```bash
./run_container.sh test              # PostgreSQL 16 in podman or docker, then
                                     #   00 → 04 and the smoke test. It publishes
                                     #   port 5432, so the Node ETL on the host
                                     #   can reach it.
# or, against a PostgreSQL you already have:
./run_ddl.sh ilham test              # 00 → 04, then the smoke test

cd ../etl
npm install && cp .env.example .env
npm run verify && npm run doctor     # hash the sources, then preflight
npm run profile                      # read the output
psql -d ilham -f rank_map.sql        # curated. `npm run rankmap` makes the worklist
psql -d ilham -f narrator_overrides.sql
npm run all                          # extract + load + stages 10 → 19
npm run seed
psql -d ilham -f ../db/05_post_load.sql
```

The files `rank_map.sql` and `narrator_overrides.sql` fill `staging`. Run them
again after each `run_ddl.sh` rebuild. They survive `npm run load`, which
truncates only the tables it fills.

| File | Purpose |
|---|---|
| `00_init.sql` | The schemas and `normalize_arabic`, with a self-test that stops the load if the function misbehaves |
| `01_corpus.sql` | The read-only layer, the `isnad_edges` view, and `chain_strength` |
| `02_app.sql` | The ISA hierarchy, the OLTP tables, both triggers, and `assign_study_set` |
| `03_staging.sql` | The temporary ETL surface |
| `04_seed_reference.sql` | The `rank_levels` ordinal scale |
| `98_smoke_test.sql` | Runs every mechanism against synthetic data |
| `10_dimensions.sql` | staging → collections, chapters |
| `11_corpus_load.sql` | staging → hadiths, narrators, isnad_links |
| `12_resolve.sql` | Narrator resolution: pass A, pass B, ambiguity, conflicts |
| `13_ranks.sql` | Applies the curated grade map in four passes |
| `14_translations.sql` | The optional English feeder, with a five-tier Arabic text match |
| `19_reconcile.sql` | The metrics snapshot and the hard gate |
| `05_post_load.sql` | Deferred indexes, ANALYZE, the gate, the lockdown, and the deletion of staging |

The file `05` is destructive and runs one time. The script `run_ddl.sh` is
destructive on every run.

## What changed from the draft, and why

### Correctness

**`normalize_arabic` did not trim.** The whitespace rule reduced interior runs but
left the ends. The string <span dir="rtl">' علي '</span> therefore normalised to
<span dir="rtl">' علي '</span>, and every equality join against `name_norm`
missed with no error. We confirmed this on PG16 before the fix.

The fix adds `btrim()`, widens the combining range to `064B–065F`, and folds the
hamza carriers <span dir="rtl">ؤ</span> and <span dir="rtl">ئ</span>. The
`\uXXXX` escapes were checked and do work, because ASCII survives.

**Resolution pass A was not deterministic.** The statement
`UPDATE … FROM corpus.narrators WHERE name_norm = normalize_arabic(raw_name)`
picks an arbitrary row when several match. The column `name_norm` cannot be
unique across 21,000 narrators after normalisation.

`staging.name_index` now holds the candidate count. Pass A fires only on a unique
match. An ambiguous match gets its own resolution code, `'C'`, instead of a
disguise as `'A'`.

**Chapter identity was the title.** Many chapters carry the bare title
<span dir="rtl">باب</span>, so `SELECT DISTINCT chapter_ar` merges them and
misfiles every hadith beneath them. Identity is now `(collection_id, seq)`. The
loader supplies `seq` from the source order.

**The anʿana penalty was dead.** `chain_strength` compared raw text to
<span dir="rtl">عن</span>, which never matches the vocalised
<span dir="rtl">عَنْ</span>. The schema adds a generated `transmission_norm`
column and compares against that. The smoke test checks that the penalty fires.

**`resolution` was never set to `'X'`**, and the A-against-B cross-check that the
comment promised could not run. The `WHERE narrator_id IS NULL` clause of pass B
excludes every row that pass A already resolved. The conflict report now has its
own table.

**`staging.lk_hadiths` was referenced but never created.** It now exists, and it
uses a surrogate key instead of `(book_slug, hadith_num)`. LK repeats 19 Bukhari
numbers and writes 129 more as ranges, so that key stops the `COPY`.

The number is not a join key either. LK numbers Muslim from 1 to 7314 straight
through, where Ifta uses the grouped 1 to 3033. **99.94%** of the Muslim pairs
that match on text carry a different number. Stage 14 joins on normalised Arabic
text instead.

### Performance

**`app.progress` had no usable index on `student_id`.** The function
`sync_student_stats()` reads the whole progress history of a student on each
inserted row. Both unique indexes start with `student_id`, but both are
*partial*, so neither one serves an unfiltered scan. A fan-out of 20 students by
50 hadiths did 1,000 sequential scans.

The fix adds that index. It also adds indexes on `assignment_id`, `hadith_id`,
and the foreign-key columns of `set_items`, `enrollments`, `review_items`,
`notes`, `circles`, and `assignments`.

**`hadiths_matn_norm_idx` moved to `05_post_load.sql`.** It is an expression index
that nothing reads during the load, so to maintain it through the bulk `COPY`
gives no benefit. This matters at the 276,000 rows of the full dataset, and the
shape is still correct at the 14,901 rows loaded now.

### Additions

- `corpus.etl_metrics` survives `DROP SCHEMA staging` on purpose. Every
  reconciliation number that the report quotes comes from staging, and staging
  stops existing at the end of the load.
- `staging.rejects` records everything. Nothing is dropped in silence.
- `corpus.narrators.display_norm` exists because chain strings are disambiguated
  forms. They sometimes sit closer to `display_name` than to `name`. Resolution
  tries both.
- The lockdown in `05` turns "the corpus is read-only" from a convention into a
  permission.

## Two limits to know before you write the API

**A subquery is illegal in a `CALL` argument.** The statement
`CALL app.assign_study_set((SELECT circle_id …), …)` raises *cannot use subquery
in CALL argument*. Node must select the identifiers first and pass them as `$1`,
`$2`, and `$3`.

**A generated column breaks a positional `INSERT`.** Both
`corpus.isnad_links` and `corpus.narrators` carry generated columns. Every insert
against them needs an explicit column list.

## Smoke test coverage

The file `98_smoke_test.sql` makes these checks, and all of them pass now:

- `chain_strength` across five cases: graded, vocalised anʿana, weak narrator,
  the placeholder floor, and the best of several sanads.
- `normalize_arabic` edge punctuation and first-word extraction.
- The `rank_*_via` columns exist and refuse a code outside `E/T/S/O`.
- `hadith_translations.match_via` refuses a code outside `E/P/6/4/M`, and the key
  allows one English row for each hadith.
- The scan semantics of the ISA hierarchy. `FROM users` gives 6 and
  `FROM ONLY users` gives 0. `user_id` is unique across the subtypes.
- An email collision across subtypes is refused. (Gap 1)
- A polymorphic user reference to a missing user is refused. (Gap 2)
- The fan-out arithmetic of `assign_study_set`, and that a second call creates a
  second obligation instead of a duplicate.
- Trigger 4a counts *distinct* hadiths across two assignments.
- Trigger 4b captures the actor from `ilham.user_id`.
- A failed fan-out rolls back completely.
- All five analytical queries execute against the real schema.

Six of these are **negative** checks. They prove that the database refuses bad
input. A test that proves success only cannot find a constraint that nobody
created.

## Next

Phase 2 is the ETL. It lives in `../etl` and it loads the real corpus. Phase 3 is
the PERN application. Nobody has built it yet.
