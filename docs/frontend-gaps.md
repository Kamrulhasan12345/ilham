# Ilham — frontend gap ledger

Status of the frontend against `docs/frontend-prd.md` on 2026-09-23. The
backend serves every endpoint this document needs. What is missing is
frontend code, not API capability.

## Complete pages

Login, register, collections, chapters, hadith list, hadith detail (core),
notes, circles (list and create), students, verification queue, shell,
guards, pager, and the domain logic (grading, chain grouping, strength
plot). The suite holds 126 tests, all green.

## Incomplete pages

- Hadith detail (§7.7): no metadata rail. No generation filter. No
  multi-chain control and no strongest-chain mark (the component accepts
  the prop, but the page never passes it). No add-to-set, write-note, or
  open-narrator actions. New link fields (kunya, raw verdicts, tiers) are
  served but not rendered. Grading detail shows the plot only.
- Hadith list (§7.6): no strength bar and no "no chain" state per row.
- Collections (§7.4): `hadith_count` is served but not rendered.
- Verification queue (§7.23): no decline control. The backend serves
  `DELETE /teachers/:id/verify` since 2026-09-23.
- Circles (§7.17): cards link nowhere until the overview page exists.
- Notes (§7.22): no edit control. The PRD does not ask for one.

## Missing pages

Search, narrator list, narrator profile, analytics index with Q1, Q2, Q3,
and Q5, study sets with set detail, circle overview, assign flow,
assignment completion, review runner, and account (`/me` has a route and
a PRD section since 2026-09-23, but no page).

## Missing components

Primitives: Input, Field, Chip, Tag, Table, Dialog, Toast, Slider. Domain:
Rail, VerdictBand, GenerationFilter. The `/students` page exists with no
PRD section that specifies it.

## Closed backend gaps

These blocked pages and are now served and tested: narrator adjacency,
teacher decline, stats mount, analytics captions, mastered at 3 or more,
collection counts, per-row strength, enriched detail links, grouped chains
with per-sanad strength, trigram search, and the seed admin. See
`docs/backend-prd.md` for the marked rows.
