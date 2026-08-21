# The relational (crow's-foot) ERD

One diagram shows every table in the schema, drawn the conventional way. Each
table is a box that lists its columns with types and key badges. Each edge is a
real referential constraint, and it lands on the exact column that it references.

This set is the counterpart to the Chen-notation sets in `../full/`, `../plain/`,
and `../chen/`. Chen notation answers *"what are the entities and the
relationships?"*. This set answers *"what does the DDL create?"*. Read it beside
the DDL in `db/`.

| Diagram | Covers | Tables |
|---|---|---|
| `schema` | **Everything in one graph.** All three schemas and every constraint | 34 + 1 view |
| `corpus` | The read-only layer alone | 8 + 1 view |
| `app` | The writable layer alone, with `corpus.hadiths` as a stub | 15 |
| `staging` | The ETL work area alone, with its corpus targets as stubs | 11 |

Each one renders to `.svg` and to `.png` at 150 dpi. **Use the SVG files.** The
diagrams are large.

The three layer diagrams are extracts, not rewrites. The definition of each table
is identical to the one in `schema.dot`. Read `schema` to see how the layers fit
together. Read a layer file when you want one schema on one slide.

## Rebuild

```bash
cd docs/erd/relational
for f in schema corpus app staging; do
  dot -Tsvg "$f.dot" -o "$f.svg"
  dot -Tpng -Gdpi=150 "$f.dot" -o "$f.png"
done
```

Render with **`dot`**. Do not use neato or sfdp. The edges attach to individual
column rows through ports, and only a layered engine keeps them untangled. The
`chen/` set is the opposite case. It is force-directed on purpose.

## Keep the four files in sync

The HTML block of each table appears in `schema.dot` **and** in its layer file. A
change to a column must therefore go into both.

This check proves that the blocks have not diverged. Run it after you edit any of
them:

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

The stub nodes are named `corpus_*` for one reason. They can then never collide
with a real table block and get past this check.

## Layout

In `schema.dot` there are three clusters, from top to bottom. They follow the
direction in which the data moves:

1. **`staging`** — dashed and dim. It is the temporary ETL work area, and the
   load deletes it. It has no foreign keys by design, so the load never fails on
   the order of the rows.
2. **`corpus`** — blue. Read-only reference data.
3. **`app`** — green. The only writable schema.

## Read the edges

| Edge | Meaning |
|---|---|
| Grey solid | A real `FOREIGN KEY` inside one schema |
| **Red solid** | A real `FOREIGN KEY` that crosses `app → corpus`. There are exactly four |
| Gold solid, hollow arrow | `INHERITS`. This is table inheritance, **not** a foreign key |
| Gold dashed | A polymorphic reference. No foreign key is possible, so a trigger enforces it |
| Blue dashed | The `isnad_edges` VIEW, joined from `isnad_links` to itself |
| Grey dotted | ETL data flow. No constraint exists |

A crow's foot means many. A tee means exactly one. A circle with a crow's foot
means zero or one.

## Badges

| Badge | Meaning |
|---|---|
| `PK` | A primary key |
| `FK` | A foreign key |
| **red** `FK` | A foreign key that crosses a schema |
| `UQ` | A unique constraint or index |
| `TRG` | A polymorphic reference that a trigger enforces |
| `NULL` | The column is nullable |

A column with no `NULL` badge is `NOT NULL`.

## What the diagram makes visible on purpose

- **Only four red edges exist.** All four point at `corpus.hadiths`, and every one
  is read-only. That is the corpus and app separation stated as constraints
  instead of prose.
- **`students`, `teachers`, and `admins` carry their own `PK` and `UQ` badges.**
  PostgreSQL inherits neither through `INHERITS`, so the schema adds them again by
  hand. The badges are the visual record of that work.
- **`study_sets.owner_id` and `notes.user_id` are `TRG`, not `FK`.** They are
  polymorphic, so any role can own them. A foreign key to `app.users` is checked
  with `ONLY` semantics. It sees no child rows and would reject every real user.
  `audit_log.changed_by` is looser again: it has no check and is best-effort.
- **`progress` shows `UQ` on three columns.** That is the two partial unique
  indexes, one for each state of `assignment_id`. A nullable column cannot sit in
  a primary key, so identity is the surrogate `progress_id`.
- **`narrators` carries both `rank_*_raw` and `rank_*`.** The raw strings are for
  display and have no foreign key. The code columns are for arithmetic and point
  at `rank_levels`. `staging.rank_map` bridges the two, one time, at load time.
- **`staging.lk_hadiths` has a surrogate key.** LK numbers are neither unique nor
  a usable join key, so `hadith_num` is an ordinary column here and never a key.
