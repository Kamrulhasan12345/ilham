# Ilham — the full presentation plan

This is a slide-by-slide plan for an academic presentation of the Ilham database
design. The target is **30 slides, 25 to 30 minutes**, and an appendix of 4
slides held in reserve for questions.

> For a short slot, see [`plan-compact.md`](plan-compact.md). That is a version of
> 6 slides and 5 to 6 minutes, with a cut of 5 slides at about 3.5 minutes. It is
> not the first six slides of this deck. It argues one thesis instead of a walk
> through the design.

Five of the thirty slides are full-bleed diagrams, marked ★. Each one takes about
90 seconds. The shorter variant is at the end of this document.

---

## Scope note: the pipeline is out

This deck **does not cover the ETL**. It shows no data sources, no load pipeline,
and no `staging` schema. It presents the design as it exists at runtime: **two
schemas, `corpus` and `app`.**

Honour three consequences while you build:

1. **Do not use `docs/erd/relational/schema.dot`.** It renders all three schemas,
   including `staging`, and the ETL flow edges. Use the per-layer extracts
   `relational/corpus` and `relational/app` instead. That is what they are for.
2. **Never say "three schemas".** `docs/architecture.md` and `CLAUDE.md` both
   describe three, and that count includes `staging`. In this deck there are two.
3. **Two corpus columns show the pipeline**, and they appear in the rendered
   diagrams: `isnad_links.resolution`, which holds `A`, `B`, `C`, or `X`, and,
   less obviously, `narrators.is_placeholder`. See *Pre-build tasks*. Decide before
   you build.

If a marker asks where the data came from, answer from the appendix. Do not spend
a main-deck slide on it.

---

## Diagram assets

All of them exist and are current. The slide numbers refer to the plan below.

| Slide | Asset | Notes |
|---|---|---|
| 10 | `docs/erd/chen/corpus-sfdp.svg` | Chen. Prefer the **sfdp** render. It separates the nodes better than neato |
| 14 | `docs/erd/chen/app-sfdp.svg` | Chen. Prefer **sfdp** |
| 18 | `docs/erd/chen/inter_layer-sfdp.svg` | Chen. Either render works. sfdp gives a tidy radial shape around `Hadith` |
| 21 | `docs/erd/relational/corpus.svg` | Crow's foot |
| 23 | `docs/erd/relational/app.svg` | Crow's foot |

Use **SVG wherever the tool allows it**. The crow's-foot diagrams are 3,000 to
4,000 pixels wide, and the column text does not survive rasterisation on a
projector.

---

## Pre-build tasks

Do these before you make one slide.

1. **Decide about `resolution` and `is_placeholder`.** Both appear in
   `chen/corpus.dot` and `relational/corpus.dot`.

   Option (a): leave them, and describe `resolution` in neutral words, as "how
   confidently this chain slot maps to a known narrator". That is true, and it
   says nothing about a pipeline.

   Option (b): remove `resolution` from the two presentation renders only, and
   keep the committed diagrams as they are.

   **We recommend option (a).** To remove a real column from an ERD to avoid a
   question is worse than to explain it in six words.
2. **Settle light against dark.** Every diagram uses the GitHub dark ground,
   `#0D1117`. That projects well in a dim room and badly on a printed handout. If
   you need handouts, allow time to render again with a light palette. It is a
   find-and-replace over the colour constants in each `.dot` file, not a redraw.
3. **Check the room.** These diagrams are dense. If the projector is small, commit
   to the zoom slides, 11 and 15. Do not expect the full diagram to read from the
   back row.
4. **Rehearse slides 10 to 19 out loud.** That is the conceptual core, and the
   marks are there. It is also where an unrehearsed speaker runs over the time.

---

# Part 0 — Opening, slides 1 to 3

### Slide 1 — Title

*Purpose:* say what this is, in five seconds.

**Content**

- **Ilham (إلهام)**. Set the Arabic in a font that renders it. DejaVu Sans Mono
  is already in use across the diagrams.
- Subtitle: *A Teacher-Led Hadith Study Platform — Database Design*
- The names of both team members, the course code, and the date
- Optional: one faint diagram fragment as a background. The `inter_layer` render
  works well, because it is sparse

*Say* one sentence: "This is the database design for a platform. Teachers assign
classical hadith texts to students, and the system tracks what the students
learn."

---

### Slide 2 — Domain primer

*Purpose:* this is the slide with the highest value in the deck. Your audience
marks database design, not Islamic studies. If they do not understand the *isnad*
by slide 10, the whole corpus model looks arbitrary.

**Content** — four terms, over one real example hadith:

- **Hadith** — a recorded saying or action. It has two parts:
- **Matn** — the text itself
- **Isnad** — the chain of narrators who transmitted it, one person to the next
- **Rijal** — the scholarly discipline that grades the reliability of those
  narrators

Draw one chain, from left to right, with five or six names:
`Companion → … → … → Compiler`

*Say:* "Every hadith carries its own provenance. The chain is not metadata about
the text. In this domain it *is* half of the text, and it is what makes the data
model interesting. Two scholars can grade the same narrator differently, and the
database must represent that disagreement instead of resolving it."

*Time:* 90 seconds. It is worth the time.

---

### Slide 3 — Agenda

*Purpose:* show the classical design progression, so the audience knows that you
followed a method.

**Content** — four numbered stages, each with its artefact:

1. **Requirements** — personas and features
2. **Conceptual design** — the ER model, in Chen notation
3. **Logical design** — the relational schema, in crow's foot
4. **Physical design** — constraints, routines, and triggers

*Say:* "Conceptual, then logical, then physical. I show the same schema two
times, one time in each notation, because they answer different questions."

---

# Part 1 — Requirements, slides 4 to 5

### Slide 4 — Personas and access

*Purpose:* justify the role hierarchy that becomes an IS-A on slide 15.

**Content** — the table from `docs/prd.md` §3:

| Role | Main needs |
|---|---|
| Student | Browse the corpus, build study sets, complete assignments, record reviews, write notes |
| Teacher | Run circles, enrol students, assign sets, check and override progress |
| Researcher or admin | Narrator analytics, contested grades, chain strength |

Add the visibility rule: a student sees only their own study data, a teacher sees
their own circles, and every authenticated user can read the corpus.

*Say:* "Three roles with genuinely different attributes, not one permission flag.
That difference drives a real modelling decision later."

---

### Slide 5 — What the database must support

*Purpose:* turn the features into data requirements, so that every later table
has a visible reason to exist.

**Content** — two columns.

*The read side, the corpus:* browse from collection to chapter to hadith; search
on normalised Arabic; the full isnad for each chain, with the transmission words;
narrator profiles with the grades of two scholars; the chain-strength value.

*The write side, the app:* circles and enrolment; study sets; assignments that go
out to every enrolled student; progress for each hadith; review sessions with a
result for each hadith; teacher overrides with an audit trail; personal notes.

*Say:* "The read side is reference data. It is large, shared, and users never edit
it. The write side is transactional and belongs to one user at a time. That split
is the first real design decision, and it is the next slide."

---

# Part 2 — Architecture, slides 6 to 7

### Slide 6 — One instance, two schemas

*Purpose:* the architectural thesis.

**Content** — a simple two-box diagram. Build this one fresh. It is too simple to
need Graphviz.

| Schema | Role | Runtime writes |
|---|---|---|
| `corpus` | Reference data: hadiths, chains, narrators, grades | **None** |
| `app` | Users and study activity | Yes |

*Say:* "One PostgreSQL instance carries two workloads with opposite profiles: an
analytical read-only body of reference data, and a transactional study layer.
Schema design separates them. We do not run two systems."

---

### Slide 7 — "Read-only" means read-only

*Purpose:* show that the boundary is enforced, not merely intended. This slide
earns credit for rigour.

**Content**

- `REVOKE INSERT, UPDATE, DELETE ON corpus.* FROM <app role>`
- The consequence: no application bug can corrupt the corpus. The privilege
  system refuses it.
- Every reference from `app` to `corpus` is a foreign key that points **one way
  only**.
- No trigger exists on any corpus table.

*Say:* "I want to draw one distinction: a convention against a guarantee. A
comment that says 'do not write here' is a convention. A revoked privilege is a
guarantee. We chose the guarantee, and slide 19 shows that the two schemas touch
in exactly four places."

---

# Part 3 — Conceptual design in Chen notation, slides 8 to 19

### Slide 8 — How to read the diagrams

*Purpose:* an explanation slide. Never show a notation-heavy diagram before its
legend. The audience will read shapes instead of listening to you.

**Content** — the legend, drawn and not only listed:

| Shape | Meaning |
|---|---|
| Rectangle | An entity |
| **Double** rectangle | A weak entity. It cannot exist on its own |
| Diamond | A relationship |
| **Double** diamond | An identifying relationship |
| Ellipse | An attribute |
| <u>Underlined</u> ellipse | A key attribute |
| **Dashed** ellipse | A derived attribute |
| Triangle `ISA` | Specialisation. `d` means disjoint |

Arrowheads carry the cardinality, and they point at the "one" side. A **filled**
head means exactly one. A **hollow** head means at most one. **No** head means
many. A many-to-many relationship has no arrowhead at all.

*Say:* "Two things carry most of the weight. A double border means a weak entity,
which cannot exist on its own. And the arrows point at the *one* side, where
hollow means optional. A hollow arrow is therefore a nullable foreign key. Watch
for both."

---

### Slide 9 — The corpus entities

*Purpose:* name the entities *before* you show the diagram, so that slide 10 is
recognition and not decoding.

**Content** — seven entities, with one line of justification each:

- **Collection** — a canonical book, such as Bukhari or Muslim
- **Chapter** — a thematic division inside a collection
- **Hadith** — the narration itself, with its text and its matn
- **Narrator** — a person in the transmission network
- **RankLevel** — an ordinal reliability grade
- **IsnadLink** *(weak)* — one narrator at one position in one chain
- **Translation** *(weak)* — the text of one hadith in one language

*Say:* "Five ordinary entities and two weak ones. The weak ones are where the
design gets interesting."

---

### Slide 10 — The corpus ER diagram ★

*Purpose:* the first big payoff.

**Visual:** `docs/erd/chen/corpus-sfdp.svg`, full bleed, with little around it.

**Content:** the diagram and a title. Do not annotate it. Slide 11 does that.

*Say:* walk the spine only, and speak slowly. "A collection contains chapters.
Hadiths belong to a collection, and a chapter classifies them optionally. Note the
hollow arrow: some hadiths sit outside any chapter. Each hadith has chain
positions. At most one known narrator fills each position, so the arrow is hollow
again. Two scholars grade the narrators independently."

*Time:* 90 seconds. Do not hurry this slide.

---

### Slide 11 — Explanation: the isnad as a weak entity

*Purpose:* the intellectual centrepiece of the corpus design. If the audience
remembers one slide, make it this one.

**Content** — a zoom into `IsnadLink` and `Has Chain Position` from slide 10:

- Identity is `(hadith_id, sanad_no, position)`: the hadith, *which* chain, and
  *where* in that chain.
- `sanad_no` and `position` are **partial keys**. They mean nothing without the
  hadith. That is why `IsnadLink` is weak and the relationship is identifying.
- `position` runs in transmission order: **the Companion first, the compiler
  last**.
- One hadith can carry several chains, and `sanad_no` separates them.

*Say:* "The alternative was a self-referencing foreign key that says 'this
narrator taught that narrator'. It fails. Teacher and student is not a fact about
a narrator. It is a fact about a narrator *inside one specific chain*. The same
two people can stand next to each other in one chain and far apart in another. To
store the position explicitly makes the chain a first-class fact, and it means
that a chain walk is **aggregation, not recursion**."

*Expect this question, and prepare for it:* "Why not `WITH RECURSIVE`?" Answer:
because the positions are stored, the chain is already ordered. Recursion would
re-derive something that we already know. To add it would be complexity for
display.

---

### Slide 12 — Explanation: how to represent scholarly disagreement

*Purpose:* show the model handling a problem that belongs to this domain.

**Content**

- Two independent relationships, `Graded (Ibn Hajar)` and `Graded (al-Dhahabi)`,
  run from `Narrator` to the *same* `RankLevel` entity.
- Both arrows into `RankLevel` are **hollow**, meaning at most one. That
  optionality encodes three different states:

| State | Meaning |
|---|---|
| Graded | The scholar gave this narrator a grade |
| Named but ungraded | The narrator is known, and this scholar gave no grade |
| Unnamed | The chain slot names somebody with no profile at all |

- `RankLevel` carries an **`ordinal`** and a **`weight`**, so you can compare and
  compute with the grades.
- The narrators also keep the original grade **strings**, for display.

*Say:* "Two of the great rijal scholars disagree often. A design that reduced them
to one 'reliability' column would destroy the most interesting thing in the
dataset. We keep both, and the disagreement itself becomes a query. It is Q2."

---

### Slide 13 — The app entities

*Purpose:* the same recognition-before-decoding move as slide 9.

**Content** — grouped, not one flat list:

- *Identity:* User, with Student, Teacher, and Admin
- *Teaching structures:* Circle and Enrolment
- *Content selection:* StudySet and Assignment
- *Learning records:* Progress, ReviewSession, and Note
- *Derived:* StudentStats and AuditLog

*Say:* "Twelve entities in four groups. The database itself maintains the derived
pair at the end. The application does not."

---

### Slide 14 — The app ER diagram ★

*Purpose:* the second big payoff.

**Visual:** `docs/erd/chen/app-sfdp.svg`, full bleed.

*Say:* trace one workflow from end to end. Do not list the entities. "A teacher
owns a circle. Students enrol in it. The teacher builds a study set and assigns it
to the circle. That assignment makes the progress rows: one for each student and
each hadith. Students record review sessions, and teachers check them. The stats
and the audit log update themselves."

---

### Slide 15 — Explanation: the IS-A hierarchy and what it costs

*Purpose:* an honest engineering slide. An academic audience rewards a speaker who
shows the limits of their own choice.

**Content**

- `User` specialises into `Student`, `Teacher`, and `Admin`. They are disjoint
  (`d`), so a user is exactly one of them.
- PostgreSQL **table inheritance** implements it.
- The benefit: a foreign key to a *subtype* makes the business rule structural.
  `circles.teacher_id → teachers` means that **an admin cannot own a circle**, and
  the database enforces it with no application code.
- The cost: PostgreSQL inherits columns, but **not** primary keys, unique
  constraints, foreign keys, or identity.
- The schema restores each one: a shared sequence, an `ADD PRIMARY KEY` on each
  child, an `ADD UNIQUE` on each child, and a cross-table trigger for the email.

*Say:* "This is the one place where we took a feature that could have been
decorative and made it load-bearing. It is also the one place where we had to
write compensating code. It is worth being clear about why: every one of those
four gaps fails *silently*. You get bad data, not an error."

---

### Slide 16 — Explanation: the grain of `Progress`

*Purpose:* show that you reasoned about grain. That topic separates a good design
from a competent one.

**Content**

- The grain is **one row for each (student, hadith, assignment)**.
- Why not (student, hadith)? Because a hadith assigned two times is **two separate
  obligations**.
- `assignment_id` is nullable. `NULL` means private study, which the student did
  alone.
- Consequence: a later assignment **never resets** earlier private study.
- Consequence: anything that counts mastered hadiths must use
  `count(DISTINCT hadith_id)`. If it does not, a keen student is counted two
  times.

*Say:* "The nullable column does real semantic work here, and it forces a
structural decision that you will see on the logical-design slide."

---

### Slide 17 — Explanation: derived data

*Purpose:* give a reason for the two entities that look redundant on slide 14.

**Content**

- `StudentStats` holds the mastered count and the review count. A trigger
  maintains it on progress writes.
- `AuditLog` is a shadow table. It captures mastery changes: the old value, the
  new value, who made the change, and when.
- Both fire on **`app` writes only**. The corpus triggers nothing.
- The justification: derived counts are the correct use of a trigger. The
  alternative is that every write path must remember to update them.

*Say:* "Denormalisation on purpose, in one place, and the database keeps it
honest instead of the application."

---

### Slide 18 — The inter-layer ER diagram ★

*Purpose:* deliver the architectural claim from slide 7 as a picture.

**Visual:** `docs/erd/chen/inter_layer-sfdp.svg`, full bleed.

*Say:* "Everything that the study layer knows about the corpus is on this slide.
Four relationships, and all of them point at `Hadith`. A study set contains
hadiths, progress tracks a hadith, a review tests hadiths, and a note is about a
hadith. That is the entire interface between the two halves."

---

### Slide 19 — Explanation: why the interface is this small

*Purpose:* close the architecture argument.

**Content**

- Four crossings. All of them go from `app` to `corpus`, and all are read-only.
- Nothing in the corpus knows that the app exists. No column, no constraint, and
  no trigger points outward.
- The corpus is therefore replaceable on its own, cacheable on its own, and safe
  to expose read-only.
- The contrast: a `times_studied` counter on `corpus.hadiths` would end the
  read-only guarantee, and every study write would touch reference data.

*Say:* "A narrow interface was a design goal, not an accident. It is the reason
that the revoked privilege on slide 7 is possible at all."

---

# Part 4 — Logical design in crow's foot, slides 20 to 24

### Slide 20 — From conceptual to logical

*Purpose:* an explanation slide. Justify a second view of the schema, and teach
the second notation.

**Content** — side by side:

| Chen (conceptual) | Crow's foot (logical) |
|---|---|
| Entities and relationships | Tables and columns |
| Diamonds carry the relationships | Foreign keys carry them |
| Attributes are ellipses | Columns with data types |
| "What exists?" | "What does the DDL create?" |

Then the crow's-foot legend. A crow's foot means many, a tee means exactly one,
and a circle with a crow's foot means zero or one. The badges are `PK`, `FK`,
`UQ`, and `TRG`.

*Say:* "The same schema, a different question. The Chen diagrams show what the
domain contains. These show what PostgreSQL creates. Relationships that were
diamonds are now foreign keys, and every many-to-many diamond has become its own
table."

---

### Slide 21 — The corpus, logical ★

*Visual:* `docs/erd/relational/corpus.svg`.

*Say:* point at three things and no more.

1. `isnad_links` — the weak entity is now a composite primary key of three
   columns.
2. `narrators` carries `rank_*_raw` **and** `rank_*`. The strings are for display
   and the codes are for computation. The codes are the foreign keys.
3. `isnad_edges` is a **view**, not a table. The adjacency comes from the stored
   positions, and nothing stores it a second time.

---

### Slide 22 — Explanation: corpus integrity

**Content**

- Natural keys where the domain gives a stable one, such as `hadith_id` and
  `narrator_id`. Generated identity everywhere else.
- `chapter_id` is nullable. This is a deliberate model, not an oversight.
- `narrators.name_norm` is a **generated stored column**. It holds normalised
  Arabic for search, the database maintains it, and it cannot become stale.
- `hadith_translations` is keyed `(hadith_id, lang)`. It is the weak entity from
  slide 9, now a composite key. When a row is absent, the interface falls back to
  Arabic.

---

### Slide 23 — The app, logical ★

*Visual:* `docs/erd/relational/app.svg`.

*Say:* "Note three things. The gold `INHERITS` edges are not foreign keys. That is
the IS-A from slide 15. The four red edges that leave the bottom are the crossings
from slide 18, and they are the only ones. And the gold dashed edges are
references that the database *cannot* enforce with a foreign key."

---

### Slide 24 — Explanation: three integrity mechanisms

*Purpose:* the most technical slide in Part 4. It shows that you know when a
foreign key is the right tool and when it is not.

**Content** — three rows:

| Mechanism | Used for | Why |
|---|---|---|
| **Foreign key** | `circles.teacher_id → teachers` | The target is one subtype. The foreign key *is* the business rule |
| **Trigger** | `study_sets.owner_id → users` | The reference is polymorphic, because any role can own a set. A foreign key to the parent is checked with `ONLY` semantics. It sees no child rows and would reject every real user |
| **Partial unique index** | `progress` | `assignment_id` is nullable, and a nullable column cannot sit in a primary key. So there is a surrogate key and two partial indexes, one for each null state |

*Say:* "Each of these is a foreign key that we could use, could not use, or had to
approximate. The reason differs every time. The middle one is a real limit of
PostgreSQL inheritance, not a design preference."

---

# Part 5 — Physical design and validation, slides 25 to 26

### Slide 25 — Routines and the transaction boundary

*Purpose:* the physical-design slide, and a genuinely interesting PostgreSQL
distinction.

**Content**

- **`corpus.chain_strength(hadith_id)` is a FUNCTION.** It takes the weakest link
  in a chain, and the best chain wins. The grade weights drive it. An unnamed or
  unresolved slot weakens the result. It is read-only, and it is deliberately
  simple enough to defend line by line.
- **`app.assign_study_set(...)` is a PROCEDURE.** It sends an assignment to every
  enrolled student and creates their progress rows.
- **Why a procedure and not a function:** it owns its `COMMIT`. A PostgreSQL
  function cannot commit. It runs inside the transaction of the caller. That is
  exactly the difference between a function and a procedure.

*Say:* "The same language, a different construct, for one concrete reason. The
procedure controls its own transaction boundary, and a function cannot."

*If somebody asks about error handling:* the procedure carries no `EXCEPTION`
block, on purpose. A `BEGIN … EXCEPTION` block opens a subtransaction, and a
commit inside one fails at run time. An unhandled error already rolls the whole
call back.

---

### Slide 26 — Validate the design with queries

*Purpose:* prove that the schema answers real questions. This is the strongest
possible close.

**Content** — six queries, one line each, tied back to the model:

| # | Query | What it exercises |
|---|---|---|
| 1 | Top narrators by hadith count | Chain aggregation |
| 2 | **Contested narrators**, where the two scholars disagree | The two grades (slide 12) |
| 3 | Shared narrators between two chains | Positional chain storage |
| 4 | Circle overview: mastered against assigned | A cross-layer join, and `count(DISTINCT)` |
| 5 | The weakest chains among studied hadiths | `chain_strength()` and a cross-layer join |
| 6 | Assignment completion: owed against done | The progress grain (slide 16) |

*Say:* "Query 2 works only because we refused to reduce the two scholars to one.
Query 6 works only because progress is grained for each assignment. The model
earns its complexity here."

---

# Part 6 — Close

### Slide 27 — What we deliberately did not build

*Purpose:* restraint, argued. This is unusual in a student deck, and it is
therefore memorable.

**Content**

- No recursive chain walk. The positions are stored, so recursion would be
  artificial.
- No write path into the corpus, ever.
- No duplicate routines. Each feature exists one time, where it belongs.
- No stored adjacency table for the chain edges. A view derives them, so they
  cannot drift from the positions that they come from.

*Say:* "Every one of these is something that we could have added to look more
sophisticated. Each one would have been complexity with no question behind it."

---

### Slide 28 — Limits and future work

*Purpose:* raise the examiner's own criticism before they do.

**Content** — be genuinely critical:

- Table inheritance is specific to PostgreSQL. It needs compensating constraints,
  and it does not port to another engine.
- The weights in `chain_strength()` are defensible, but they are a judgement
  call, not a scholarly consensus.
- There is no spaced-repetition scheduling. Progress records state, not a review
  schedule.
- The query layer enforces the cross-layer visibility rules. Row-level security
  does not.
- Translation coverage is optional for each row, so English is best-effort
  throughout.

---

### Slide 29 — Summary

**Content** — four claims that mirror the agenda:

1. Two schemas in one instance, separated by privilege and not by convention.
2. The isnad is modelled as a weak entity, which makes chains first-class and a
   chain walk plain aggregation.
3. Scholarly disagreement stays. We do not resolve it.
4. Integrity sits in the database: keys, constraints, triggers, and one procedure
   that owns its transaction.

*Close:* "The decision that repeats is this one. Let the database enforce what the
database can enforce, and be explicit about the places where it cannot."

---

### Slide 30 — Questions

Show the title, both names, and a pointer to the repository. Leave the
`inter_layer` diagram on the screen. It is the one that reads most easily during
questions.

---

# Appendix — hold in reserve

| # | Slide | When to show it |
|---|---|---|
| A1 | Bibliographic detail, `chen/biblio.svg` | "How is the corpus organised?" |
| A2 | Isnad and rijal detail, `chen/narrator.svg` | A deeper question about the isnad or the grades |
| A3 | Study workflow detail, `chen/assignments.svg` | "Walk me through an assignment" |
| A4 | Where the data came from | Any question about the dataset or provenance |

**A4 is your escape hatch for the ETL.** Keep it to three lines. The pipeline
loads the corpus one time from a published hadith dataset, before the application
runs. It matches the narrator records by name. The load path does not exist at
runtime.

That answers the question honestly, and it does not reopen a topic that the deck
excluded.

---

# Build order

1. Do the pre-build tasks above, especially the decision about `resolution`.
2. Build slides 10, 14, 18, 21, and 23. Drop the diagrams in first. They constrain
   the layout.
3. Build the explanation slides beside them: 11, 12, 15, 16, 17, 19, 22, and 24.
4. Build the opening and the close: 1 to 7, and 27 to 30.
5. Build the appendix.
6. Rehearse Part 3 out loud, with a timer. It is 12 of the 30 slides, and it is
   where a speaker runs over.

**Confirm one assumption before you build.** This plan assumes a slot of about 25
minutes, with questions after it.

If the slot is 15 minutes, cut slides 12, 17, 22, and 27, and merge slide 4 into
slide 5. That lands near 20 slides, and it keeps all five diagrams and the isnad
argument.
