#!/usr/bin/env bash
# Build standalone HTML pages from the design-system sources.
#
# specimen.html and demo.html are *fragments*. They carry no <!doctype>, no
# <html>, no <head> and no <body>, because the Artifact publisher wraps them in
# its own skeleton and rejects a file that brings its own.
#
# A fragment still renders in a browser, but it renders badly on a phone: with
# no <meta name="viewport"> a mobile browser lays the page out at 980px and then
# zooms out, so none of the responsive CSS ever applies.
#
# This script wraps each source in a real document and writes it to pages/.
# The sources stay canonical. Never edit pages/ by hand.
#
# Usage:  ./docs/design/build-pages.sh
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
out="$here/pages"
mkdir -p "$out"

wrap() {
    src="$1"; dest="$2"

    # <title> and the font <link>s belong in <head>. Everything else is body.
    head_part="$(awk '/^<title>/ || /^<link /' "$src")"
    body_part="$(awk '!(/^<title>/ || /^<link /)' "$src")"

    {
        printf '<!doctype html>\n<html lang="en">\n<head>\n'
        printf '<meta charset="utf-8">\n'
        printf '<meta name="viewport" content="width=device-width, initial-scale=1">\n'
        # dark-first: tells the browser to paint scrollbars and form controls dark
        printf '<meta name="color-scheme" content="dark light">\n'
        printf '%s\n' "$head_part"
        printf '</head>\n<body>\n'
        printf '%s\n' "$body_part"
        printf '</body>\n</html>\n'
    } > "$dest"

    printf '  %-14s -> %s (%s bytes)\n' "$(basename "$src")" "$(basename "$dest")" "$(wc -c < "$dest")"
}

echo "Building standalone pages:"
wrap "$here/specimen.html" "$out/specimen.html"
wrap "$here/demo.html"     "$out/demo.html"

cat > "$out/index.html" <<'HTML'
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark light">
<title>Ilham Design</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&family=IBM+Plex+Mono:wght@400;500;600&family=Newsreader:opsz,wght@6..72,400;6..72,500&family=Scheherazade+New:wght@400;700&display=swap" rel="stylesheet">
<style>
:root{
  --ground:#12150F; --surface:#1A1E15; --rule:#2C3126;
  --text:#E8EBE0; --text-2:#A9AF9F; --text-3:#767C6D; --sound:#4FBF9F;
}
@media (prefers-color-scheme: light){
  :root{--ground:#EDEFE8; --surface:#F6F7F3; --rule:#C6CAC0;
        --text:#171C19; --text-2:#4A5049; --text-3:#7A7F79; --sound:#1F5E52}
}
*{box-sizing:border-box}
body{margin:0;background:var(--ground);color:var(--text);
  font-family:'Atkinson Hyperlegible',system-ui,sans-serif;line-height:1.6;
  -webkit-font-smoothing:antialiased}
.wrap{max-width:56rem;margin-inline:auto;padding:clamp(2rem,6vw,5rem) 1.5rem}
.eyebrow{font-family:'IBM Plex Mono',monospace;font-size:.6875rem;letter-spacing:.16em;
  text-transform:uppercase;color:var(--text-3);margin:0 0 .75rem}
/* Arabic leads this heading, so it cannot take a Latin display line-height.
   At .82 the descenders of إلهام fall into the paragraph below it. */
h1{font-family:'Scheherazade New',serif;font-size:clamp(2.5rem,9vw,6.5rem);font-weight:400;
  line-height:1.25;margin:0 0 1.25rem;display:flex;align-items:baseline;
  flex-wrap:wrap;gap:.1em .3em}
h1 span{font-family:'IBM Plex Mono',monospace;font-size:.3em;font-weight:600;
  color:var(--text-2);letter-spacing:-.02em}
.lede{font-family:Newsreader,Georgia,serif;font-size:1.1875rem;color:var(--text-2);
  max-width:52ch;margin:0 0 3rem}
.list{display:grid;gap:1px;background:var(--rule);border:1px solid var(--rule);
  border-radius:6px;overflow:hidden}
a.card{display:grid;gap:.35rem;padding:1.5rem;background:var(--surface);
  color:inherit;text-decoration:none}
a.card:hover{background:var(--ground)}
a.card:focus-visible{outline:2px solid var(--text);outline-offset:-2px}
.card h2{font-size:1.1875rem;margin:0;font-weight:700}
.card p{margin:0;font-size:.875rem;color:var(--text-2);max-width:60ch}
.card .k{font-family:'IBM Plex Mono',monospace;font-size:.6875rem;
  letter-spacing:.1em;text-transform:uppercase;color:var(--sound)}
footer{margin-top:3rem;padding-top:1.5rem;border-top:1px solid var(--rule);
  font-size:.78125rem;color:var(--text-3)}
footer code{font-family:'IBM Plex Mono',monospace}
</style>
</head>
<body>
<div class="wrap">
  <p class="eyebrow">Ilham · design</p>
  <h1>إلهام<span>Ilham</span></h1>
  <p class="lede">The design system for a hadith study platform, and a working prototype of its screens. Dark by default. No photography anywhere — type, colour and scale carry all of it.</p>

  <div class="list">
    <a class="card" href="specimen.html">
      <span class="k">The system</span>
      <h2>Design system</h2>
      <p>Tokens, the four type families, the isnad ladder, the seven node states, the strength plot, the component library, the app shell and the analytics forms.</p>
    </a>
    <a class="card" href="demo.html">
      <span class="k">The prototype</span>
      <h2>Four screens</h2>
      <p>Hadith detail, narrator profile, circle dashboard and the disagreement analytics. The navigation works.</p>
    </a>
  </div>

  <footer>
    Generated by <code>docs/design/build-pages.sh</code> from <code>specimen.html</code>
    and <code>demo.html</code>. Edit the sources, never these pages.
  </footer>
</div>
</body>
</html>
HTML
printf '  %-14s -> %s\n' "(index)" "index.html"
echo "Done. Open $out/index.html"
