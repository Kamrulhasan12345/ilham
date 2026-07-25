# Ilham — Database Design, Compact Presentation Plan

**6 slides / 5–6 minutes.** A 5-slide, ~3.5-minute cut is at the end.

Companion to [`plan.md`](plan.md), the full 30-slide version. This is **not its
first six slides** — a short talk needs a different shape. The long deck walks
the design; this one argues a single thesis and uses the diagrams as evidence.

> **Thesis:** *Ilham stores a classical text corpus and a live study workload in
> one database, and keeps them safely apart by design rather than by discipline.*

Everything on every slide serves that sentence. Anything that doesn't is cut.

---

## Scope note

Same exclusion as the full deck: **no ETL** — no data sources, no load pipeline,
no `staging` schema. The design is presented as it exists at runtime: **two
schemas, `corpus` and `app`.** Never say "three schemas"; that count in
`docs/architecture.md` and `CLAUDE.md` includes `staging`. Do not use
`docs/erd/relational/schema.dot`, which renders staging and its flow edges.

---

## The hard constraint, stated honestly

At roughly 40 seconds a slide **you cannot show five dense diagrams and also
make an argument.** So this plan deliberately splits the diagrams into two jobs:

- **Read closely** (slides 3, 4, 5) — the three Chen diagrams, one per slide,
  each with exactly one point called out. These get the time.
- **Seen, not parsed** (slide 6) — the two crow's-foot diagrams, shown small and
  side by side as *evidence that the conceptual model became real DDL*. Nobody
  can read a 3800 px column listing in eight seconds, and pretending otherwise
  wastes the slide. Say what they prove; don't ask the audience to decode them.

If your slot is nearer 3 minutes, use the 5-slide cut — do not speed-read this
one.

---

## Assets

| Slide | Asset |
|---|---|
| 3 | `docs/erd/chen/corpus-sfdp.svg` |
| 4 | `docs/erd/chen/app-sfdp.svg` |
| 5 | `docs/erd/chen/inter_layer-sfdp.svg` |
| 6 | `docs/erd/relational/corpus.svg` + `docs/erd/relational/app.svg`, both small |

All exist and are current. Use the **sfdp** renders for slides 3–5; they read
better projected than the neato ones.

**SVG, not PNG, and sized rather than stretched.** These graphs carry a lot of
small text: a raster blurs as soon as a projector scales it, and stretching a
diagram to fill its panel helps nothing. Each diagram is placed inline at a
controlled width and the PDF keeps it vector, so it stays sharp and can be
zoomed into during questions.

---

# Slide 1 — Title and thesis

**Time: 20 seconds.** Do not linger; the clock is the enemy here.

**Content**
- **Ilham (إلهام)** — a teacher-led hadith study platform
- Subtitle: **Database Design**
- One line, on the slide, in large type:
  *One database, two opposite workloads, kept apart by privilege — not by
  convention.*
- Both names, course code, date — small

*Say (verbatim-ish):* "Ilham is a platform where teachers assign classical hadith
texts to students and track their memorisation. The design problem is that it
has to hold two completely different kinds of data at once, and this is how we
kept them apart."

Then move. Resist introducing yourselves at length.

---

# Slide 2 — The domain, and why it's a modelling problem

**Time: 60 seconds.** The most compressed slide in the deck, and the one that
makes the next three intelligible.

**Content** — one column, full width.

*The domain, three terms over one drawn chain:*
- A **hadith** is a recorded narration: the **matn** is the text
- The **isnad** is the chain of people who transmitted it, person to person
- Scholars grade those narrators for reliability — **and they disagree**

Draw the chain once, left to right: `Companion → … → … → Compiler`

*Then the two workloads, in one line of prose:* the corpus is large, shared and
never edited; student activity is small, per-user and written constantly — two
opposite profiles, one database.

*Say:* "Every hadith carries its own provenance — the chain isn't metadata about
the text, for this domain it's half the text. That's the reference side: large,
shared, and it never changes. Against it sits student activity: small,
per-user, written constantly. Two opposite profiles, one database."

*Why this slide survives the cut:* without *isnad*, slide 3 is unreadable to a
non-specialist and the strongest part of the design lands on nobody.

---

# Slide 3 — The corpus, conceptually ★

**Time: 80 seconds.** The longest slide. This is where the marks are.

**Visual:** `docs/erd/chen/corpus-sfdp.svg`, inline in the right ~72% of the
slide, callout in the left column. Not full bleed — overlaying the callout on
this diagram covers `Narrator`.

**Content** — the diagram, plus **one** callout box, on `IsnadLink`:

> **A chain position is a weak entity.**
> Identified by *(hadith, which chain, position in it)*.
> Positions are stored explicitly — Companion first, compiler last.

*Say:* "Collections hold chapters hold hadiths — that part is ordinary. The
interesting entity is the double-bordered one: a chain position. It can't exist
on its own; it's identified by which hadith, which chain, and where in that
chain. The alternative was a 'this narrator taught that narrator' link, and it
fails — teacher-and-student isn't a fact about a narrator, it's a fact about a
narrator *within one specific chain*. Storing position explicitly makes chains
first-class, and it means walking a chain is plain aggregation rather than
recursion."

*If you have five spare seconds, add:* "And note the two separate grading
relationships — we kept both scholars rather than collapsing them, because the
disagreement is the interesting part."

*Cut discipline:* do not enumerate attributes. Do not explain `0..1`. One point.

---

# Slide 4 — The study layer, conceptually ★

**Time: 70 seconds.**

**Visual:** `docs/erd/chen/app-sfdp.svg`, inline in the right ~62%, the two
callouts stacked in the left column.

**Content** — the diagram, plus **two** short callouts:

> **Users specialise.** Student / Teacher / Admin, disjoint. A foreign key to a
> *subtype* makes the rule structural — an admin cannot own a circle.

> **Progress is grained per (student, hadith, assignment).** A hadith assigned
> twice is two obligations; prior self-study is never reset.

*Say:* "A teacher owns a circle, students enrol, the teacher assigns a study set,
and that produces progress rows — one per student per hadith. Two decisions
worth pointing at. Users specialise into three subtypes, so a foreign key
pointing at *teachers* means an admin simply cannot own a circle — the database
enforces the rule with no application code. And progress is grained per
assignment, not per hadith, because the same hadith assigned twice is two
separate obligations."

*Cut discipline:* the inheritance trade-offs, the trigger-maintained tables, and
the partial indexes are all interesting and all cut. They live in the long deck.

---

# Slide 5 — The boundary ★

**Time: 60 seconds.** This slide *is* the thesis. Everything before it was setup.

**Visual:** `docs/erd/chen/inter_layer-sfdp.svg`, inline in the right ~56%. It
is the sparsest diagram in the set and the only one that reads instantly — which
is exactly why it earns a slide at this length.

**Content** — the diagram, plus one line beneath it:

> `REVOKE INSERT, UPDATE, DELETE ON corpus.* FROM <app role>`

*Say:* "This is everything the study layer knows about the corpus. Four
relationships, all pointing at hadith — a set contains them, progress tracks
them, a review tests them, a note is about one. That's the whole interface. And
because it's that narrow, we could revoke write privileges on the corpus
entirely. The distinction I want to leave you with is between a convention and a
guarantee: a comment saying 'don't write here' is a convention; a revoked
privilege is a guarantee. Nothing in the corpus even knows the application
exists."

---

# Slide 6 — It's a real schema, and what it guarantees

**Time: 50 seconds.** Evidence plus close, in one slide.

**Visual:** `relational/corpus.svg` and `relational/app.svg`, **side by side and
small** — roughly a third of the slide. They are wallpaper here, deliberately.

**Content** — the two thumbnails, captioned *"the same two layers as implemented
tables, with every key and constraint"*, and beside them three claims:

1. **Chains are first-class** — stored positions, so traversal is aggregation
2. **Scholarly disagreement is preserved**, not resolved into one number
3. **The corpus cannot be written at runtime** — enforced by privilege

*Say:* "Those conceptual models are implemented — every entity is a table, every
relationship a foreign key, and I'm showing these only to make the point that the
design exists as DDL rather than as a drawing. To close: chains are stored
positionally so they're queryable without recursion, we kept both scholars'
grades because the disagreement is the finding, and the corpus is read-only in a
way no application bug can undo. Happy to go deeper on any of it."

*Do not* invite the audience to read the thumbnails. If someone asks, that's a
good question to get — open the full SVG.

---

# The 5-slide cut (~3.5 minutes)

For a genuinely short slot, **merge slides 1 and 2**: put the thesis line and the
three domain terms on one opening slide, drop the two-workloads table, and let
slide 5 carry the contrast on its own.

| # | Slide | Time |
|---|---|---|
| 1 | Title + thesis + domain in three terms | 45s |
| 2 | Corpus, conceptually ★ | 65s |
| 3 | Study layer, conceptually ★ | 55s |
| 4 | The boundary ★ | 50s |
| 5 | Implemented schema + three claims | 40s |

≈ 4 minutes with breathing room. **Do not** cut a diagram to save time — cut
words. The diagrams are the evidence; the sentences are compressible.

---

# Build order

1. Slides 3, 4, 5 first — drop the three Chen renders in and let them set the
   layout. They are the deck.
2. Slide 6 — shrink the two crow's-foot SVGs; check they still look like
   *schemas* at thumbnail size (they should read as structured boxes, not mush).
3. Slides 1 and 2 last, written to fit the time left over.
4. **Rehearse with a timer, out loud, twice.** At this length overrunning by 40
   seconds is a 15% overshoot. The most common failure is slide 3 — the isnad
   argument is genuinely interesting and very easy to talk past.

**One thing to confirm before building:** this assumes the compact talk stands
alone. If instead it's a *teaser* for the full presentation, drop slide 6's
thumbnails, end on slide 5's boundary claim, and let the schema detail arrive in
the long deck — that trades the "it's really implemented" evidence for a cleaner
finish, which is the right trade only if the long version is guaranteed to
follow.
