# Google Stitch prompts — the whole frontend

Use these with Google Stitch (Google Labs). Stitch 2.0 generates more than one
screen, and it reads a `DESIGN.md`. Load §1 one time, then run the screen
prompts in §3.

Read §4 before you start. Stitch does some of this well and some of it badly,
and §4 says which is which.

**Mode.** Use **Experimental** (Gemini 2.5 Pro) for the corpus screens, because
they carry Arabic and dense data. Use **Standard** (Gemini 2.5 Flash) for the
forms and the lists.

**Credits.** The free tier gives about 400 design credits and **15 redesign
credits** each day. Redesigns are the scarce one. Load the design system first,
so you do not spend redesigns fixing the palette.

---

## 1. Paste this as `DESIGN.md` first

```markdown
# Ilham — design system

A hadith study platform. A read-only Arabic corpus and a teacher-led study
layer. The interface is English and runs left to right. All corpus content is
Arabic and runs right to left inside the page.

## Ground
Dark first. Light is an alternate, not the default.

## Colour
| Token | Dark | Light | Meaning |
|---|---|---|---|
| ground | #12150F | #EDEFE8 | page background |
| surface | #1A1E15 | #F6F7F3 | cards, raised panels |
| rule | #2C3126 | #C6CAC0 | hairlines, dividers |
| text | #E8EBE0 | #171C19 | body text |
| text-2 | #A9AF9F | #4A5049 | secondary text |
| text-3 | #767C6D | #7A7F79 | labels only, never body text |
| sound | #4FBF9F | #1F5E52 | a strong classical grade, success |
| fault | #F2795E | #B33A2B | the weakest link, errors |
| warn | #E0B24B | #7A5C13 | unverified, unmapped, missing data |
| bukhari | #5B92F5 | #2A5BC4 | the collection Sahih al-Bukhari |
| muslim | #9B7BF0 | #5B3FB8 | the collection Sahih Muslim |

Only three colours carry meaning: sound, fault, warn. The two collection
colours name a book and carry no judgement. Never colour anything else.

## Type — four families, four jobs
- Scheherazade New — all Arabic content
- Newsreader — English prose and page titles
- Atkinson Hyperlegible — interface chrome, buttons, labels, forms
- IBM Plex Mono — values that come from the database only: numbers, codes,
  identifiers, dates

Scale runs 11px to 176px. Give each page ONE moment of large type and keep
everything else quiet.
Latin: 11 / 12.5 / 14 / 16 / 19 / 24 / 34 / 48 / 72 / up to 176.
Arabic: 17 / 20 / 30 / 44. Arabic needs its own larger sizes and line-height
1.95, because Naskh reads smaller than Latin at the same pixel size.

## Shape
Radius 2 to 6px. Never pill-shaped except a status dot. Borders are 1px
hairlines. Prefer a rule over a shadow. No gradients anywhere.

## Rules that must not break
1. Arabic sits in right-to-left blocks. English chrome stays left to right.
2. A number between 0 and 1 never appears alone. Lead with a plain word.
3. Mono means the value came from the database unchanged.
4. Never use colour alone. Add a shape, an icon, or a word.
5. Icons: Phosphor, regular weight, with a text label.
6. Dense, but not cramped. This is a reference tool, not a landing page.
```

---

## 2. The master prompt

Run this one time, before the screens.

```
Design a web application called Ilham. It is a hadith study platform for
university students and their teacher. It has two halves: a large read-only
Arabic corpus that people read, and a small study layer where a teacher runs a
class.

Follow DESIGN.md exactly. Dark ground. Four typefaces with one job each.

Important: this product contains no photography and never will. All visual
interest must come from typography, scale and structure. Do not add hero
images, stock photography, illustrations or gradients. Give each page one
moment of very large type and keep the rest quiet.

The audience mostly has no training in hadith science. Default screens must
read in plain English. Scholarly detail hides behind a control labelled
"Show grading detail".

Desktop layout: a fixed left sidebar 216px wide holding the navigation, and a
top bar with the product name, a search control and the signed-in user.
Content sits in a column up to 1024px wide. Below 1024px the sidebar becomes
one horizontal scrolling strip of the same links in the same order.
```

---

## 3. Screen prompts

Run these one at a time. Each assumes the master prompt and `DESIGN.md`.

### Identity

**1. Sign in** — Centred card, maximum 384px wide. Email and password fields
with visible labels above them, not placeholders. A show/hide control on the
password. One primary button, "Sign in". A link to register. Show one error
message above the form.

**2. Register** — Same card. Full name, email, password. Then a choice of two
large selectable cards: "Student" and "Teacher". The teacher card says an admin
verifies the account before the first circle opens.

**3. Waiting for verification** — Not a page. A banner in warn colour across
the top of the content area: "Your teaching account is waiting for review. You
can build study sets, write notes and review students. You cannot open a circle
yet."

### The corpus

**4. Collections** — Two large cards, one for each collection. Each card
carries a coloured square in the collection colour, the Arabic title very large
in Scheherazade New, the English title below it in Newsreader, and a hadith
count in mono.

**5. Chapters** — A list of chapters in one collection. Each row shows a
sequence number in mono on the left and an Arabic chapter title. Many chapters
carry the same short Arabic title, so the sequence number must always be
visible. Paginate with "Previous", "Showing 21–40", "Next". Never show a page
count.

**6. Hadith list** — Rows. Each row: a hadith number in mono on the left, a
single line of Arabic text truncated with an ellipsis in the middle, and a
short horizontal strength bar with a decimal figure on the right. One row shows
"no chain" instead of a bar.

**7. Hadith detail — the main screen.** At the top, the hadith number set
enormous, up to 176px, in mono, beside a small uppercase collection label and
the Arabic chapter title. Below that a two-column panel: a narrow left rail of
metadata as small uppercase labels with mono values, and a wide right column.
The right column holds the Arabic hadith text at 30px with line-height 1.95,
right aligned; then a rule; then the English translation in Newsreader at 19px;
then a small mono source line. Below that a panel with a left border in sound
colour containing "This chain is strong" and two short plain-English
paragraphs. Then a vertical list of narrators. Then a wide button, "Show
grading detail".

**8. Chain of narrators** — A vertical ladder that reads right to left. On the
right edge a thin vertical line with a circular node for each narrator. Beside
each node an Arabic name at 20px and one line of small English text under it.
Between nodes, a short Arabic word on the line with a small uppercase English
label. The last node is a filled square, not a circle.

**9. Search results** — A search field with Arabic text, right aligned. Below
it a note that the search ignores diacritics. Then result rows: a small mono
line with the collection, chapter and score, then two lines of Arabic with one
phrase highlighted in a warn-coloured background.

**10. No search results** — A dashed-border panel. A heading, one sentence
explaining that search reads hadith text only, and one secondary button
offering to search narrators instead.

**11. Narrator list** — Rows with an Arabic name, an English transliteration in
smaller grey text, a generation label, and a count of appearances in mono on
the right. A search field at the top.

**12. Narrator profile** — A large Arabic name at 44px. Two cards side by side:
"Profile" as a definition list of label and value pairs, and "Rijal grades"
holding two bordered chips, each with a scholar's name in mono and an Arabic
verdict. Below, a table of the narrators this person learned from and taught.

**13. Placeholder narrator** — The same page but empty. A dashed panel with an
Arabic bracketed name and a paragraph explaining that the source records no
name, and that the absence is itself the finding.

### Analytics

**14. Analytics index** — Four cards. Each card title is a question, such as
"Where do the two scholars disagree?", not a noun.

**15. Top narrators** — Horizontal bars sorted longest first. Arabic name on
the left, bar in the middle, a count in mono on the right. A small grey caption
naming how many rows are shown out of the total.

**16. Contested narrators** — A dumbbell chart. Each row: an Arabic name, then
a horizontal track with a hollow circle and a hollow diamond joined by a thick
line. A long line uses fault colour. On the right, a gap number in mono. Under
the chart, six Arabic grade words spread evenly as an axis, each with a small
English translation. Below, the same data as a table.

**17. Weakest chains** — A list sorted lowest score first, each row with a
short bar in fault colour.

### The study layer

**18. Study sets** — A grid of cards. Each card: a set name, a count of
hadiths in mono, and a secondary button.

**19. Study set detail** — A list of the hadiths in the set, each removable. An
empty state with a dashed border and one primary button.

**20. Circles** — A grid of circle cards, each with a name, a student count,
and a status chip. One card shows a disabled "Create circle" control with a
sentence explaining that an admin must verify the account first.

**21. Circle overview** — Two large statistics at the top, each with a small
uppercase label and a large mono number, and a caption under each explaining
how it is counted. Below, a table of students with columns for mastered,
assigned, share and last review. One row reads "0" and "not started" in grey.

**22. Assign a study set** — A form with a set selector and a date field. Below
it a bordered panel stating the consequence in plain words: "This creates 400
requirements: 16 students by 25 hadiths."

**23. Assignment completion** — A table of students with done and owed counts.
A heading that is a question: "What does each student still owe?"

**24. Review runner** — A progress line reading "Hadith 5 of 12" with a thin
bar. Below it a large Arabic hadith. Below that three wide selectable buttons
side by side: "Passed", "Partial", "Not yet", each with a short description
under the label. The selected one takes a coloured border. At the bottom a
panel stating that nothing is saved until the session finishes.

**25. Notes** — Notes grouped by hadith. Each note is a card with an Arabic
excerpt at the top and English note text below.

**26. Verification queue** — Rows with a teacher name, institution and applied
date, and two buttons on the right: a secondary "Decline" and a primary
"Verify".

### System

**27. Not found** — A very large 404 in mono, a short sentence, and one button
back to the collections.

**28. Error state** — A panel with a left border in fault colour, a heading
naming what failed, and one button to try again.

---

## 4. What Stitch does badly here

Do not expect Stitch to produce these correctly. Build them by hand from
`docs/design/specimen.html`.

| Thing | Why Stitch struggles |
|---|---|
| The isnad ladder | A right-to-left grid with a continuous spine, seven node shapes, and words on the connectors. It needs exact `grid-column` placement and `align-self: stretch`, or the spine breaks. |
| The discrete strength plot | A dot matrix over eight exact weights, where two rows sit in the middle of the scale. A generator draws a bar chart instead, and a bar chart is wrong here. |
| The dumbbell axis | The labels must lock to the track at every width. |
| Arabic and English on one line | Bidirectional text puts punctuation at the wrong end. Check every mixed line. |
| The distribution strip | It is a canvas drawing, not a component. |

**Use Stitch for the conventional screens** — sign in, register, lists, tables,
cards, forms, empty states, the admin queue. That is most of the 28. **Keep the
apparatus by hand.** It carries the marks, and it is already built.

## 5. After Stitch

Stitch exports code. Do not paste it in as it is.

1. Replace every literal colour with a token from §1. A literal outside the
   token layer fails the build. See `docs/frontend-prd.md` §4.2.
2. Check every Arabic block has `dir="rtl"`.
3. Check the four font families survived.
4. Check the contrast in both themes.
