# Ilham — the ERD sets

The diagrams cover the entities and the relationships of the schema. Graphviz
draws them. Each `.dot` file renders to `.svg` (vector) and `.png` (150 dpi).

The images carry no title. Add the headings in your slide tool.

## Layout

| Path | Contents |
|---|---|
| `full/` | The detailed set (`.dot`, `.png`, `.svg`). It shows every attribute |
| `plain/` | Simpler forms of the same seven diagrams. Note that #7 is `07_derived` |
| `chen/` | A newer set of ten diagrams, force-directed. See [below](#the-chen-set) |
| `relational/` | **Crow's-foot** ERDs. Columns with PK and FK badges. The whole schema, and one diagram for each layer ([README](relational/README.md)) |
| `overview.png` | One rendered overview image |
| `clustered_chen.dot` and `.png` | A Chen diagram of the whole schema, grouped in clusters |
| `exports/*.zip` | Zipped bundles of the full set and the plain set |

To render one diagram again, use this command. The font is DejaVu Sans Mono,
which covers the Arabic labels.

```bash
dot -Tsvg full/01_overview.dot -o full/01_overview.svg
```

## The seven diagrams in `full/` and `plain/`

| # | File | Covers |
|---|------|--------|
| 1 | `01_overview` | The whole schema, both clusters, and the cross-layer relationships |
| 2 | `02_corpus_biblio` | collections → chapters → hadiths, and the translations |
| 3 | `03_isnad` | `isnad_links` as a weak entity, and `isnad_edges` as a derived view |
| 4 | `04_grading` | narrators → rank_levels, the two scholar grades, and `chain_strength()` |
| 5 | `05_isa` | users ISA students, teachers, and admins — and what inheritance costs |
| 6 | `06_app_study` | Circles, enrollments, assignments, progress, and reviews |
| 7 | `07_triggers` (`07_derived` in `plain/`) | The derived stats and the audit shadow table |

## Notation legend

| Shape | Meaning |
|-------|---------|
| Rectangle | An entity |
| Double rectangle | A weak entity. It has a composite key and it depends on another entity |
| Dashed rectangle | Derived. A view, or a table that a trigger maintains |
| Diamond | A relationship |
| Double diamond | An identifying or derived relationship |
| Triangle | ISA specialization. The letter `d` means disjoint |
| Ellipse | An attribute. A gold edge marks a key. A dashed edge marks a generated value |
| Ellipse on a gold **dashed** edge | The partial key of a weak entity (`chen/` only) |
| Octagon | A trigger |
| Component | A stored function or procedure |
| **Double line** on an entity-to-relationship edge | **Total participation.** Every instance of the entity on that side takes part |

### Participation

Cardinality and participation are two different facts. Two different marks carry
them. The arrowheads say **how many**. The double line says **whether it is
optional**. An arrowhead cannot say that, because a plain line ("many") is silent
about whether that many can be zero.

A **double line** between an entity and a relationship diamond means that every
instance of that entity must take part. In practice, the diagrams draw it
wherever the foreign key is `NOT NULL`:

| Layer | Total participation (a double line) |
|---|---|
| `corpus` | `chapters.collection_id`, `hadiths.collection_id`, `isnad_links.hadith_id`, `hadith_translations.hadith_id` |
| `app` | `circles.teacher_id`, `study_sets.owner_id`, `assignments.circle_id`, `assignments.set_id`, `progress.student_id`, `review_sessions.student_id`, `student_stats.student_id`, `notes.user_id` |
| Cross-layer | `progress.hadith_id`, `notes.hadith_id` |

A single line means partial participation. There are two reasons for it. The
foreign key is nullable, which covers every case in *Cardinality* below. Or the
entity is on the "one" side, or in a many-to-many relationship where an empty
parent is legal. A teacher who runs no circle, a student in no circle, and an
empty study set are all legal.

Two edges look like exceptions, so know about them:

- `student_stats` carries a double line **and** a hollow arrowhead. Both are
  true, and they point in opposite directions. There is at most one stats row for
  each student (hollow), and every stats row belongs to a student (double).
- `review_sessions → Tested` is a **single** line, although a review that tests
  no hadith means nothing. The DDL does not force at least one `review_items`
  row. These diagrams show what the schema enforces, not what the domain implies.
  To enforce it needs a deferred constraint.

### Cardinality

The `chen/` set carries cardinality as **arrowheads**, not as `1` and `N`
labels. The arrow points at the **"one" side**. This is the standard E-R arrow
notation of Garcia-Molina, Ullman, and Widom. An arrow into an entity means "at
most one of these takes part for each combination of the others".

| Arrowhead | Meaning | Older label |
|---|---|---|
| Filled ▶ | Exactly one. Mandatory | `1` |
| Hollow ▷ | At most one. Optional | `0..1` |
| None | Many | `N` or `M` |

A many-to-many relationship therefore has **no** arrowhead on either side.

The hollow arrowheads are exactly the optional participations:

| Column | What NULL means |
|---|---|
| `hadiths.chapter_id` | The hadith sits under no chapter |
| `progress.assignment_id` | Private study |
| `isnad_links.narrator_id` | Unresolved |
| `narrators.rank_ibn_hajar`, `narrators.rank_dhahabi` | Named but ungraded, or unnamed |
| `review_sessions.reviewer_id`, `review_sessions.circle_id` | Private study, with no teacher and no circle |
| `audit_log.changed_by` | The actor is unknown. This column is best-effort |
| `student_stats` | No row exists until the trigger fires the first time |

Graphviz ignores arrowheads in an undirected `graph`. Every `chen/` source is
therefore a `digraph` with a graph-level `edge [dir=none]` default. Attribute
edges and ISA edges stay plain lines, and only the relationship edges switch back
on. The edges are written `Entity -> Relationship`, so the head goes on with
`dir=back` and `arrowtail`. This applies to `chen/` only. The `relational/` set
uses crow's foot.

Convention writes the partial key of a weak entity with a dashed underline.
Graphviz cannot render that. The `chen/` set marks it on the *edge* instead. A
dashed underline would collide with the dashed ellipse *border*, which already
means "derived". This affects `isnad_links.sanad_no`, `isnad_links.position`, and
`hadith_translations.lang`.

## Colour code

- Blue `#58A6FF` — the corpus, which is read-only
- Green `#3FB950` — the app layer, which is OLTP
- Gold `#D29922` — relationships and ISA
- Red `#F85149` — cross-layer relationships from app to corpus

## The `chen` set

Ten diagrams cover the same schema. The layout is force-directed and not layered.

Each `.dot` file renders under two engines, as PNG and as SVG. The neato output
is `<name>.png` and `<name>.svg`. The sfdp output is `<name>-sfdp.png` and
`<name>-sfdp.svg`.

**Prefer the SVG files.** These graphs carry much small text, and a raster image
blurs it as soon as something scales it.

| File | Covers |
|------|--------|
| `corpus` | The whole read-only layer: the bibliographic spine, the isnad, the rijal grades, and the translations |
| `app` | The whole OLTP layer: ISA, circles, sets, assignments, progress, reviews, stats, and audit |
| `inter_layer` | The four crossings from app to corpus, and nothing else |
| `overview` | Both layers and the crossings, in one clustered graph |
| `biblio` · `narrator` · `users` · `assignments` · `reviews` · `stats_audit_log` | Detail views, one for each concern |

To rebuild the whole set:

```bash
cd docs/erd/chen
for f in *.dot; do
  b="${f%.dot}"
  neato -Tpng "$f" -o "$b.png"   ; neato -Tsvg "$f" -o "$b.svg"
  sfdp  -Tpng "$f" -o "$b-sfdp.png" ; sfdp -Tsvg "$f" -o "$b-sfdp.svg"
done
```

These sources carry **no** `rankdir`, `ranksep`, or `nodesep`, and that is
deliberate. Those attributes work in `dot` only. Neato and sfdp ignore them in
silence. The layout uses `overlap`, `sep`, `esep`, and `K` instead.

There is one difference from `full/`. The file `inter_layer` uses no cluster
boxes. sfdp does not draw them at all, so node colour carries the layer split.
Green is app and blue is corpus. Both engines honour colour.

ISA uses the standard **triangle with the label `ISA`**, and `d` sits on the
supertype edge. The triangle is declared `fixedsize=true`. A triangle with a free
size pads its label out to the full base width, and it then dwarfs the entities
around it.

## Suggested reading order

1. **Overview.** Two schemas and one rule: the corpus takes no runtime write.
2. **Bibliographic.** Natural keys, a nullable chapter, and
   `hadith_translations` as a weak entity keyed `(hadith_id, lang)`.
3. **Isnad.** The centrepiece. The paths are stored, the edges are derived, and
   there is no self-reference.
4. **Grading.** Raw strings for display, ordinals for arithmetic. The map from
   string to code runs at load time and lives in `staging`.
5. **ISA.** The foreign-key target *is* the business rule. It also shows the four
   guarantees that PostgreSQL inheritance does not give, and how the schema
   restores each one.
6. **App workflow.** circle → assignment → progress for each student, keyed by
   (student, hadith, assignment).
7. **Triggers.** Derived data is the correct use for a trigger.
