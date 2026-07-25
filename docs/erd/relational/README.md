# Relational (crow's-foot) ERD

One diagram, every table in the schema, drawn the conventional way: each table is
a box listing its columns with types and key badges, and every edge is a real
referential constraint landing on the exact column it references.

This is the counterpart to the Chen-notation sets in `../full/`, `../plain/` and
`../chen/`. Chen notation answers *"what are the entities and relationships?"*;
this answers *"what does the DDL actually create?"* — so it is the one to read
next to `db/schema.sql`.

| Diagram | Covers | Tables |
|---|---|---|
| `schema` | **Everything in one graph** — all three schemas and every constraint | 27 + 1 view |
| `corpus` | The read-only layer alone | 7 + 1 view |
| `app` | The writable layer alone, with `corpus.hadiths` as a stub | 15 |
| `staging` | The ELT scratch space alone, with its corpus targets as stubs | 5 |

Each renders to `.svg` (use this — the diagrams are large) and `.png` at 150 dpi.

The three layer diagrams are extracts, not rewrites: every table's definition is
byte-identical to the one in `schema.dot`. Read `schema` for how the layers fit
together, and the layer files when you want one schema on one slide.

## Rebuild

```bash
cd docs/erd/relational
for f in schema corpus app staging; do
  dot -Tsvg "$f.dot" -o "$f.svg"
  dot -Tpng -Gdpi=150 "$f.dot" -o "$f.png"
done
```

Render with **`dot`**, not neato/sfdp. The edges attach to individual column
rows via ports, and only a layered engine keeps them untangled. (The `chen/`
Chen set is the opposite case — it is force-directed on purpose.)

## Keeping the four files in sync

Each table's HTML block appears in `schema.dot` **and** in its layer file. A
column change therefore has to be made in both. This check proves the blocks
have not diverged — run it after editing any of them:

```bash
cd docs/erd/relational
python3 - <<'PY'
import re
def blocks(p):
    return dict(re.findall(r'^\s*([a-z_]+) \[label=(<\n<TABLE.*?</TABLE>>)\];',
                           open(p).read(), re.S | re.M))
ref, bad = blocks('schema.dot'), 0
for f in ('corpus.dot', 'app.dot', 'staging.dot'):
    for k, v in blocks(f).items():
        if k in ref and k != 'legend' and v != ref[k]:
            print('DRIFT', f, k); bad += 1
print('DRIFT DETECTED' if bad else 'ok — all shared blocks identical')
PY
```

Stub nodes are named `corpus_*` precisely so they can never collide with a real
table block and slip past this check.

## Layout

In `schema.dot`, three clusters top to bottom, following the direction data
actually moves:

1. **`staging`** (dashed, dimmed) — transient ELT scratch space, `DROP`ped after
   load. No foreign keys by design, so the load never fails on row ordering.
2. **`corpus`** (blue) — read-only reference data.
3. **`app`** (green) — the only writable schema.

## Reading the edges

| Edge | Meaning |
|---|---|
| Grey solid | Real `FOREIGN KEY` within one schema |
| **Red solid** | Real `FOREIGN KEY` crossing `app → corpus` — there are exactly four |
| Gold solid, hollow arrow | `INHERITS` — table inheritance, **not** a foreign key |
| Gold dashed | Polymorphic reference; no FK is possible, enforced by trigger |
| Blue dashed | The `isnad_edges` VIEW, self-joined from `isnad_links` |
| Grey dotted | ETL data flow; no constraint exists |

Crow's foot = many; tee = exactly one; circle + crow = zero or one.

## Badges

`PK` primary key · `FK` foreign key · **red `FK`** cross-schema foreign key ·
`UQ` unique constraint or index · `TRG` trigger-enforced polymorphic reference ·
`NULL` in the type column marks nullable — unmarked columns are `NOT NULL`.

## Things the diagram is deliberately making visible

- **Only four red edges exist**, all pointing at `corpus.hadiths`, and every one
  is read-only. That is the corpus/app separation stated as constraints rather
  than as prose.
- **`students` / `teachers` / `admins` carry their own `PK` and `UQ` badges.**
  Postgres does not inherit either through `INHERITS`, so the schema re-adds
  them by hand; the badges are the visual record of that.
- **`study_sets.owner_id` and `notes.user_id` are `TRG`, not `FK`.** They are
  polymorphic (any role), and an FK to `app.users` would be checked with `ONLY`
  semantics — it sees no child rows and would reject every real user.
  `audit_log.changed_by` is looser still: unchecked, best-effort.
- **`progress` shows `UQ` on three columns**, which is the two partial unique
  indexes, one for each null-ness of `assignment_id`. A nullable column cannot
  sit in a primary key, hence the surrogate `progress_id`.
- **`narrators` carries both `rank_*_raw` and `rank_*`.** The raw strings are for
  display and have no FK; the code columns are for maths and point at
  `rank_levels`. `staging.rank_map` bridges the two, once, at load time.
