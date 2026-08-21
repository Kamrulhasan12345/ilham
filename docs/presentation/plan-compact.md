# Ilham — the compact presentation plan

**6 slides, 5 to 6 minutes.** A cut of 5 slides, about 3.5 minutes, is at the
end.

This plan is the companion to [`plan.md`](plan.md), the full 30-slide version.
This is **not the first six slides of that deck**. A short talk needs a different
shape. The long deck walks through the design. This one argues one thesis and
uses the diagrams as evidence.

> **Thesis:** *Ilham holds a classical text corpus and a live study workload in
> one database. It keeps them safely apart by design, not by discipline.*

Everything on every slide must serve that sentence. Cut anything that does not.

---

## Scope note

This deck uses the same exclusion as the full deck: **no ETL**. It shows no data
sources, no load pipeline, and no `staging` schema. It presents the design as it
exists at runtime: **two schemas, `corpus` and `app`.**

Never say "three schemas". That count in `docs/architecture.md` and `CLAUDE.md`
includes `staging`.

Do not use `docs/erd/relational/schema.dot`. It renders staging and its flow
edges.

---

## The hard constraint

At about 40 seconds for each slide, **you cannot show five dense diagrams and
also make an argument**. This plan therefore gives the diagrams two different
jobs:

- **Read closely** — slides 3, 4, and 5. Three Chen diagrams, one for each slide,
  and one point called out on each. These get the time.
- **Seen, not read** — slide 6. Two crow's-foot diagrams, small and side by side.
  They are *evidence that the conceptual model became real DDL*. Nobody can read a
  3,800-pixel column list in eight seconds. Say what they prove. Do not ask the
  audience to decode them.

If your slot is nearer to 3 minutes, use the 5-slide cut. Do not read this one at
speed.

---

## Assets

| Slide | Asset |
|---|---|
| 3 | `docs/erd/chen/corpus-sfdp.svg` |
| 4 | `docs/erd/chen/app-sfdp.svg` |
| 5 | `docs/erd/chen/inter_layer-sfdp.svg` |
| 6 | `docs/erd/relational/corpus.svg` and `docs/erd/relational/app.svg`, both small |

All of them exist and are current. Use the **sfdp** renders for slides 3 to 5.
They read better on a projector than the neato ones.

**Use SVG, not PNG. Size the diagram; do not stretch it.** These graphs carry
much small text. A raster image blurs as soon as a projector scales it. To
stretch a diagram to fill its panel helps nothing. Place each diagram inline at a
fixed width. The PDF keeps it vector, so it stays sharp and you can zoom into it
during questions.

---

# Slide 1 — Title and thesis

**Time: 20 seconds.** Do not stop here. The clock is the enemy.

**Content**

- **Ilham (إلهام)** — a hadith study platform that a teacher leads
- Subtitle: **Database Design**
- One line on the slide, in large type: *One database, two opposite workloads,
  kept apart by privilege — not by convention.*
- Both names, the course code, and the date, in small type

*Say this, or something close to it:* "Ilham is a platform. Teachers assign
classical hadith texts to students, and the system tracks what the students
learn. The design problem is that it must hold two very different kinds of data
at the same time. This talk shows how we kept them apart."

Then move on. Do not introduce yourselves at length.

---

# Slide 2 — The domain, and why it is a modelling problem

**Time: 60 seconds.** This is the most compressed slide in the deck. It makes the
next three understandable.

**Content** — one column, full width.

*The domain, in three terms, over one drawn chain:*

- A **hadith** is a recorded narration. The **matn** is its text.
- The **isnad** is the chain of persons who transmitted it, one to the next.
- Scholars grade those narrators for reliability — **and they disagree**.

Draw the chain one time, from left to right:
`Companion → … → … → Compiler`

*Then the two workloads, in one line:* the corpus is large, shared, and never
edited. Student activity is small, belongs to one user, and is written
constantly. Two opposite profiles, one database.

*Say:* "Every hadith carries its own provenance. The chain is not metadata about
the text. In this domain it is half of the text. That is the reference side:
large, shared, and it never changes. Against it sits student activity: small, one
user at a time, and written constantly. Two opposite profiles, one database."

*Why this slide survives the cut:* without the *isnad*, a non-specialist cannot
read slide 3, and the strongest part of the design reaches nobody.

---

# Slide 3 — The corpus, conceptually ★

**Time: 80 seconds.** The longest slide. The marks are here.

**Visual:** `docs/erd/chen/corpus-sfdp.svg`. Show the heading and the diagram
only. The figure takes the whole body of the slide.

**Content** — the diagram. Print nothing else. **Speak** the one point, and point
at `IsnadLink` while you make it:

> **A chain position is a weak entity.**
> Three things identify it: *(the hadith, which chain, the position in it)*.
> The positions are explicit. The Companion is first and the compiler is last.

*Say:* "Collections hold chapters, and chapters hold hadiths. That part is
ordinary. The interesting entity is the one with the double border: a chain
position. It cannot exist on its own. Three things identify it: which hadith,
which chain, and where in that chain.

The alternative was a link that says 'this narrator taught that narrator', and it
fails. Teacher and student is not a fact about a narrator. It is a fact about a
narrator *inside one specific chain*. To store the position explicitly makes
chains first-class. It also makes a chain walk plain aggregation instead of
recursion."

*If you have five spare seconds, add:* "Note the two separate grading
relationships. We kept both scholars instead of one combined value, because the
disagreement is the interesting part."

*Cut discipline:* do not list the attributes. Do not explain the arrowheads. Make
one point.

---

# Slide 4 — The study layer, conceptually ★

**Time: 70 seconds.**

**Visual:** `docs/erd/chen/app-sfdp.svg`. Show the heading and the diagram only.

**Content** — the diagram. **Speak** both points. Point at each one on the figure:
the ISA triangle under `User`, and the grain of `Progress`.

> **Users specialise.** Student, Teacher, and Admin, and they are disjoint. A
> foreign key to a *subtype* makes the rule structural. An admin cannot own a
> circle.

> **Progress is grained by (student, hadith, assignment).** A hadith assigned two
> times is two obligations. A new assignment never resets earlier private study.

*Say:* "A teacher owns a circle. Students enrol. The teacher assigns a study set,
and that makes the progress rows: one row for each student and each hadith.

Two decisions are worth a look. First, users specialise into three subtypes. A
foreign key that points at *teachers* therefore makes it impossible for an admin
to own a circle. The database enforces the rule, and it needs no application
code.

Second, progress is grained for each assignment, not for each hadith. The same
hadith assigned two times is two separate obligations."

*Cut discipline:* the trade-offs of inheritance, the trigger-maintained tables,
and the partial indexes are all interesting, and all of them are cut. They belong
to the long deck.

---

# Slide 5 — The boundary ★

**Time: 60 seconds.** This slide *is* the thesis. Everything before it was
preparation.

**Visual:** `docs/erd/chen/inter_layer-sfdp.svg`. Show the heading and the diagram
only. It is the sparsest diagram in the set, and the only one that reads
instantly. That is exactly why it earns a slide of this length.

**Content** — the diagram. **Speak** the `REVOKE` slowly. Do not print it:

> `REVOKE INSERT, UPDATE, DELETE ON corpus.* FROM <app role>`

*Say:* "This is everything that the study layer knows about the corpus. Four
relationships, and all four point at the hadith. A set contains them, progress
tracks them, a review tests them, and a note is about one. That is the whole
interface.

Because the interface is that narrow, we could remove write privileges on the
corpus completely. I want to leave you with one distinction: a convention against
a guarantee. A comment that says 'do not write here' is a convention. A revoked
privilege is a guarantee. Nothing in the corpus even knows that the application
exists."

---

# Slide 6 — It is a real schema, and here is what it guarantees

**Time: 50 seconds.** Evidence and the close, in one slide.

**Visual:** `relational/corpus.svg` and `relational/app.svg`, **side by side and
small**, about one third of the slide. They are wallpaper here, and that is
deliberate.

**Content** — the two thumbnails, with the caption *"the same two layers as
implemented tables, with every key and constraint"*. Beside them, three claims:

1. **Chains are first-class.** The positions are stored, so a chain walk is
   aggregation.
2. **Scholarly disagreement stays.** We do not reduce it to one number.
3. **Nothing can write to the corpus at runtime.** A privilege enforces this.

*Say:* "Those conceptual models are implemented. Every entity is a table and every
relationship is a foreign key. I show these only to make one point: the design
exists as DDL, not as a drawing.

To close. The chains are stored by position, so you can query them without
recursion. We kept the grades of both scholars, because the disagreement is the
finding. And the corpus is read-only in a way that no application bug can undo. I
am happy to go deeper on any part of it."

*Do not* ask the audience to read the thumbnails. If somebody asks about one,
that is a good question. Open the full SVG.

---

# The 5-slide cut, about 3.5 minutes

For a very short slot, **merge slides 1 and 2**. Put the thesis line and the
three domain terms on one opening slide. Drop the table of two workloads. Let
slide 5 carry the contrast on its own.

| # | Slide | Time |
|---|---|---|
| 1 | Title, thesis, and the domain in three terms | 45s |
| 2 | The corpus, conceptually ★ | 65s |
| 3 | The study layer, conceptually ★ | 55s |
| 4 | The boundary ★ | 50s |
| 5 | The implemented schema and three claims | 40s |

That is about 4 minutes, with room to breathe.

**Do not cut a diagram to save time. Cut words.** The diagrams are the evidence.
The sentences compress.

---

# Build order

1. Build slides 3, 4, and 5 first. Drop the three Chen renders in and let them set
   the layout. They are the deck.
2. Build slide 6. Make the two crow's-foot SVGs small. Check that they still look
   like *schemas* at that size. They must read as structured boxes, not as a
   blur.
3. Build slides 1 and 2 last. Write them to fit the time that is left.
4. **Rehearse out loud, with a timer, two times.** At this length, 40 seconds
   over is an overshoot of 15%. The most common failure is slide 3. The isnad
   argument is genuinely interesting, and it is very easy to talk past the time.

**Confirm one thing before you build.** This plan assumes that the compact talk
stands alone.

If it is instead a *teaser* for the full presentation, drop the thumbnails on
slide 6 and end on the boundary claim of slide 5. That trades the "it is really
implemented" evidence for a cleaner finish. Make that trade only if the long
version is certain to follow.
