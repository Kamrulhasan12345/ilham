# Design system — Apparatus

This folder holds the design system for the Ilham frontend.

This document uses ASD-STE100 Simplified Technical English.

The chosen direction is **Apparatus**: one system on two grounds. **1c** is
the light default and **2a** is the dark alternate. `Ilham Directions.dc.html`
in this folder holds the full report, and it also holds the two rejected
directions, 1a Codex and 1b Register. Do not build from those two.

## Files

- `index.html` — the **hub**. A hand-written full document, not a fragment and
  not generated: it holds the corpus figures, the ground switch, and the links
  to everything else. Edit it directly.
- `specimen.html` — the live specimen. It shows both grounds, the foundations,
  the chain, the component library, the analytics forms, the motion contract and
  the nine implementation rules. Open it in a browser. The `:root` block at the
  top of the file is the **source of truth** for the tokens. Copy that block to
  `frontend/src/styles/tokens.css` when somebody creates the frontend. Every
  chapter carries an `id`, so the hub can link into it.
- `demo.html` — a working prototype of four screens: the hadith page, a
  narrator profile, a teacher circle dashboard, and the disagreement analytics.
  It routes on the hash, and the top bar switches the ground. Its token block is
  a **copy** of the specimen's. Change the specimen first, then the demo.
- `DESIGN.md` — the build contract. It states the tokens, the rules and the
  component behaviour in the form an implementer needs, with nothing about why.
  The README gives the reasons; `DESIGN.md` gives the values.
- `README.md` — this file. It gives the rules. The specimen shows them.
- `Ilham Directions.dc.html` — the direction report. 1c and 2a are the shipped
  pair. Keep 1a and 1b in the file as the record of what was rejected.
- `build-pages.sh` — builds `pages/` from the sources.
- `pages/` — **generated. Never edit it by hand.** It wraps the two fragments in
  real documents, and copies the hub and the direction report in beside them so
  the folder is self-contained when it is published.

### Four reports the hub advertises and nobody has written

The hub has rows for a contrast review, a legibility report, a motion report and
an evidence report. **None of those four documents exists.** Each link now goes
to the nearest place the material actually lives:

| Hub row | Points at | What is still missing |
|---|---|---|
| The review | `specimen.html#colour` | the four contrast claims that failed, and what changed because of them |
| Legibility | `specimen.html#type` | the peer-reviewed study that argues for tracked capitals |
| Motion | `specimen.html#motion` | the playable duration comparison |
| The evidence | `Ilham Directions.dc.html` | a standalone `Ilham Evidence` trail, which the direction report cites |

Write them, or cut the rows. Do not leave a link that promises a document that
is not there.

## Why `pages/` exists

`specimen.html` and `demo.html` are **fragments**. They carry no `<!doctype>`,
no `<html>`, no `<head>`, and no `<body>`, because the Artifact publisher wraps
them in its own skeleton and refuses a file that brings its own.

A fragment opens in a browser, and on a desktop it looks correct. On a phone it
does not. Without `<meta name="viewport">` a mobile browser lays the page out at
980px and then zooms out, so **none of the responsive CSS applies**. A narrow
desktop window does not show this, because it sets the layout viewport directly.

Run the build after any change to a source:

```bash
./docs/design/build-pages.sh
```

The build adds the doctype, `lang="en"`, the character set, the viewport, and
`color-scheme: light dark`, which tells the browser to paint the scrollbars and
the form controls for the current ground.

To publish them, open the repository settings on GitHub, then Pages, then set
the source to the `master` branch and the `/docs` folder. The index then serves
at `/design/pages/`.

## The idea

**The other two directions treated Arabic as content inside an English
product. This one inverts it.** The Arabic is the object on the table, set at
44px, and the whole English interface shrinks to a quiet apparatus around it:
labels at 12px, one accent, no serifs anywhere.

A hadith page is a scholarly edition of a text. The reader reads the text. The
apparatus argues about the text, from the rail.

## Scale

**This project holds no photography.** The corpus is 14,901 hadiths of text and
no images. Type, colour, and scale carry the whole visual load.

The Latin scale runs **4.0:1**, from 13px to 52px, with 72px held back for
corpus counts on the dashboard. The floor was raised, not the ceiling: **13px is
the smallest size in the system and it sets labels only**, and 15px carries
every word a beginner actually has to read.

Give each page one moment of scale and keep everything else quiet. Between 21px
and 28px the system has nothing, on purpose.

## Colour

The system has **seven roles and one accent**, on two grounds. Light is the bare
`:root`; dark is the alternate, under `prefers-color-scheme: dark` and
`[data-theme="dark"]`.

| Token | Light (1c) | Dark (2a) | Use |
|---|---|---|---|
| `--ground` | `#FCFCFA` | `#16181A` | The page. Where the Arabic lives. Charcoal on dark, never `#000`. |
| `--rail` | `#F1F0EC` | `#1E2124` | The apparatus column and all chrome. On dark it is the lighter surface. |
| `--rule` | `#D8D7D1` | `#2E3236` | Hairlines and cell edges. 3.2:1 — structure, never text. |
| `--edge` | `#8B8B85` | `#656B72` | A control boundary that has to clear 3:1. Chips and tabs, and a chart axis. Never a hairline, never text. |
| `--ink` | `#111211` | `#E4E2DC` | Arabic and headings. 17.6:1 light, 12.9:1 dark. |
| `--ink-app` | `#5C5F5C` | `#B4B8B3` | Every English label and rail word. 5.9:1 light, 9.2:1 dark. |
| `--index` | `#2437C4` | `#93A8F5` | The only accent: links, focus, anchor, position. 8.0:1 on dark. |
| `--machine` | `#3B3E42` | `#A9AEB4` | Database values. Always quieter than the ink. |

Rules:

1. **One hue, one job.** A system with a single accent cannot build a good/bad
   scale, because there is nothing to pair the blue against. Index blue means
   "you are here" and nothing else.
2. **Never green, never gold, never red.** A green was tried in the accent slot
   and cut. A system whose thesis is one accent loses that thesis the moment a
   second hue can mean status — and in this subject green carries direct
   religious weight. Charcoal and green together is a banner before it is an
   interface.
3. **Grade rank is never a colour and never a chip.** It is a word in the rail
   and a bracketed weight.
4. A primary button is ink, not a hue. A destructive action is a 2px border and
   an exact verb.
5. **If the screen works in greyscale, it works.**
6. Contrast floors: light 4.5:1 body and 3:1 for UI and large text; dark 7:1 for
   body, because the AAA threshold is a real readability gain once halation is
   in play. The specimen prints each ratio.

### Why light is the default

Reading research reports a **positive-polarity advantage** — black-on-white
measures more legible than white-on-black, which is attributed to the brighter
illumination of positive-polarity displays. Those studies are on Latin text, and
there is no equivalent controlled study on vocalised Naskh. So 2a ships as a
**user-chosen alternative**, not as the default. The student chooses the ground
and it persists. **Never auto-switch by time of day.**

### What the dark ground changes, and why

Everything that changes changes for an optical reason, not a stylistic one.

- **Ground is charcoal, not black.** Pure black maximises the luminance delta
  that drives halation and eye strain.
- **Ink is a softened white, not `#FFF`.** Pure white on dark gives the
  strongest halation and ghosting, and it is described as actively painful for
  readers with astigmatism.
- **The accent desaturates** by roughly 20 points. Saturated hues both fail
  contrast and vibrate on a dark surface.
- **`--rule` and `--edge` split.** A hairline may sit at 3.2:1 because it is
  structure. A control boundary may not: a chip or a tab has to be findable, so
  it takes `--edge` and clears 3:1 as a UI component.
- **Body English goes 16 → 17px** with +0.01em tracking, the standard optical
  correction for small text on dark.
- **Arabic line-height goes 1.9 → 1.95.** Vowel marks bloom on dark, and the
  extra 0.05 buys the clearance back without touching the size.
- **Arabic stays Regular.** The sources conflict on body weight in dark mode:
  one camp says step up because halation thins light strokes, another says step
  down because light text already reads bolder. The thinning argument applies at
  body size, and this Arabic is at 44px, where bloom dominates instead.
- **Elevation is the lighter rail surface, and nothing else.** No shadows — they
  do not read on a dark ground.

Nothing else in the ladder moves, so **a screen can switch ground without
reflowing**.

## Type

Three families do three jobs. You can name the job from the text.

| Family | Job |
|---|---|
| Scheherazade New | All Arabic corpus content. Regular only. |
| Instrument Sans | English reading, at 16–21px. |
| Instrument Sans 600 | Interface chrome. 13px, **sentence case**, tracked +0.005em. |
| DM Mono | Database values only, and always bracketed. |

**Sans for English is a deliberate demotion.** The serif voice belongs to the
Arabic alone, so the eye never mistakes a translation for the source. One family
covers both English roles; weight and case do the separating, not a second
typeface.

**The bracket rule.** Every value that came out of the database unchanged is
bracketed as well as monospaced, so the distinction survives a screenshot, a
printout and a screen reader. This covers grade weights, chain positions,
tabaqa, dates, identifiers, and `hadith_num`. Do not use mono for labels or for
prose. It is also why `hadith_num` is machine ink: it is text, it can read
`2564 a`, and it must never be sorted as a number.

### Scales

| Latin · ratio 4.0:1 | Arabic · its own ladder |
|---|---|
| 72 / 0.95 — corpus counts only | 64 / 1.75 — chapter title |
| 52 / 1.0 — screen title | 44 / 1.9 — the hadith itself |
| 38 / 1.1 — narrator name | 28 / 1.9 — narrator name, page heading |
| 28 / 1.25 — section heading | 22 / 1.25 — narrator name inside a chain |
| 21 / 1.45 — lead and pull translation | 22 / 2.1 — a raw Arabic verdict |
| 16 / 1.55 — translation body, table cells | |
| 15 / 1.55 — rail body, glosses, grade words | |
| 13 / 1.4 — every label in the product | |

The Arabic ladder overlaps the Latin one only at the bottom. Body Arabic at 44px
sits against body English at 16px — a 2.75× ratio between the two scripts, which
is what vocalised Scheherazade needs to feel the same weight as a 16px
grotesque. **Arabic never inherits a Latin size.**

## Space, radius, border

- **Space** is a doubling scale on a 6px base, five steps only: 6 · 12 · 24 · 48
  · 96. Dense areas use 6 and 12. **The gap between the rail and the text is
  always 48.** Fewer steps means the rhythm reads when a screen is full.
- **Radius** is 0 everywhere, except interactive chips and filters, which are
  fully round. **Roundness means one thing: you can click it.**
- **Borders** exist on one or two edges, never four. Grouping is the rail tint
  and 48px of air. There are **no cards, no panels, and no shadows.**
- **Focus** is a 2px Index outline at 2px offset, on `:focus-visible`, with a
  `forced-colors` fallback. Never a `box-shadow` — it disappears in Windows High
  Contrast Mode.

### Labels are sentence case, not tracked capitals

Labels were 12px uppercase at +0.12em. They are now **13px sentence case at
+0.005em**. Capitals cost a reader the word-shape cue that lowercase gives, and
they measure slower to read; tracking them wide enough to be legible then makes
each label physically longer, which a 210px rail cannot afford. One point of
size buys back more legibility than the capitals ever did.

The hub advertises a legibility report that argues the other side. It is not
written. Until it is, this is the rule and the specimen is the proof.

## Chain density

The chain sets the narrator name at 22px and puts **both scholars' verdicts on
one line**, joined by a slash, with the machine values on a third. A row
measures **65px**, so ten narrators fit in about 650px — one screen, and no
scroll. A verdict too long for its line is clipped there and printed in full
behind "Show grading detail". The apparatus is never deleted; it stops being the
default.

## What the chain carries

Each chain row holds four things, in this order:

1. **The Arabic name**, at 22px, right-aligned — the object.
2. **A transliteration** under it, in English, so a reader who cannot yet read
   Naskh can still say the name out loud in class. It is a reading aid, not a
   translation, and it never replaces the Arabic.
3. **Both scholars' verdicts on one line**, in plain English, joined by a slash.
4. **The machine values** — `[gen]`, `[wt]`, and the transmission word.

**Gloss the transmission word.** `[ḥaddathanā]` is followed by "he narrated to
us" in quotation marks. The word is the single most important thing in the chain
for a hadith student and the single most opaque thing for a beginner, so it
never appears untranslated.

## Filtering the chain by generation

The hadith page carries a slider that hides the later end of the chain by
generation. Rules:

1. **Say what generation means.** 1 is the Companions and 10 is the collectors'
   own teachers. It is a database value, not a ranking.
2. **Say that filtering is the reader's act, not a judgement.** Nothing is
   scored by hiding it, and the chain strength does not move.
3. **The readout is the accessible truth and the bar is only the affordance.**
   Print "Showing 6 of 6 narrators — generations 1 to 10" as text, and give the
   slider ± step buttons so it is reachable without a drag.
4. A filtered row **leaves** at `--dur-micro`. It does not fade to nothing and
   stay in the tree.

## The fixed rail

**This is the signature element.** A 210px rail runs down every screen in the
product, at the same x position, holding whatever English the current object
needs: labels, identifiers, grades, glosses, the teacher's note on a student.

The rail never changes width and never wraps around the Arabic. Learning the
product means learning one rail — and because it is a fixed column, a teacher
can point at it in class.

A student taps a classical term and the gloss lights in the rail instead of
covering the text, the way a printed edition carries its own commentary. It is
the one place beginners are taught vocabulary, and it never moves.

Below 62rem the rail becomes a strip above the text. It keeps its content and
its order.

## Direction

The interface speaks English and runs left to right. All corpus text is Arabic
and runs right to left.

1. Put every Arabic string in an element with `dir="rtl"`. Database-sourced
   strings use `dir="auto"` or `<bdi>`. Use the **HTML attribute**, not the CSS
   property: it works without CSS, and it isolates as well as directs. The
   rail's Latin transmission word inside an Arabic name is the case that breaks
   without it.
2. Use logical CSS properties. Write `margin-inline-start`, not `margin-left`.
   A full right-to-left interface stays possible later. A rewrite does not.
3. Give Arabic its own size scale and its own leading. Use the `--fs-ar-*`
   tokens. Do **not** use the Latin scale for Arabic.
4. **Letter-spacing is zero on every Arabic element, at every size.** Arabic is
   a joined script, and tracking pulls the joins apart. The +0.005em in this
   system belongs to 13px Latin labels only.
5. **No italic and no synthetic bold.** Only Scheherazade New's Regular has a
   truly drawn Bold, so anything heavier risks a face the app synthesised.
   Emphasis on Arabic is a 2px underline in Index blue. Italics are for English
   glosses.
6. **Ragged, never justified.** Inter-word justification produces rivers and
   uneven colour, letter-level adjustment carries Arabic-specific problems, and
   there is no hyphenation to fall back on.

## Motion

The animation literature contradicts itself, and the split runs through this
product. Smooth transitions between views halve the error rate in controlled
tests, and short transitions measure as effective as long ones. Animation *of
data* has never outperformed a well-made static diagram.

So Apparatus **animates the viewpoint and refuses to animate the data.** Never
animate a grade, a weight, a generation, or a chain position.

### Three durations, one curve

Named for the job, not the length. One easing curve, because linear motion reads
as unnatural and ease-out is what something arriving does.

| Token | Value | Job |
|---|---|---|
| `--dur-micro` | 120ms | Hover, press, fill, a row leaving a filter. Anything that repeats dozens of times an hour, because a delay met repeatedly is friction rather than polish. |
| `--dur-move` | 180ms | The route change and disclosures — a viewpoint change, the one case the evidence positively supports. |
| `--dur-enter` | 240ms | An element arriving for the first time. This is the ceiling: 400ms is called very slow and 500ms "a real drag". |
| `--ease-out` | `cubic-bezier(.2,.7,.3,1)` | Every transition in the system. |

### Scale before speed

The trigger for motion sensitivity is **how far** something moves, not how long
it takes. **Nothing travels more than 8px.** Nothing scales, parallaxes, loops,
or moves in the periphery while somebody is reading — peripheral movement forces
an involuntary shift of attention, which on a page of hadith is an interruption
dressed as a feature.

### Motion may offset content. It may never hide it

An earlier version faded sections in from `opacity: 0`, which left whole
sections invisible until scrolled — invisible but still focusable, still matched
by find-in-page, and permanently gone if the observer never fired. **Animate the
offset, never the opacity.** Every word stays readable the whole time, which is
also the test for whether the motion was decorative.

The chain draw obeys this. It still arrives in **transmission order** — the
Companion first, the collector last, one rung every 45ms, which on this layout
runs bottom to top because Apparatus prints the collector at the head — but it
does it with an 8px offset under `--dur-enter`, and no row is ever hidden.

### Reduced motion

Collapse the duration, keep the state change. Under `prefers-reduced-motion`
every duration becomes 0.01ms, but the route still changes, the filtered row
still disappears, and the readout still updates. Motion is never the only
carrier of a change here. Nuking motion wholesale is its own failure: a
transitional interface helps some readers with cognitive disabilities follow a
change.

### The one exception, documented rather than hidden

The three corpus figures on the hub count up over 520ms on first load, which
breaks both the 240ms ceiling and the no-animated-data rule. It is permitted
because it runs once per session, it is an entrance rather than a response to
input, and the final figure is the only one anybody reads.

Do not add a library for any of this. A CDN script tag does not load inside a
published artifact, and an `IntersectionObserver` does the same work in 20 lines.

## Write for a person who knows no hadith science

Most users are students who have never seen a rijal grade. The apparatus is for
the researcher. It must not be the first thing anybody meets.

**The rule: no bare number, ever.** A value between 0 and 1 reads as a
probability. A reader who sees `0.95` concludes "95% likely true", and a reader
who sees `0.10` concludes "probably fake". Ilham makes no such claim, and PRD §1
forbids it. Always pair the number with a plain word, and lead with the word.

- Say **"This chain is strong"**, then give `[wt 0.95]` as a smaller detail.
- Never write "chain strength 0.10" with nothing beside it.

**Put the disclaimer on the screen, not in this file.** Next to any weak state a
reader can see, say in plain words: Ilham reports grades that classical scholars
wrote centuries ago; it does not judge whether a hadith is authentic; a number
is never Ilham's own opinion. The design system knowing this is worth nothing.
The reader must read it.

**Translate the six grades wherever they appear as a label.** Never use the
Arabic alone on an axis or a plot row:

<span dir="rtl">متروك</span> abandoned · <span dir="rtl">ضعيف</span> weak ·
<span dir="rtl">لين</span> soft · <span dir="rtl">مقبول</span> acceptable ·
<span dir="rtl">صدوق</span> truthful · <span dir="rtl">ثقة</span> trustworthy

**Never show a pipeline code to a reader.** The `resolution` letters (A, B, C,
X), the grade tiers (E, T, S, O) and the translation tiers (E, P, 6, 4, M) are
internal. The mark on the spine already carries what a reader needs, and a plain
sentence carries the rest. Keep the codes for the researcher view only.

**Never print a column name.** `due_date`, "progress row" and "obligations" are
schema words. Write "due date", "has not started any reviews" and "reviews
still owed".

**Numerals, on the record.** Machine values use Western digits, because they sit
inside an English apparatus rather than inside Arabic prose. This is a decision,
not a default: the i18n libraries treat Arabic-Indic digits as the set for
Arabic-language text, and web products diverge from that widely.

## Progressive disclosure

Delete nothing. Change what shows first.

**By default** the reader gets: the hadith, the translation, a plain sentence
about the chain, the narrator names, and one plain line for each narrator.

**Behind a control named "Show grading detail"**: the generation numbers, the
raw Arabic verdicts, the numeric weights, the strength plot, and the arithmetic.

Name the control for what it reveals. Do not call it "Advanced" or "Expert",
because that tells the reader who they are instead of what they get.

Remember the choice. A researcher who opens the detail keeps it open on the next
hadith. Store it locally.

**One trap.** `display: none` on a grid child removes it from the grid, and
auto-placement then shifts every later cell one column across. Give the chain
row's three cells an explicit `grid-column`, or hiding one crushes each narrator
name to one word per line.

## The mark vocabulary

The chain draws one mark on the spine for each position. **Five marks exist, all
of them ink, and not one of them is a grade.**

| Mark | Data | Meaning |
|---|---|---|
| Filled disc | `resolution` A or B | A profile matched. The name links to it. |
| Hollow disc, solid border | `resolution` C | The name fits more than one narrator. It does not link. |
| Hollow disc, dashed border | `resolution` X | No profile matched. The raw name stays. It does not link. |
| Hollow square, dashed border | `is_placeholder` | The source records no name. Weight 0.15. |
| Filled square | `is_compiler` | The collector. Always first on the page. Always excluded. Never a failure. |

**A mark reports one thing: whether this link resolved to a person.** How good
that person is comes from the grade words in the rail and the bracketed weight.
This is the whole safety argument — with one accent there is nothing to pair the
blue against, so the system cannot build a good/bad scale even by accident.

### The three grade states, as sentences

This is what replaced the colour ramp. Each one is written out in full, in the
rail, next to the name it belongs to:

| State | Data | What the rail says |
|---|---|---|
| Graded | a rank code resolved | `trustworthy and precise` <span dir="rtl">ثقة ثبت</span> · `[wt 0.88]` |
| Named, not graded | both rank codes NULL | `identified, but no scholar graded him — neutral, not a fault` · `[wt 0.50]` |
| Unnamed | `is_placeholder`, or resolution C or X | `the source records no name here` · `[wt 0.15]` |

Keep the three apart. **Graded** is not **named but ungraded**, and neither one
is **unnamed**. Do not draw one ramp from good to bad. A ramp shows "we do not
know" as "this is bad". The data does not say that.

A reader who never learns what a filled disc means still reads every one of
these, because they are words. That is the point of moving the state out of the
mark: the mark is a fact about the database, and the judgement is prose a
beginner can read.

### Two traps in the chain

Both of these looked correct in the code and were wrong on screen. Keep them.

1. **The mark cell must set `align-self: stretch`.** The row is
   `align-items: start`, so the cell is otherwise only as tall as the mark. The
   spine then breaks into stubs wherever a narrator block is tall, and the chain
   stops looking like a chain.
2. **Put `dir="rtl"` on each Arabic name, not on the list.** The row is a
   left-to-right grid — name in the middle, rail on the right — and the Arabic
   is right-aligned inside its own cell. Direction on the list would flip the
   grid and put the apparatus on the wrong side of the name.

## The strength plot

`corpus.chain_strength` returns a value from 0 to 1, or NULL.

Do **not** draw a linear bar from 0 to 1. The real corpus gives an average of
0.836 over 14,901 hadiths, and only 13 distinct values occur. Most values sit
between 0.90 and 0.95. A linear bar makes almost every hadith look the same.

Draw the discrete plot instead. It lists the weights the function can return,
from high to low, and it puts one dot on each row for each link. The plot shows
two facts that a bar hides:

- An ungraded narrator scores 0.50. That is **above** <span dir="rtl">لين</span>
  at 0.40.
- A placeholder scores 0.15. That is **above** <span dir="rtl">متروك</span> at
  0.10.

An unknown narrator is not an abandoned one.

Show the arithmetic under the plot. Requirement 9 asks each member to defend
each routine. A grader then reads the derivation off the screen.

**The link that sets the score gets a 2px Index underline and the words "sets
the score".** Never a ring, never a colour, and never red. Most of the corpus
has its minimum at <span dir="rtl">ثقة</span>, and marking that row as a problem
would tell the reader that the strongest chain in the collection is full of
them.

When two or more links tie at the minimum, mark nothing. Say that the links tie.
Do not invent a weakest link.

## States the schema produces

Design each one. Each state comes from the DDL, and the seed data contains most
of them on the first run.

**The corpus:**

- A hadith with no chapter. The breadcrumb must survive a missing middle.
- A chapter title that reads only <span dir="rtl">باب</span>. Show the sequence
  number, or the chapters look identical.
- A hadith with no English text. This is 4.7% of the corpus. Show the Arabic.
  Never show an empty English pane.
- A hadith with no chain at all. 49 hadiths. `chain_strength` returns NULL.
- A multi-sanad hadith. It carries **no** transmission words. The loader aligns
  words for single-sanad hadiths only.
- A narrator with no generation. This is 58% of the profiles.
- A narrator whom only one scholar graded. Ibn Hajar covers 41.5%. Al-Dhahabi
  covers 25.7%.
- A verdict that the rank map does not cover. The raw string exists. The code is
  NULL. This does not change the weight, and the rail says so.
- A placeholder narrator. Every field is NULL. The whole profile is one empty
  state.
- `hadith_num` is text. It can read `2564 a`. Never sort it as a number.
- The list endpoints return no total count. Show "showing 21–40". Never show
  "page 3 of 47".

**The study layer:**

- Mastery runs 0 to 4. The schema names no level. The frontend names them. Three
  or more counts as mastered. That is the only threshold in the database.
- A student holds an assigned row and a private row for the same hadith at the
  same time. Each row keeps its own mastery. A new assignment never resets
  private study. The two rows never share one component.
- An assignment carries a due date only. Overdue, due soon, and upcoming are all
  computed. Say so on screen.
- A circle with no students. The seed contains one.
- A student with no progress row. The overview shows 0 of 0. The share column
  must refuse to divide.
- Three teacher states: verified, awaiting verification, and not verified with
  circles that still run. The rule blocks a new circle only.
- `mastered_count` counts distinct hadiths. `review_count` sums over rows. The
  two use different rules. Do not present them as one kind of number.
- The circle overview and the assignment completion answer different questions.
  They disagree about the same student, and both are correct. Name the question
  on each screen.
- The audit trigger records the mastery change only. The actor is best-effort. A
  batch job leaves it unset. Show the gap. Do not guess a name.

## Navigation

The sidebar holds the whole product at 1024px and more. Below that width the
same links become one horizontal strip. Keep the order the same. Never change
the placement by page type.

1. Give each navigation item an icon **and** a label. An icon-only rail hurts
   discovery.
2. Mark the current page with `aria-current="page"`, a 2px Index rule and weight
   600.
3. Move focus to the main region after a route change. A screen reader then
   announces the new page.
4. Navigation is role-aware. A student never sees the verification queue.
5. When a destination is not available, show it and give the reason. Do not hide
   it in silence. An unverified teacher must see why circles are closed.
6. Give the page a skip link to the main content.

## Icons

Use **Phosphor** (`@phosphor-icons/react`), regular weight. Use one stroke
width.

| Token | Size | Use |
|---|---|---|
| `--icon-sm` | 16px | Inline with text. |
| `--icon-md` | 20px | Navigation and buttons. |
| `--icon-lg` | 24px | A page-level mark only. |

1. Never use an emoji as an icon. An emoji changes with the font, and no design
   token reaches it.
2. An icon next to a visible label is decorative. Give it `aria-hidden="true"`.
3. An icon alone in a control gives the control its accessible name.
4. Do **not** draw an icon for a grade, a resolution, or a chain state. The mark
   vocabulary carries those. Use one visual language for each idea.

## Analytics

Each analytics page answers one written question. Make the question the page
title. Write "Where do the two scholars disagree?", not "Contested Narrators".

Every chart carries a sortable table below it. A chart alone does not reach a
screen reader. The table is the source of truth.

| Question | Form | Reason |
|---|---|---|
| Q1 Who carries the corpus? | Horizontal bars, sorted down, capped at 15 | The spread is severe. 178 narrators hold 16.8% of the positions. |
| Q2 Where do the two scholars disagree? | Dumbbell on the 1 to 6 ordinal axis | The **gap** is the ranked quantity. A grouped bar shows two heights and makes the reader subtract. |
| Q3 Which narrators do two hadiths share? | Two chains side by side, shared links marked in both | Do not reorder a chain to make the two line up. The transmission order is the data. |
| Q4 How much has each student mastered? | Table | Counts distinct hadiths. |
| Q5 Which chains are weakest? | List, sorted up, capped at 50 | `chain_strength` is computed, not stored. Sorting by it recomputes for each row. |
| Q6 What does each student still owe? | Table | Counts obligations. |

1. Print every cap. A silent top-N reads as "this is everyone".
2. **No chart may encode a category by colour, because the system has no second
   colour to encode it with.** The dumbbell uses a circle for Ibn Hajar and a
   diamond for al-Dhahabi. A shared link uses a 2px Index rule, because a shared
   link is a position.
3. The three teaching charts follow the same rule as everything else: **size and
   shade both carry the count**, so the sessions strip, the cumulative curve and
   the narrators-by-generation grid all read in greyscale. No chart in this
   product encodes a value by hue, because there is no second hue to encode it
   with.
4. Do not draw a force graph of the narrator network. The corpus holds 20,957
   narrators, and al-Zuhri alone holds 3,453 positions. A network graph is a high
   accessibility risk, it fails on a small screen, and it needs clustering above
   500 nodes. **Make the adjacency table the primary view.** A drawn ego-network
   is an option on top of it, never instead of it.

## Review sessions

One review session writes the session row, a result row for each hadith, and the
progress updates. One explicit transaction holds all of them. Either all of it
lands, or none of it does.

Say this on screen. A teacher who marks twelve hadiths and then loses the
connection must know whether any of it saved. Show one message for the whole
session. Never show a tick for each hadith. A tick implies twelve separate
saves.

## Quality floor

Every component meets these:

- Contrast of 4.5:1 for text on light and 7:1 on dark. 3:1 for a control
  boundary.
- A visible focus ring. 2px Index, offset by 2px, outline only.
- A pointer target of 24px or more. Coarse pointers get 44px.
- No horizontal scroll on the page. Wide content scrolls inside its own box.
- `prefers-reduced-motion` stops all motion.
- Light and dark both work. Define each colour as a token. **Never define a
  colour inside a media query only.**

## QA that no tool performs

Two checks a contrast checker cannot do:

1. Read the dark ground in a dim room, on an OLED panel, at low brightness.
2. Proof fully vowelled Arabic at final size, where stacked marks fail first.
   Verify mark placement in the shipping font — kasra with shadda moves.

To check a page again, use the headless browser. It needs no display:

```
chromium --headless=new --hide-scrollbars --virtual-time-budget=6000 \
  --window-size=1200,1600 --screenshot=out.png file://<path>#/hadith
```

Add `--dump-dom` with a small script that writes to `document.title` to read a
computed value, such as `scrollWidth` against `clientWidth` for overflow.

## Deliberately left out

- **Serif English.** The serif voice is reserved for the Arabic, with no
  exceptions.
- **A second accent colour**, and therefore any colour-coded status at all.
  Grade, weight, resolution, mastery and overdue are all words.
- **Cards and panels.** Only the rail tint and 48px of air group anything.
- **Mid-size type.** Between 21px and 28px the system has nothing.
- **Pure black and pure white**, at either end of the dark ground.
- **Heavier Arabic.** Emphasis is an underline, never a weight.
- **Shadows and glows.** Elevation is the lighter rail surface, nothing else.
- **Auto-switching by time of day.** The student chooses the ground and it
  persists.

## Open items

- Nobody has scaffolded `frontend/`. The tokens live in `specimen.html` until
  then, and `DESIGN.md` is the contract to build against.
- **Four reports the hub advertises are not written.** See the table under
  "Files". Each link currently points at the nearest real section.
- **The pairing test needs the teacher.** Build the chain viewer twice, the
  second on IBM Plex Sans with IBM Plex Sans Arabic, and choose in front of the
  class. The sources favour one drawn family; Apparatus mixes deliberately. That
  trade is not ours to settle.
- The rank labels have no English column in `corpus.rank_levels`. The frontend
  must hold the English glosses for all six codes, because the rail writes the
  grade out in English prose.
- **The transliterations are hand-written.** There is no transliteration column
  in `corpus.narrators`, and `name_en` from MIS covers only part of the corpus.
  Decide whether to add a column, generate them, or show the Arabic alone when
  none exists. Do not let the prototype imply the data is there.
- The Arabic in a table cell right-aligns while its column header stays left.
  Somebody must decide whether to align the header to match.
- The design uses three font families. Measure the load cost when somebody
  scaffolds the frontend. Cut a weight before you cut a family.
