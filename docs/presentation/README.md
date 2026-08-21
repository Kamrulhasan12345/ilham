# Presentation

The Marp source for the talk about the Ilham database design.

| File | Contents |
|---|---|
| `compact.md` | The deck of 6 slides, about 5:40 long. **This file is correct** |
| `compact.pdf` | The build output. Present this file |
| `theme/ilham.css` | The dark theme. The colours match the ERD diagrams |
| `plan-compact.md` | The content plan for this deck |
| `plan.md` | The content plan for the full 30-slide version, which nobody built |

## Build

```bash
cd docs/presentation
npm install
npm run build      # -> compact.pdf
```

Other targets:

```bash
npm run html       # -> compact.html (one file)
npm run images     # -> build/slide.00N.png, one for each slide (to review)
npm run watch      # live preview and presenter view at localhost:8080
```

**You need Chromium or Chrome** for the PDF and PNG export. Marp drives it with
no window. Install it with `pacman -S chromium`. Marp finds it on `PATH`. If Marp
reports that it cannot, set `CHROME_PATH=/usr/bin/chromium`.

The flag `--allow-local-files` is in every script, and it is **necessary**.
Without it the diagrams fail to embed with no error, and you get a deck of empty
boxes.

## The diagrams are vector, on purpose

Slides 3 to 6 embed **SVG**, not PNG. The PDF keeps them as vector.

These graphs carry much small text. A raster image blurs it as soon as a
projector scales it. The PDF stays sharp, so you can zoom into a chain during
questions and it holds together.

To confirm that a build kept the vectors, pull the text out of a diagram page:

```bash
pdftotext -f 5 -l 5 compact.pdf - | head
```

Labels from inside the diagram, such as `StudySet` and `set_id`, must appear. If
the page gives only the slide heading, the build rasterised the diagrams.

The sources are `../erd/chen/*-sfdp.svg` for Chen notation and
`../erd/relational/*.svg` for crow's foot. Rebuild them with the loops in
`../erd/README.md` and `../erd/relational/README.md`.

The PNG files under `build/` are a **review aid only**. They are raster by
definition. Judge the layout there. Judge the sharpness in the PDF.

## Speaker notes

Each slide carries its notes in an HTML comment, with the target time in seconds.
The command `npm run watch` opens the presenter view, which shows the notes and a
timer.

The total budget is **5:40**. If a rehearsal runs past about 6:30, cut words on
slides 2 and 6. Never cut a diagram.

## Before you present

Slide 1 of `compact.md` still holds three placeholders: `[TEAMMATE NAME]`,
`[COURSE CODE]`, and `[DATE]`. Fill them in, then build again.
