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
        # light-first: 1c is the default ground, and dark is the alternate
        printf '<meta name="color-scheme" content="light dark">\n'
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

# The hub is hand-written, not generated: it is a full document already, and
# it carries content (the corpus figures, the ground memory) that no heredoc
# should own. Copying it here means pages/ holds all three files side by side,
# so the hub's relative links resolve to the built pages rather than to the
# fragments.
cp "$here/index.html" "$out/index.html"
# The hub links to the direction report, so pages/ needs its own copy or that
# link dies once the folder is published on its own.
cp "$here/Ilham Directions.dc.html" "$out/Ilham Directions.dc.html"
printf '  %-14s -> %s (%s bytes)\n' "index.html" "index.html" "$(wc -c < "$out/index.html")"
printf '  %-14s -> %s\n' "Directions" "Ilham Directions.dc.html"
echo "Done. Open $out/index.html"
