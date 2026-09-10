# DESIGN.md — Apparatus

The build contract for the Ilham frontend. It states **what the values are**.
`README.md` states **why**, and `specimen.html` shows it rendering.

This document uses ASD-STE100 Simplified Technical English.

- **System:** Apparatus — one system, two grounds.
- **Grounds:** `1c` light is the default. `2a` dark is a choice the reader makes
  and the app remembers. Never auto-switch by time of day.
- **Thesis:** the Arabic is the object on the table, set at 44px. The English
  interface shrinks to a quiet apparatus around it.
- **Source of truth:** the `:root` block in `docs/design/specimen.html`. Copy it
  to `frontend/src/styles/tokens.css`. If this file and that block disagree, the
  block wins and this file is stale.

---

## 1 · Tokens

### Colour — seven roles

Light is bare `:root`. Dark is declared **twice**: under
`@media (prefers-color-scheme: dark)` guarded with `:root:not([data-theme="light"])`,
and again under `:root[data-theme="dark"]`, so the reader's toggle wins in both
directions. **Never define a colour inside a media query only.**

| Token | Light | Dark | Use |
|---|---|---|---|
| `--ground` | `#FCFCFA` | `#16181A` | The page. Charcoal on dark, never `#000`. |
| `--rail` | `#F1F0EC` | `#1E2124` | The rail and all chrome. On dark this is the only elevation cue. |
| `--rule` | `#D8D7D1` | `#2E3236` | Hairlines and cell edges. Structure, never text. |
| `--edge` | `#8B8B85` | `#656B72` | Control boundaries that must clear 3:1 — chips, tabs, chart axes. |
| `--ink` | `#111211` | `#E4E2DC` | Arabic and headings. 17.6:1 / 12.9:1. |
| `--ink-app` | `#5C5F5C` | `#B4B8B3` | Every English label and rail word. 5.9:1 / 9.2:1. |
| `--index` | `#2437C4` | `#93A8F5` | The only accent. Links, focus, anchor, position. |
| `--machine` | `#3B3E42` | `#A9AEB4` | Database values. Always quieter than the ink. |

**There is no ninth colour.** No green, no gold, no red — anywhere, for any
state.

### Type — three families

```css
--font-ar:   'Scheherazade New', 'Amiri', serif;
--font-en:   'Instrument Sans', system-ui, -apple-system, sans-serif;
--font-mono: 'DM Mono', ui-monospace, 'SFMono-Regular', monospace;
```

| Family | Job | Weights |
|---|---|---|
| Scheherazade New | All Arabic corpus content | 400 only |
| Instrument Sans | English reading, 16–21px | 400 |
| Instrument Sans | Interface chrome, 13px sentence case, `+0.005em` | 600 |
| DM Mono | Database values only, always bracketed | 400 |

### Latin scale — ratio 4.0:1 (13 → 52)

| Token | Size / leading | Use |
|---|---|---|
| `--fs-count` | 72 / 0.95 | Corpus counts only. Nowhere else. |
| `--fs-title` | 52 / 1.0 | Screen title |
| `--fs-name` | 38 / 1.1 | Narrator name |
| `--fs-sect` | 28 / 1.25 | Section heading |
| `--fs-lead` | 21 / 1.45 | Lead and pull translation |
| `--fs-body` | 16 / 1.55 | Translation body, table cells. **17px on dark.** |
| `--fs-rail` | 15 / 1.55 | Rail body, glosses, grade words |
| `--fs-label` | 13 / 1.4 | Every label in the product |

Between 21px and 28px the system has nothing. 13px is the floor and it sets
labels only.

### Arabic scale — its own ladder

| Token | Size / leading | Use |
|---|---|---|
| `--fs-ar-chapter` | 64 / 1.75 | Chapter title |
| `--fs-ar-matn` | 44 / 1.9 | The hadith. **1.95 on dark.** |
| `--fs-ar-name` | 28 / 1.9 | Narrator name, page heading |
| `--fs-ar-chain` | 22 / 1.25 | Narrator name inside a chain |
| `--fs-ar-grade` | 22 / 2.1 | A raw Arabic verdict |

**Arabic never inherits a Latin size.** Body Arabic at 44px sits against body
English at 16px — a 2.75× ratio between the scripts.

### Space, structure, motion

```css
--sp-1: 6px;  --sp-2: 12px;  --sp-3: 24px;  --sp-4: 48px;  --sp-5: 96px;
--rail-w: 210px;      /* never changes */
--chain-row: 63px;    /* measures 65px in practice */
--bw: 1px;            --r-chip: 999px;
--focus-w: 2px;       --focus-off: 2px;
--dur-micro: 120ms;   /* hover, press, fill, a row leaving a filter */
--dur-move:  180ms;   /* route change, disclosures */
--dur-enter: 240ms;   /* first arrival — the ceiling */
--ease-out:  cubic-bezier(.2, .7, .3, 1);
```

Radius is **0** everywhere except interactive chips and filters, which are fully
round. Roundness means one thing: you can click it.

Borders sit on **one or two edges, never four**. There are no cards, no panels
and no shadows. Grouping is the rail tint and 48px of air.

---

## 2 · Hard rules

Each of these is a build requirement, not a preference.

1. **Bidi isolation.** Every Arabic string carries an explicit `dir`.
   Database-sourced strings use `dir="auto"` or `<bdi>`. Use the HTML attribute,
   not the CSS property.
2. **No tracking on Arabic**, at any size. `letter-spacing: 0`, always.
3. **No italic and no synthetic bold on Arabic.** Only Regular has a drawn Bold.
   Emphasis on Arabic is a 2px `--index` underline.
4. **Arabic is right-aligned and ragged.** Never justified.
5. **Western digits for machine values**, because they sit inside an English
   apparatus.
6. **Contrast floors.** Light: 4.5:1 body, 3:1 UI and large text. Dark: 7:1
   body.
7. **Focus is an outline**, 2px `--index` at 2px offset, on `:focus-visible`,
   with a `forced-colors` fallback. Never a `box-shadow`.
8. **Colour is fenced.** One accent, meaning position only. Grade and weight are
   never coloured. If the screen works in greyscale, it works.
9. **Motion may offset content. It may never hide it.** Animate the offset, never
   the opacity. Nothing travels more than 8px. Never animate a grade, a weight,
   a generation, or a chain position.
10. **Use logical properties.** `margin-inline-start`, not `margin-left`.
11. **No horizontal page scroll.** Wide content scrolls inside its own
    `overflow-x: auto` box.
12. **Targets** are 24px minimum, 44px on a coarse pointer.

---

## 3 · Layout

### The fixed rail — the signature element

A **210px** rail runs down every screen at the same x position, with a **48px**
gutter to the content. It never changes width and never wraps around the Arabic.

```
┌──────────────┬─────────────────────────────────────┐
│ rail  210px  │  content                            │
│ labels,      │  the Arabic, the translation,       │
│ identifiers, │  the chain, the tables              │
│ grades,      │                                     │
│ glosses      │                                     │
└──────────────┴─────────────────────────────────────┘
      └─ 48px gutter, always
```

Below **62rem** the rail becomes a strip above the content, keeping its content
and its order.

### App shell

A sticky top bar, a 15rem sidebar, then the rail layout inside the main region.
Below 62rem the sidebar becomes one horizontal scrolling strip with the same
links in the same order. The placement never changes by page type.

---

## 4 · Components

### The chain

Two grid columns: a **24px** mark cell and the body. The mark cell must set
`align-self: stretch` or the spine breaks into stubs. Give both cells an
explicit `grid-column`, or hiding one shifts every later cell across.

Each row holds, in order:

1. The Arabic name at 22px, right-aligned.
2. A transliteration under it, in English. A reading aid, never a replacement.
3. **Both scholars' verdicts on one line**, in plain English, joined by ` / `.
   Clip what does not fit and print it in full behind "Show grading detail".
4. The machine values: `[gen NN]`, `[wt N.NN]`, and the transmission word, with
   its meaning glossed in quotation marks — `[ḥaddathanā] "he narrated to us"`.

A row measures **65px**, so ten narrators fit in about 650px.

Order on the page: **the collector first, the Companion last.**

### The five marks

Ink only, shape only. A mark says whether the link resolved to a person — never
how good that person is.

| Mark | Data | Meaning |
|---|---|---|
| Filled disc | `resolution` A or B | A profile matched. The name links. |
| Hollow disc | `resolution` C | The name fits more than one narrator. No link. |
| Dashed hollow disc | `resolution` X | No profile matched. Raw name stays. No link. |
| Dashed hollow square | `is_placeholder` | The source records no name. |
| Filled square | `is_compiler` | The collector. First on the page, always excluded. |

### The three grade states, as sentences

Never a ramp, never a colour. Each is prose in the rail plus a bracketed weight.

| State | Data | What the rail says |
|---|---|---|
| Graded | a rank code resolved | `trustworthy and precise` · `[wt 0.88]` |
| Named, not graded | both rank codes NULL | `identified, but no scholar graded him — neutral, not a fault` · `[wt 0.50]` |
| Unnamed | placeholder, or resolution C / X | `the source records no name here` · `[wt 0.15]` |

### The strength plot

A **discrete** plot, never a bar from 0 to 1. Rows are the weights the function
can return, high to low, one dot per link. The corpus averages 0.836 and only 13
distinct values occur, so a linear bar makes almost every hadith look the same.

The link that sets the score gets a 2px `--index` underline and the words "sets
the score". On a tie, **mark nothing** and say the links tie.

An ungraded narrator scores 0.50 — above `لين` at 0.40. A placeholder scores
0.15 — above `متروك` at 0.10.

### The generation filter

A slider that hides the later end of the chain by generation. It must:

- say that 1 is the Companions and 10 is the collectors' own teachers;
- say that filtering is the reader's act and scores nothing;
- print the readout as text — "Showing 6 of 6 narrators — generations 1 to 10";
- offer ± step buttons, so it works without a drag;
- remove a filtered row at `--dur-micro`.

### Controls

| Component | Shape |
|---|---|
| Button | Square, 44px tall, 1px `--ink` border. Primary is `--ink` fill, not a hue. |
| Destructive button | Square, **2px** border, and an exact verb. No red. |
| Chip / filter | Fully round, 28px, `--edge` border. Never carries status. |
| Tag | Square, 2px inline-start rule. A stated fact, never pressable. |
| Input | Square, 44px, `--ink-app` border. Invalid doubles the border and states "Error". |

### Tables and charts

Every chart carries a sortable table below it. **The table is the source of
truth**; the chart is the summary. Print every cap — a silent top-N reads as
"this is everyone".

No chart encodes a value by hue, because there is no second hue. Shape separates
categories: a circle for Ibn Ḥajar, a diamond for al-Dhahabī. Where a chart
shows magnitude, **size and shade both carry it**, so it reads in greyscale.

---

## 5 · Copy rules

- **No bare number, ever.** Lead with the plain word: "This chain is strong",
  then `[wt 0.95]` as a smaller detail.
- **Put the disclaimer on screen.** Next to any weak state: Ilham reports grades
  that classical scholars wrote centuries ago, it does not judge whether a hadith
  is authentic, and a number is never Ilham's own opinion.
- **Translate the six grades** wherever they appear as a label. Never the Arabic
  alone on an axis.
- **Never show a pipeline code** to a reader — resolution letters, grade tiers,
  translation tiers are internal.
- **Never print a column name.** Write "due date", not `due_date`.
- **Name a disclosure for what it reveals** — "Show grading detail", never
  "Advanced".

---

## 6 · States the data produces

Build every one of these. Most appear on the first run of the seed data.

**Corpus:** a hadith with no chapter · a chapter titled only `باب` · no English
text (4.7%) · no chain at all (49 hadiths) · a multi-sanad hadith, which carries
no transmission words · a narrator with no generation (58%) · a narrator only one
scholar graded · a verdict the rank map does not cover · a placeholder narrator
whose whole profile is empty · `hadith_num` as text, which can read `2564 a` and
never sorts as a number · list endpoints with no total count, so "showing 21–40"
and never "page 3 of 47".

**Study layer:** mastery 0–4 with 3 as the only threshold · an assigned row and a
private row for the same hadith, each with its own mastery, never sharing a
component · a due date only, with overdue computed · a circle with no students ·
a student with no progress row, so the share column refuses to divide ·
three teacher states, where losing verification blocks only a new circle ·
`mastered_count` counting distinct hadiths while `review_count` sums rows ·
the circle overview and assignment completion disagreeing, both correctly ·
an audit row with no actor.

---

## 7 · Do not build

- Serif English, anywhere.
- A second accent colour, or any colour-coded status.
- Cards, panels, shadows, glows.
- Type between 21px and 28px.
- Pure black or pure white.
- Heavier or slanted Arabic.
- A recursive chain walk. Isnad positions are explicit rows, so a walk is
  aggregation.
- A force-directed narrator graph as a primary view. The adjacency table is
  primary.
- Any runtime write into the `corpus` schema.
