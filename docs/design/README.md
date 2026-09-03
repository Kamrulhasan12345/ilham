# Design system

This folder holds the design system for the Ilham frontend.

This document uses ASD-STE100 Simplified Technical English.

## Files

- `specimen.html` — the live specimen. It shows the critical apparatus, the
  colour and type foundations, and the component library. Open it in a browser.
  The `:root` block at the top of the file is the **source of truth** for the
  tokens. Copy that block to `frontend/src/styles/tokens.css` when somebody
  creates the frontend.
- `demo.html` — a working prototype of four screens: the hadith page, a
  narrator profile, a teacher circle dashboard, and the disagreement analytics.
  It routes on the hash, so the navigation works. Open it to see the system
  assembled rather than in parts.
- `README.md` — this file. It gives the rules. The specimen shows them.

## Motion

Motion is subtle and rare. Use 300 to 400ms, a y-offset of 8 to 16px, and an
ease-out curve. The offset must read as a fade, not as a slide.

Animate one thing on each view. The chain is that thing.

**The chain draws in transmission order.** The Companion arrives first and the
compiler arrives last, one rung every 45ms. This is not decoration. It encodes
the direction of transmission, which is the fact a new reader gets backwards.
Nothing else on the page moves while it runs.

`prefers-reduced-motion: reduce` removes all of it and shows the final state at
once. Test with the setting on.

Do not add a library for this. A CDN script tag does not load inside a published
artifact, and an `IntersectionObserver` does the same work in 20 lines.

## The idea

A hadith page is a scholarly edition of a text. The reader reads the text. The
apparatus argues about the text.

The design keeps the two apart:

- The **matn** and the English translation are content. They get room, a large
  size, and generous leading.
- The **isnad**, the grades, the transmission words, and the chain strength are
  apparatus. They are smaller, denser, and coded.

## Direction

The interface speaks English and runs left to right. All corpus text is Arabic
and runs right to left.

Obey these rules:

1. Put every Arabic string in an element with `dir="rtl"`. Do not let an element
   inherit the direction by accident.
2. Use logical CSS properties. Write `margin-inline-start`, not `margin-left`.
   A full right-to-left interface stays possible later. A rewrite does not.
3. Give Arabic its own size scale and its own leading. Naskh reads smaller than
   Latin at the same pixel size. Use the `--fs-ar-*` tokens and `--lh-ar`. Do
   **not** use the Latin scale for Arabic.
4. The isnad ladder is one complete right-to-left object. The generation gutter
   sits on the right. The chain is Arabic content, so it runs in the Arabic
   direction.

## Colour

The palette has one neutral ramp and three meaning colours.

| Token | Value | Use |
|---|---|---|
| `--bone-100` | `#EDEFE8` | The page ground. |
| `--bone-900` | `#171C19` | Body text. The compiler node. |
| `--bone-700` | `#4A5049` | Secondary text. This is the lightest tone for prose. |
| `--bone-500` | `#7A7F79` | Labels of 14px and more. Icon strokes. Never body text. |
| `--sound` | `#1F5E52` | A recorded strong grade. Also success. |
| `--fault` | `#B33A2B` | The lowest weight. Anʿana. Contested grades. Errors. |
| `--warn` | `#7A5C13` | An unmapped verdict. An unverified teacher. Unaligned data. |

Rules:

1. The three meaning colours carry meaning only. Do not use them to decorate.
2. A primary button is ink, not a hue. A plain action does not spend a meaning
   colour.
3. Red reports a classical verdict. The platform gives no religious judgement.
4. Never use colour alone. Add a shape, an icon, or a word.
5. All pairs meet WCAG AA at 4.5:1 or better. The specimen prints each ratio.

## Type

Four families do four jobs. You can name the job from the text.

| Family | Job |
|---|---|
| Scheherazade New | All Arabic corpus content. |
| Newsreader | English prose. Translations, notes, page text. |
| Atkinson Hyperlegible | Interface chrome. Navigation, labels, buttons, forms. |
| IBM Plex Mono | Database values only. |

**The mono rule.** Text in mono comes out of the database unchanged. This
covers grade codes, weights, chain positions, tabaqa, dates, identifiers, and
`hadith_num`. Do not use mono for labels or for prose. Mono wraps badly and it
degrades when a string gets long.

Atkinson Hyperlegible separates letterforms that look alike. English chrome sits
next to Arabic on every screen. Codes such as `IH` and `DH` must stay clear.

## Write for a person who knows no hadith science

Most users are students who have never seen a rijal grade. The apparatus is for
the researcher. It must not be the first thing anybody meets.

**The rule: no bare number, ever.** A value between 0 and 1 reads as a
probability. A reader who sees `0.95` concludes "95% likely true", and a reader
who sees `0.10` concludes "probably fake". Ilham makes no such claim, and PRD §1
forbids it. Always pair the number with a plain word, and lead with the word.

- Say **"This chain is strong"**, then give `0.95` as a smaller detail.
- Never write "chain strength 0.10" with nothing beside it.

**Put the disclaimer on the screen, not in this file.** Next to any red or weak
state a reader can see, say in plain words: Ilham reports grades that classical
scholars wrote centuries ago; it does not judge whether a hadith is authentic;
a colour or a number is never Ilham's own opinion. The design system knowing
this is worth nothing. The reader must read it.

**Translate the six grades wherever they appear as a label.** Never use the
Arabic alone on an axis or a plot row:

<span dir="rtl">متروك</span> abandoned · <span dir="rtl">ضعيف</span> weak ·
<span dir="rtl">لين</span> soft · <span dir="rtl">مقبول</span> acceptable ·
<span dir="rtl">صدوق</span> truthful · <span dir="rtl">ثقة</span> trustworthy

**Never show a pipeline code to a reader.** The `resolution` letters (A, B, C,
X), the grade tiers (E, T, S, O) and the translation tiers (E, P, 6, 4, M) are
internal. The node shape already carries the meaning, and a plain sentence
carries the rest. Keep the codes for the researcher view only.

**Never print a column name.** `due_date`, "progress row" and "obligations" are
schema words. Write "due date", "has not started any reviews" and "reviews
still owed".

## Progressive disclosure

Delete nothing. Change what shows first.

**By default** the reader gets: the hadith, the translation, a plain sentence
about the chain, the narrator names, and one plain line for each narrator.

**Behind a control named "Show grading detail"**: the generation numbers, the
raw Arabic verdicts, the numeric weights, the strength plot, the arithmetic, and
the distribution chart.

Name the control for what it reveals. Do not call it "Advanced" or "Expert",
because that tells the reader who they are instead of what they get.

Remember the choice. A researcher who opens the detail keeps it open on the next
hadith. Store it locally.

**One trap.** `display: none` on a grid child removes it from the grid, and
auto-placement then shifts every later cell one column across. Give the ladder's
three cells an explicit `grid-column`, or hiding the generation gutter crushes
each narrator name to one word per line.

## The node vocabulary

The isnad ladder draws one node for each position. Seven states exist. Shape and
colour both carry the state.

| Node | Data | Meaning |
|---|---|---|
| Filled disc, teal | `resolution` A or B, graded | The narrator resolved. A scholar graded them well. |
| Filled disc, red | `resolution` A or B, graded | A grade that lowers the weight. |
| Filled disc, red, with a ring | — | This link holds the minimum alone. |
| Filled disc, grey | Both rank codes NULL | The narrator resolved. No scholar graded them. Weight 0.50. |
| Hollow circle, solid border | `resolution` C | The name fits more than one narrator. It does not link. |
| Hollow circle, dashed border | `resolution` X | No profile matched. The raw name stays. It does not link. |
| Hollow square, dashed border | `is_placeholder` | The source records no name. Weight 0.15. |
| Filled square, ink | `is_compiler` | The compiler. Always last. Always excluded. Never a failure. |

Keep the three grade states apart. **Graded** is not **named but ungraded**, and
neither one is **unnamed**. Do not draw one ramp from good to bad. A ramp shows
"we do not know" as "this is bad". The data does not say that.

### Two traps in the ladder

Both of these looked correct in the code and were wrong on screen. Keep them.

1. **The node cell must set `align-self: stretch`.** The rung is
   `align-items: start`, so the cell is otherwise only as tall as the dot. The
   spine then breaks into stubs wherever a narrator block is tall, and the chain
   stops looking like a chain.
2. **Put `dir="rtl"` on the `<ol class="isnad">` itself.** Direction on each name
   is not enough. Without it the name floats to one edge and its grade chips
   start at the other, which splits each narrator from their own evidence.

## The strength plot

`corpus.chain_strength` returns a value from 0 to 1, or NULL.

Do **not** draw a linear bar from 0 to 1. The real corpus gives an average of
0.836 over 14,901 hadiths, and only 13 distinct values occur. Most values sit
between 0.90 and 0.95. A linear bar makes almost every hadith look the same.

Draw the discrete plot instead. It lists the weights the function can return,
from high to low, and it puts one dot on each row for each link. The plot shows
two facts that a bar hides:

- An ungraded narrator scores 0.50. That is **above** لين at 0.40.
- A placeholder scores 0.15. That is **above** متروك at 0.10.

An unknown narrator is not an abandoned one.

Show the arithmetic under the plot. Requirement 9 asks each member to defend
each routine. A grader then reads the derivation off the screen.

**The ring marks the row that sets the score. The colour follows the weight.**
Do not colour a row red because it holds the minimum. Most of the corpus has its
minimum at <span dir="rtl">ثقة</span>, and a red row there tells the reader that
the strongest chain in the collection is full of problems. Red is for a low
weight only.

When two or more links tie at the minimum, ring nothing. Say that the links tie.
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
  NULL. This does not change the weight.
- A placeholder narrator. Every field is NULL. The whole profile is one empty
  state.
- `hadith_num` is text. It can read `2564 a`. Never sort it as a number.
- The list endpoints return no total count. Show "Showing 21–40". Never show
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
- A student with no progress row. The overview shows 0 of 0. The percentage
  column must refuse to divide.
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

Obey these rules:

1. Give each navigation item an icon **and** a label. An icon-only rail hurts
   discovery.
2. Mark the current page with `aria-current="page"`.
3. Move focus to the main region after a route change. A screen reader then
   announces the new page.
4. Navigation is role-aware. A student never sees the verification queue.
5. When a destination is not available, show it and give the reason. Do not hide
   it in silence. An unverified teacher must see why circles are closed.
6. Give the page a skip link to the main content.

## Icons

Use **Phosphor** (`@phosphor-icons/react`), regular weight. Use one stroke width.

| Token | Size | Use |
|---|---|---|
| `--icon-sm` | 16px | Inline with text. |
| `--icon-md` | 20px | Navigation and buttons. |
| `--icon-lg` | 24px | A page-level mark only. |

Rules:

1. Never use an emoji as an icon. An emoji changes with the font, and no design
   token reaches it.
2. An icon next to a visible label is decorative. Give it `aria-hidden="true"`.
3. An icon alone in a control gives the control its accessible name.
4. Do **not** draw an icon for a grade, a resolution, or a chain state. The node
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

Rules:

1. Print every cap. A silent top-N reads as "this is everyone".
2. Never encode a category by colour alone. The dumbbell uses a circle for Ibn
   Hajar and a diamond for al-Dhahabi.
3. Do not draw a force graph of the narrator network. The corpus holds 20,957
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

- Contrast of 4.5:1 for text. 3:1 for a control boundary.
- A visible focus ring. 2px, ink, offset by 2px.
- A pointer target of 24px or more. Coarse pointers get 44px.
- No horizontal scroll on the page. Wide content scrolls inside its own box.
- `prefers-reduced-motion` stops all motion.
- Light and dark both work. Define each colour as a token. Never define a colour
  inside a media query only.

## Open items

- Nobody has scaffolded `frontend/`. The tokens live in `specimen.html` until
  then.
- The rank labels have no English column in `corpus.rank_levels`. The frontend
  must hold the English glosses for all six codes.
- The Arabic in a table cell right-aligns while its column header stays left.
  Both files show this. It reads correctly, but somebody must decide whether to
  align the header to match.
- To check a page again, use the headless browser. It needs no display:

  ```
  chromium --headless=new --hide-scrollbars --virtual-time-budget=6000 \
    --window-size=1200,1600 --screenshot=out.png file://<path>#/hadith
  ```

  Add `--dump-dom` with a small script that writes to `document.title` to read a
  computed value, such as `scrollWidth` against `clientWidth` for overflow.
- The design uses four font families. Measure the load cost when somebody
  scaffolds the frontend. Cut a weight before you cut a family.
