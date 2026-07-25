# ILHAM — Chen-Notation ERD Set

Seven Graphviz diagrams covering the schema's entities and relationships.
Each `.dot` renders to `.svg` (vector) and `.png` (150 dpi).

No titles are baked into the images — add headings in your slide tool.

## Layout

| Path | Contents |
|---|---|
| `full/` | The detailed diagram set (`.dot` / `.png` / `.svg`) — every attribute shown |
| `plain/` | Simplified variants of the same seven diagrams (note: #7 is `07_derived`) |
| `chen/` | Newer ten-diagram set, force-directed — see [below](#the-chen-set) |
| `relational/` | **Crow's-foot** ERDs — columns + PK/FK; whole schema plus one per layer ([README](relational/README.md)) |
| `overview.png` | Single rendered overview image |
| `clustered_chen.dot` / `.png` | Cluster-grouped Chen diagram of the whole schema |
| `exports/*.zip` | Zipped bundles of the full and plain sets |

Rebuild a diagram from its source (font: DejaVu Sans Mono, covers Arabic labels):

```bash
dot -Tsvg full/01_overview.dot -o full/01_overview.svg
```

## Diagrams (the seven in `full/` and `plain/`)

| # | File | Covers |
|---|------|--------|
| 1 | `01_overview` | Whole schema, both clusters + cross-layer relationships |
| 2 | `02_corpus_biblio` | collections → chapters → hadiths, translations |
| 3 | `03_isnad` | isnad_links (weak entity) + isnad_edges (derived view) |
| 4 | `04_grading` | narrators → rank_levels, dual scholar grades, chain_strength() |
| 5 | `05_isa` | users ISA students / teachers / admins — and what inheritance costs |
| 6 | `06_app_study` | Circles, enrollments, assignments, progress, reviews |
| 7 | `07_triggers` (`07_derived` in `plain/`) | Derived stats + audit shadow table |

## Notation legend

| Shape | Meaning |
|-------|---------|
| Rectangle | Entity |
| Double rectangle | Weak entity (composite PK, existence-dependent) |
| Dashed rectangle | Derived — VIEW or trigger-maintained table |
| Diamond | Relationship |
| Double diamond | Identifying / derived relationship |
| Triangle | ISA specialization (d = disjoint) |
| Ellipse | Attribute (gold edge = key, dashed = generated) |
| Ellipse on a gold **dashed** edge | Partial key of a weak entity (`chen/` only) |
| Octagon | Trigger |
| Component | Stored function / procedure |

Cardinality sits on the edges as 1, N, or 0..1 for optional participation.

A weak entity's partial key is conventionally written with a dashed underline,
which Graphviz cannot render. `chen/` marks it on the *edge* instead — a dashed
underline would otherwise collide with the dashed ellipse *border* that already
means "derived". Affects `isnad_links.sanad_no` / `.position` and
`hadith_translations.lang`.

## Colour coding

- Blue `#58A6FF` — corpus (read-only)
- Green `#3FB950` — app (OLTP)
- Gold `#D29922` — relationships and ISA
- Red `#F85149` — cross-layer app → corpus relationships

## The `chen` set

Ten diagrams covering the same schema, laid out force-directed rather than
layered. Each `.dot` renders under both engines, as PNG and SVG:
`<name>.png` / `<name>.svg` (neato) and `<name>-sfdp.png` / `<name>-sfdp.svg`
(sfdp). **Prefer the SVGs** — these graphs carry a lot of small text and the
rasters blur it as soon as anything scales them.

| File | Covers |
|------|--------|
| `corpus` | The whole read-only layer — biblio spine, isnad, rijal grading, translations |
| `app` | The whole OLTP layer — ISA, circles, sets, assignments, progress, reviews, stats, audit |
| `inter_layer` | Only the four app → corpus crossings |
| `overview` | Both layers plus the crossings, in one clustered graph |
| `biblio` · `narrator` · `users` · `assignments` · `reviews` · `stats_audit_log` | Per-concern detail views |

Rebuild the whole set:

```bash
cd docs/erd/chen
for f in *.dot; do
  b="${f%.dot}"
  neato -Tpng "$f" -o "$b.png"   ; neato -Tsvg "$f" -o "$b.svg"
  sfdp  -Tpng "$f" -o "$b-sfdp.png" ; sfdp -Tsvg "$f" -o "$b-sfdp.svg"
done
```

These sources deliberately carry **no** `rankdir`, `ranksep` or `nodesep` —
those are `dot`-only and are silently ignored by neato and sfdp. Layout is tuned
with `overlap`, `sep`, `esep` and `K` instead.

Two differences from `full/`:

- ISA is a **circle labelled `ISA`** with `d` on the supertype edge, where
  `full/` uses a triangle. Same meaning.
- `inter_layer` uses no cluster boxes. sfdp does not draw them at all, so the
  layer split is carried by node colour (green = app, blue = corpus), which both
  engines honour.

## Suggested order

1. **Overview** — two schemas, one rule: corpus takes no runtime writes.
2. **Bibliographic** — natural keys, nullable chapter, and `hadith_translations`
   as a weak entity keyed `(hadith_id, lang)`.
3. **Isnad** — the centrepiece. Paths stored, edges derived, no self-FK.
4. **Grading** — raw strings for display, ordinals for maths; the raw→code map
   is load-time only and lives in `staging`.
5. **ISA** — the FK target *is* the business rule; plus the four guarantees
   Postgres inheritance does not give you, and how each is restored.
6. **App workflow** — circle → assignment → per-student progress fan-out, keyed
   per (student, hadith, assignment).
7. **Triggers** — derived data as the legitimate trigger use case.
