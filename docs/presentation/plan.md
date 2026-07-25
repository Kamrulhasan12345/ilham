# Ilham — Database Design Presentation Plan

A slide-by-slide build plan for an academic presentation of the Ilham database
design. Target length **30 slides / ~25–30 minutes**, plus a 4-slide appendix
held in reserve for questions.

> For a short slot, see [`plan-compact.md`](plan-compact.md) — a 6-slide /
> 5–6 minute version (with a 5-slide, ~3.5 minute cut). It is not the first six
> slides of this deck; it argues a single thesis rather than walking the design. Five of the thirty are full-bleed diagrams
(marked ★) and carry roughly 90 seconds each; the cut-down variant for a shorter
slot is at the end of this document.

---

## Scope note: the data pipeline is out

This deck deliberately **does not cover ETL** — no data sources, no load
pipeline, no `staging` schema. The design is presented as it exists at runtime:
**two schemas, `corpus` and `app`.**

Three consequences to honour while building:

1. **Do not use `docs/erd/relational/schema.dot`.** It renders all three schemas
   including `staging`, plus ETL flow edges. Use the per-layer extracts
   `relational/corpus` and `relational/app` instead — this is exactly what they
   are for.
2. **Never say "three schemas."** Both `docs/architecture.md` and `CLAUDE.md`
   describe three; that count includes `staging`. In this deck it is two.
3. **Two corpus columns leak pipeline provenance** and appear in the rendered
   diagrams: `isnad_links.resolution` (`A|B|X`) and, more mildly,
   `narrators.is_placeholder`. See *Pre-build tasks* — decide before building.

If a marker asks where the data came from, answer it live from the appendix
rather than spending a main-deck slide on it.

---

## Diagram assets

All exist and are current. Slide numbers refer to the plan below.

| Slide | Asset | Notes |
|---|---|---|
| 10 | `docs/erd/chen/corpus-sfdp.png` | Chen. Prefer the **sfdp** render — cleaner separation than neato |
| 14 | `docs/erd/chen/app-sfdp.png` | Chen. Prefer **sfdp** |
| 18 | `docs/erd/chen/inter_layer-sfdp.png` | Chen. Either render works; sfdp gives a tidy radial around `Hadith` |
| 21 | `docs/erd/relational/corpus.svg` | Crow's foot |
| 23 | `docs/erd/relational/app.svg` | Crow's foot |

Use **SVG wherever the tool allows** — the crow's-foot diagrams are 3000–4000 px
wide and column text will not survive rasterisation on a projector.

---

## Pre-build tasks

Do these before making a single slide.

1. **Decide on `resolution` and `is_placeholder`.** Both are visible in
   `chen/corpus.dot` and `relational/corpus.dot`. Options: (a) leave them and
   describe `resolution` neutrally as "how confidently this chain slot maps to a
   known narrator" — true, and says nothing about a pipeline; (b) drop
   `resolution` from the two presentation renders only, keeping the committed
   diagrams intact. **(a) is recommended** — removing a real column from an ERD
   to dodge a question is worse than explaining it in six words.
2. **Settle light vs dark.** Every diagram is GitHub-dark (`#0D1117`). That
   projects well in a dim room and badly on a printed handout. If handouts are
   required, budget time to re-render with a light palette — it is a
   find-and-replace over the colour constants in each `.dot`, not a redraw.
3. **Check the room.** These are dense diagrams. If the projector is small,
   commit to the zoom slides (11, 15) rather than expecting the full diagram to
   read from the back row.
4. **Rehearse slides 10–19 aloud.** That is the conceptual core and where the
   marks are; it is also where an unrehearsed speaker overruns.

---

# Part 0 — Opening (slides 1–3)

### Slide 1 — Title

*Purpose:* establish what this is in five seconds.

**Content**
- **Ilham (إلهام)** — set the Arabic in a font that renders it (DejaVu Sans Mono
  is already used throughout the diagrams)
- Subtitle: *A Teacher-Led Hadith Study Platform — Database Design*
- Both team member names, course code, date
- Optional: a single faint diagram fragment as background — the `inter_layer`
  render works well because it is sparse

*Say:* one sentence. "This is the database design for a platform where teachers
assign classical hadith texts to students and track their memorisation."

---

### Slide 2 — Domain primer

*Purpose:* the single highest-value slide in the deck. Your audience marks
database design, not Islamic studies. If they do not understand *isnad* by
slide 10, the entire corpus model looks arbitrary.

**Content** — four labelled terms, ideally over one real example hadith:
- **Hadith** — a recorded saying/action, made of two parts:
- **Matn** — the text itself
- **Isnad** — the chain of narrators who transmitted it, person to person
- **Rijal** — the scholarly discipline of grading those narrators' reliability

Draw one chain visually, left to right, five or six names:
`Companion → … → … → Compiler`

*Say:* "Every hadith carries its own provenance. The chain is not metadata about
the text — for this domain it *is* half the text, and it is what makes the data
model interesting. Two scholars can grade the same narrator differently, and
that disagreement is something the database has to represent rather than
resolve."

*Time:* 90 seconds. Worth it.

---

### Slide 3 — Agenda

*Purpose:* signal the classical design progression, so the audience knows you
followed a method.

**Content** — four numbered stages, each with its artefact:
1. **Requirements** — personas, features
2. **Conceptual design** — ER model, Chen notation
3. **Logical design** — relational schema, crow's-foot
4. **Physical design** — constraints, routines, triggers

*Say:* "Conceptual, then logical, then physical — and I'll show the same schema
twice, once in each notation, because they answer different questions."

---

# Part 1 — Requirements (slides 4–5)

### Slide 4 — Personas and access

*Purpose:* justify the role hierarchy that becomes an IS-A on slide 15.

**Content** — the table from `docs/prd.md` §3:

| Role | Core needs |
|---|---|
| Student | Browse corpus, build study sets, complete assignments, log reviews, notes |
| Teacher | Run circles, enroll students, assign sets, review and override progress |
| Researcher / Admin | Narrator analytics, contested rankings, chain strength |

Plus the visibility rule: students see only their own study data; teachers see
their circles; the corpus is readable by every authenticated user.

*Say:* "Three roles with genuinely different attributes — not just a permission
flag. That distinction drives a real modelling decision later."

---

### Slide 5 — What the database must support

*Purpose:* convert features into data requirements, so every later table has a
visible reason to exist.

**Content** — two columns:

*Read side (corpus):* collection → chapter → hadith browsing; normalised Arabic
search; full isnad per chain with transmission words; narrator profiles with
dual scholarly grades; chain-strength indicator.

*Write side (app):* circles and enrolment; study sets; assignments that fan out
to enrolled students; per-hadith progress; review sessions with per-hadith
results; teacher overrides with an audit trail; personal notes.

*Say:* "The read side is reference data — large, shared, never edited by users.
The write side is transactional and per-user. That split is the first real
design decision, and it's the next slide."

---

# Part 2 — Architecture (slides 6–7)

### Slide 6 — One instance, two schemas

*Purpose:* the architectural thesis.

**Content** — a simple two-box diagram (build this fresh; it is too simple to
need Graphviz):

| Schema | Role | Runtime writes |
|---|---|---|
| `corpus` | Reference data — hadiths, chains, narrators, grades | **None** |
| `app` | Users and study activity | Yes (OLTP) |

*Say:* "One PostgreSQL instance carrying two workloads with opposite profiles:
an analytical read-only body of reference data, and a transactional study layer.
They're separated by schema design rather than by running two systems."

---

### Slide 7 — "Read-only" means read-only

*Purpose:* show the boundary is enforced, not merely intended. This is the slide
that earns credit for rigour.

**Content**
- `REVOKE INSERT, UPDATE, DELETE ON corpus.* FROM <app role>`
- Consequence: no application bug can corrupt the corpus — the privilege system
  refuses it
- Every `app → corpus` reference is a foreign key pointing **one way only**
- No trigger is defined on any corpus table

*Say:* "The distinction I want to draw is between a convention and a guarantee.
A comment saying 'don't write here' is a convention. A revoked privilege is a
guarantee. We chose the guarantee, and slide 19 shows there are exactly four
places the two schemas touch at all."

---

# Part 3 — Conceptual design: Chen notation (slides 8–19)

### Slide 8 — How to read the diagrams

*Purpose:* explanation slide. Never show a notation-heavy diagram before its
legend — the audience will read shapes instead of listening.

**Content** — the legend, drawn not just listed:

| Shape | Meaning |
|---|---|
| Rectangle | Entity |
| **Double** rectangle | Weak entity — cannot exist independently |
| Diamond | Relationship |
| **Double** diamond | Identifying relationship |
| Ellipse | Attribute |
| <u>Underlined</u> ellipse | Key attribute |
| **Dashed** ellipse | Derived attribute |
| Circle `ISA` | Specialisation, `d` = disjoint |

Cardinality sits on the edges: `1`, `N`, `M`, and `0..1` for optional
participation.

*Say:* "Two of these carry most of the weight — double borders mean weak
entities, and `0..1` means optional. Watch for both."

---

### Slide 9 — Corpus: the entities

*Purpose:* name the entities *before* showing the diagram, so slide 10 is
recognition rather than decoding.

**Content** — seven entities, one line of justification each:
- **Collection** — a canonical book (Bukhari, Muslim, …)
- **Chapter** — a thematic division within a collection
- **Hadith** — the narration itself; text and matn
- **Narrator** — a person in the transmission network
- **RankLevel** — an ordinal reliability grade
- **IsnadLink** *(weak)* — one narrator at one position in one chain
- **Translation** *(weak)* — one hadith's text in one language

*Say:* "Five ordinary entities and two weak ones. The weak ones are where the
design gets interesting."

---

### Slide 10 — Corpus ER diagram ★

*Purpose:* the first big payoff.

**Visual:** `docs/erd/chen/corpus-sfdp.png`, full bleed, minimal chrome.

**Content:** the diagram and a title. Resist annotating it — slide 11 does that.

*Say:* walk the spine only, and slowly:
"Collection contains chapters. Hadiths are collected in a collection and
optionally classified under a chapter — note the `0..1`, some hadiths sit
outside any chapter. Each hadith has chain positions. Each position is narrated
by at most one known narrator. Narrators are graded by two scholars
independently."

*Time:* 90 seconds. Do not rush this slide.

---

### Slide 11 — Explanation: the isnad as a weak entity

*Purpose:* the intellectual centrepiece of the corpus design. If one slide gets
remembered, make it this one.

**Content** — zoom into `IsnadLink` + `Has Chain Position` from slide 10:
- Identity: `(hadith_id, sanad_no, position)` — the hadith, *which* chain, and
  *where* in that chain
- `sanad_no` and `position` are **partial keys** — meaningless without the
  hadith, which is why `IsnadLink` is weak and the relationship identifying
- `position` runs in propagation order: **Companion first, compiler last**
- One hadith may carry several chains, hence `sanad_no`

*Say:* "The alternative was a self-referencing 'this narrator taught that
narrator' foreign key. It fails: teacher-student is not a fact about a narrator,
it's a fact about a narrator *within a specific chain*. The same two people can
appear adjacent in one chain and far apart in another. Storing position
explicitly makes the chain a first-class fact — and it means traversal is
**aggregation, not recursion**."

*Anticipated question — prepare for it:* "Why not `WITH RECURSIVE`?" Answer:
because positions are stored, the chain is already ordered; recursion would be
re-deriving something we know. Adding it would be complexity for display.

---

### Slide 12 — Explanation: representing scholarly disagreement

*Purpose:* show the model handling a genuinely domain-specific problem.

**Content**
- Two independent relationships, `Graded (Ibn Hajar)` and `Graded (al-Dhahabi)`,
  from `Narrator` to the *same* `RankLevel` entity
- Both are `0..1` — and that optionality encodes three distinct states:

| State | Meaning |
|---|---|
| Graded | The scholar assigned this narrator a rank |
| Named but ungraded | The narrator is known; this scholar did not rank them |
| Unnamed | The chain slot names someone with no profile at all |

- `RankLevel` carries an **`ordinal`** and a **`weight`**, so grades can be
  compared and computed with
- Narrators also keep the original grade **strings** for display

*Say:* "Two of the great rijal scholars frequently disagree. A design that
collapsed them into one 'reliability' column would destroy the most interesting
thing in the dataset. We keep both, and the disagreement itself becomes a
query — it's Q2."

---

### Slide 13 — App: the entities

*Purpose:* same recognition-before-decoding move as slide 9.

**Content** — grouped, not listed flat:
- *Identity:* User, with Student / Teacher / Admin
- *Teaching structures:* Circle, Enrolment
- *Content selection:* StudySet, Assignment
- *Learning records:* Progress, ReviewSession, Note
- *Derived:* StudentStats, AuditLog

*Say:* "Twelve entities in four groups. The derived pair at the end are
maintained by the database itself, not by the application."

---

### Slide 14 — App ER diagram ★

*Purpose:* the second big payoff.

**Visual:** `docs/erd/chen/app-sfdp.png`, full bleed.

*Say:* trace one workflow end to end rather than enumerating:
"A teacher owns a circle. Students enrol in it. The teacher builds a study set
and assigns it to the circle. That assignment produces progress rows — one per
student per hadith. Students log review sessions; teachers review them. Stats
and the audit log update themselves."

---

### Slide 15 — Explanation: the IS-A hierarchy and what it costs

*Purpose:* an honest engineering slide. Academic audiences reward showing you
know the limits of your own choice.

**Content**
- `User` specialises into `Student` / `Teacher` / `Admin`, disjoint (`d`) — a
  user is exactly one
- Implemented with PostgreSQL **table inheritance**
- The payoff: a foreign key to a *subtype* makes the business rule structural —
  `circles.teacher_id → teachers` means **an admin cannot own a circle**, and
  the database enforces it with no application code
- The cost — PostgreSQL inherits columns but **not**: primary keys, unique
  constraints, foreign keys, or identity
- Each is restored explicitly: a shared sequence, a per-child `ADD PRIMARY KEY`,
  a per-child `ADD UNIQUE` plus a cross-table trigger for email

*Say:* "This is the one place we took a feature that could have been decorative
and made it load-bearing. It's also the one place we had to write compensating
code, and it's worth being clear about why: every one of those four gaps fails
*silently* — you get bad data, not an error."

---

### Slide 16 — Explanation: the grain of `Progress`

*Purpose:* demonstrate that you reasoned about grain — a topic that separates a
good design from a competent one.

**Content**
- Grain: **one row per (student, hadith, assignment)**
- Why not (student, hadith)? Because a hadith assigned twice is **two separate
  obligations**
- `assignment_id` is nullable — `NULL` means self-study, undertaken by the
  student on their own
- Consequence: prior self-study is **never reset** by a later assignment
- Consequence: anything counting mastered hadiths must use
  `count(DISTINCT hadith_id)`, or a keen student is counted twice

*Say:* "The nullable column is doing real semantic work here, and it forces a
structural decision you'll see on the logical-design slide."

---

### Slide 17 — Explanation: derived data

*Purpose:* motivate the two entities that look redundant on slide 14.

**Content**
- `StudentStats` — mastered and review counts, maintained by trigger on progress
  writes
- `AuditLog` — a shadow table capturing mastery changes: old value, new value,
  who, when
- Both fire on **`app` writes only**; the corpus never triggers anything
- Justification: derived counts are the legitimate use of a trigger — the
  alternative is every write path remembering to update them

*Say:* "Denormalisation on purpose, in one place, with the database keeping it
honest rather than the application."

---

### Slide 18 — Inter-layer ER diagram ★

*Purpose:* deliver the architectural claim from slide 7 as a picture.

**Visual:** `docs/erd/chen/inter_layer-sfdp.png`, full bleed.

*Say:* "Everything the study layer knows about the corpus is on this slide.
Four relationships, all of them pointing at `Hadith`: a study set contains
hadiths, progress is tracked against a hadith, a review tests hadiths, a note is
about a hadith. That's the entire interface between the two halves."

---

### Slide 19 — Explanation: why the interface is this small

*Purpose:* close the architecture argument.

**Content**
- Four crossings, all `app → corpus`, all read-only
- Nothing in the corpus knows the app exists — no column, no constraint, no
  trigger points outward
- Therefore the corpus is independently replaceable, independently cacheable,
  and safe to expose read-only
- Contrast: had we put a `times_studied` counter on `corpus.hadiths`, the
  read-only guarantee would be gone and every study write would touch reference
  data

*Say:* "A narrow interface was a design goal, not an accident. It's the reason
the privilege revocation on slide 7 is possible at all."

---

# Part 4 — Logical design: crow's-foot (slides 20–24)

### Slide 20 — From conceptual to logical

*Purpose:* explanation slide. Justify showing the schema a second time, and
teach the second notation.

**Content** — side by side:

| Chen (conceptual) | Crow's foot (logical) |
|---|---|
| Entities and relationships | Tables and columns |
| Diamonds carry relationships | Foreign keys carry them |
| Attributes as ellipses | Columns with data types |
| "What exists?" | "What does the DDL create?" |

Then the crow's-foot legend: crow = many, tee = exactly one, circle + crow =
zero or one. Badges: `PK`, `FK`, `UQ`, `TRG`.

*Say:* "Same schema, different question. The Chen diagrams show what the domain
contains; these show what PostgreSQL actually creates. Relationships that were
diamonds are now foreign keys, and every M:N diamond has become its own table."

---

### Slide 21 — Corpus, logical ★

*Visual:* `docs/erd/relational/corpus.svg`.

*Say:* point at three things and no more:
1. `isnad_links` — the weak entity is now a composite primary key of three
   columns
2. `narrators` carries `rank_*_raw` **and** `rank_*` — strings for display, codes
   for computation, the codes being the foreign keys
3. `isnad_edges` is a **view**, not a table — adjacency derived from stored
   positions, never stored twice

---

### Slide 22 — Explanation: corpus integrity

**Content**
- Natural keys where the domain supplies a stable one (`hadith_id`,
  `narrator_id`); generated identity elsewhere
- `chapter_id` nullable — modelled deliberately, not an oversight
- `narrators.name_norm` is a **generated stored column** — normalised Arabic for
  search, maintained by the database, impossible to leave stale
- `hadith_translations` keyed `(hadith_id, lang)` — the weak entity from slide 9,
  now a composite key, with graceful fallback to Arabic when a row is absent

---

### Slide 23 — App, logical ★

*Visual:* `docs/erd/relational/app.svg`.

*Say:*
"Note three things. The gold `INHERITS` edges are not foreign keys — that's the
IS-A from slide 15. The four red edges leaving the bottom are the crossings from
slide 18, and they're the only ones. And the gold dashed edges are references
the database *cannot* enforce with a foreign key."

---

### Slide 24 — Explanation: three integrity mechanisms

*Purpose:* the most technically substantial slide in Part 4. Shows you know when
a foreign key is and is not the right tool.

**Content** — three rows:

| Mechanism | Used for | Why |
|---|---|---|
| **Foreign key** | `circles.teacher_id → teachers` | Target is one subtype; the FK *is* the business rule |
| **Trigger** | `study_sets.owner_id → users` | Polymorphic — any role may own a set. An FK to the parent is checked with `ONLY` semantics, sees no child rows, and would reject every real user |
| **Partial unique index** | `progress` | `assignment_id` is nullable, and a nullable column cannot sit in a primary key — so a surrogate key plus two partial indexes, one per null-state |

*Say:* "Each of these is a foreign key that we either could use, couldn't use, or
had to approximate — and the reason differs every time. The middle one is a real
limitation of PostgreSQL inheritance, not a design preference."

---

# Part 5 — Physical design and validation (slides 25–26)

### Slide 25 — Routines and the transaction boundary

*Purpose:* the physical-design slide, and a genuinely interesting PostgreSQL
distinction.

**Content**
- **`corpus.chain_strength(hadith_id)` — a FUNCTION.** Weakest link within a
  chain, best chain wins; grade weights drive it; unnamed or unresolved slots
  weaken the result. Read-only, and deliberately simple enough to defend line by
  line.
- **`app.assign_study_set(...)` — a PROCEDURE.** Fans an assignment out to every
  enrolled student and initialises their progress rows.
- **Why a procedure and not a function:** it owns its own `COMMIT`. PostgreSQL
  functions cannot commit; they run inside the caller's transaction. That is
  precisely the function-versus-procedure distinction.

*Say:* "Same language, different construct, for one concrete reason — the
procedure controls its own transaction boundary and a function cannot."

*If asked about error handling:* the procedure carries no `EXCEPTION` block on
purpose. `BEGIN … EXCEPTION` opens a subtransaction, and committing inside one
fails at runtime. An unhandled error already rolls the whole call back.

---

### Slide 26 — Validating the design with queries

*Purpose:* prove the schema answers real questions — the strongest possible
close.

**Content** — six queries, one line each, tied back to the model:

| # | Query | Exercises |
|---|---|---|
| 1 | Top narrators by hadith count | Chain aggregation |
| 2 | **Contested narrators** — where the two scholars disagree | Dual grading (slide 12) |
| 3 | Shared narrators between two chains | Positional chain storage |
| 4 | Circle overview — mastered vs assigned | Cross-layer join, `count(DISTINCT)` |
| 5 | Weakest chains among studied hadiths | `chain_strength()` + cross-layer |
| 6 | Assignment completion — owed vs done | The progress grain (slide 16) |

*Say:* "Query 2 only works because we refused to collapse the two scholars.
Query 6 only works because progress is grained per assignment. The model earns
its complexity here."

---

# Part 6 — Close

### Slide 27 — What we deliberately did not build

*Purpose:* restraint, argued. Unusual in a student deck and consequently
memorable.

**Content**
- No recursive chain traversal — positions are stored, so it would be artificial
- No write path into the corpus, ever
- No duplicated routines; each feature exists once, where it belongs
- No stored adjacency table for chain edges — a view derives it, so it cannot
  drift from the positions it comes from

*Say:* "Every one of these was a thing we could have added to look more
sophisticated. Each would have been complexity without a question behind it."

---

### Slide 28 — Limitations and future work

*Purpose:* pre-empt the examiner's own critique by raising it first.

**Content** — be genuinely critical:
- Table inheritance is a PostgreSQL-specific choice; it needs compensating
  constraints and does not port to other engines
- `chain_strength()` weights are defensible but ultimately a judgement call, not
  a scholarly consensus
- No spaced-repetition scheduling — progress records state, not a review schedule
- Cross-layer visibility rules are enforced in the query layer, not by
  row-level security
- Translation coverage is optional per row, so English is best-effort throughout

---

### Slide 29 — Summary

**Content** — four claims, mirroring the agenda:
1. Two schemas, one instance — separated by privilege, not convention
2. The isnad modelled as a weak entity, making chains first-class and traversal
   plain aggregation
3. Scholarly disagreement preserved rather than resolved
4. Integrity pushed into the database — keys, constraints, triggers, and one
   procedure that owns its transaction

*Close:* "The recurring decision was to let the database enforce what the
database can enforce, and to be explicit about the places it can't."

---

### Slide 30 — Questions

Title, both names, and a pointer to the repository. Leave the `inter_layer`
diagram on screen — it is the most legible one to be looking at during
questions.

---

# Appendix (hold in reserve)

| # | Slide | Trigger to show it |
|---|---|---|
| A1 | Bibliographic detail — `chen/biblio.png` | "How is the corpus organised?" |
| A2 | Isnad and rijal detail — `chen/narrator.png` | Deeper isnad or grading questions |
| A3 | Study workflow detail — `chen/assignments.png` | "Walk me through an assignment" |
| A4 | Where the data came from | Any dataset or provenance question |

**A4 is your ETL escape hatch.** Keep it to three lines: the corpus is loaded
once from a published hadith dataset, before the application runs; narrator
records are matched by name; the load path does not exist at runtime. That
answers the question honestly without re-opening a topic the deck excluded.

---

# Build order

1. Pre-build tasks (above) — especially the `resolution` decision
2. Slides 10, 14, 18, 21, 23 — drop the diagrams in first; they constrain layout
3. The explanation slides that sit next to them (11, 12, 15, 16, 17, 19, 22, 24)
4. Opening and closing (1–7, 27–30)
5. Appendix
6. Rehearse Part 3 aloud with a timer — it is 12 of 30 slides and where overruns
   happen

**One assumption worth confirming before you build:** this plan assumes a
~25-minute slot with questions after. If it is 15 minutes, cut slides 12, 17, 22
and 27, and merge 4 into 5 — that lands near 20 slides while keeping all five
diagrams and the isnad argument intact.
