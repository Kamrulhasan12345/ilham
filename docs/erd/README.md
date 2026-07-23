# ILHAM — Chen-Notation ERD Set

Seven Graphviz diagrams covering the schema's entities and relationships.
Each `.dot` renders to `.svg` (vector) and `.png` (150 dpi).

No titles are baked into the images — add headings in your slide tool.

## Layout

| Path | Contents |
|---|---|
| `full/` | The detailed diagram set (`.dot` / `.png` / `.svg`) — every attribute shown |
| `plain/` | Simplified variants of the same seven diagrams (note: #7 is `07_derived`) |
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
| 2 | `02_corpus_biblio` | collections → chapters → hadiths, subjects, translations |
| 3 | `03_isnad` | isnad_links (weak entity) + isnad_edges (derived view) |
| 4 | `04_grading` | rank_map → rank_levels, dual scholar grades, chain_strength() |
| 5 | `05_isa` | users ISA students / teachers / admins |
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
| Octagon | Trigger |
| Component | Stored function / procedure |

Cardinality sits on the edges as 1, N, or 0..1 for optional participation.

## Colour coding

- Blue `#58A6FF` — corpus (read-only)
- Green `#3FB950` — app (OLTP)
- Gold `#D29922` — relationships and ISA
- Red `#F85149` — cross-layer app → corpus relationships

## Suggested order

1. **Overview** — two schemas, one rule: corpus takes no runtime writes.
2. **Bibliographic** — natural keys, nullable chapter, weak child entities.
3. **Isnad** — the centrepiece. Paths stored, edges derived, no self-FK.
4. **Grading** — raw strings for display, ordinals for maths.
5. **ISA** — the FK target *is* the business rule.
6. **App workflow** — circle → assignment → per-student progress fan-out.
7. **Triggers** — derived data as the legitimate trigger use case.
