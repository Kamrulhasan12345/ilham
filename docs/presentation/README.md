# Presentation

Marp source for the Ilham database design talk.

| File | What |
|---|---|
| `compact.md` | The 6-slide / ~5:40 deck — **the source of truth** |
| `compact.pdf` | Build output; this is what you present |
| `theme/ilham.css` | Dark theme, colour-matched to the ERD diagrams |
| `plan-compact.md` | The content plan this deck was built from |
| `plan.md` | Content plan for the full 30-slide version (not built) |

## Build

```bash
cd docs/presentation
npm install
npm run build      # -> compact.pdf
```

Other targets:

```bash
npm run html       # -> compact.html (single file)
npm run images     # -> build/slide.00N.png, one per slide (for review)
npm run watch      # live preview + presenter view at localhost:8080
```

**Requires Chromium or Chrome** for PDF/PNG export — Marp drives it headlessly
(`pacman -S chromium`). Marp finds it on `PATH`; if it complains it cannot,
set `CHROME_PATH=/usr/bin/chromium`.

`--allow-local-files` is in every script and is **required** — without it the
diagrams silently fail to embed and you get a deck of empty boxes.

## The diagrams are vector, on purpose

Slides 3–6 embed **SVG**, not PNG, and the PDF keeps them as vector. These
graphs carry a lot of small text; a raster blurs it the moment a projector
scales it, whereas the PDF stays sharp and you can zoom into a chain during
questions without it falling apart.

To confirm a build kept its vectors, pull text out of a diagram page:

```bash
pdftotext -f 5 -l 5 compact.pdf - | head
```

Labels from inside the diagram (`StudySet`, `set_id`, …) should appear. If the
page yields only the slide heading, the diagrams were rasterised.

Sources: `../erd/chen/*-sfdp.svg` (Chen) and `../erd/relational/*.svg`
(crow's foot). Rebuild those with the loops in `../erd/README.md` and
`../erd/relational/README.md`.

The PNGs under `build/` are a **review aid only** — they are raster by
definition. Judge layout there; judge sharpness in the PDF.

## Speaker notes

Every slide carries its notes in an HTML comment, including the target seconds.
`npm run watch` opens presenter view, which shows them alongside a timer.

Total budget is **5:40**. If a rehearsal runs past ~6:30, cut words on slides 2
and 6 — never cut a diagram.

## Before presenting

`compact.md` slide 1 still has placeholders: `[TEAMMATE NAME]`, `[COURSE CODE]`,
`[DATE]`. Fill them in and rebuild.
