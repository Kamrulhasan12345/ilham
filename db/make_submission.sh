#!/usr/bin/env bash
# Build the course submission bundle: the finalized ERD as a PDF, the schema as
# a text file, and both together in one ZIP.
#
#   ./db/make_submission.sh
#
# Everything here is GENERATED from files that are already in the repository.
# The script changes nothing under db/, docs/, or etl/. Run it again after any
# schema change and the bundle follows.
#
# The delivered database has two schemas, corpus and app. 05_post_load.sql drops
# staging when it seals the corpus, so staging appears in neither artifact. That
# is why docs/erd/relational/schema.dot is NOT the source here: it draws a
# cluster_staging with five tables that the submitted database does not have.
#
# CHANGE THE FILE NAMES HERE. The repository carries no student ID or group
# number. If the course wants one in the file name, set PREFIX and run again,
# for example PREFIX="Ilham_Group7".
PREFIX="${PREFIX:-Ilham}"

set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$DIR/.." && pwd)"
OUT="$ROOT/submission"
ERD_DIR="$ROOT/docs/erd/relational"

PDF="$OUT/${PREFIX}_ERD.pdf"
TXT="$OUT/${PREFIX}_schema.txt"
ZIP="$OUT/${PREFIX}_Submission.zip"

# graphviz 15.1.0 renders the diagrams that are committed under docs/erd/. The
# host may have a different version, and a force-directed or table layout moves
# between versions. Pinning here keeps the submitted PDF identical to the images
# in the repository. The package comes from the Arch archive, so the pin holds
# even after the host upgrades.
GRAPHVIZ_VER="15.1.0-1"
RENDER_IMAGE="docker.io/library/archlinux:latest"
ENGINE="${ILHAM_ENGINE:-}"
if [[ -z "$ENGINE" ]]; then
  if command -v podman >/dev/null 2>&1; then ENGINE=podman
  elif command -v docker >/dev/null 2>&1; then ENGINE=docker
  else echo "-- need podman or docker to render the PDF at the pinned graphviz version" >&2; exit 1; fi
fi

command -v pdfunite >/dev/null 2>&1 || {
  echo "-- need pdfunite (poppler) to join the two ERD pages" >&2; exit 1; }
command -v zip >/dev/null 2>&1 || { echo "-- need zip" >&2; exit 1; }

rm -rf "$OUT"
mkdir -p "$OUT"

# =============================================================================
# 1. The ERD, as a two-page PDF
#
# corpus first, then app: the read-only foundation, then the layer built on it.
# app.dot already draws corpus.hadiths as an external box, so the four
# app -> corpus crossings are visible without a third page.
#
# The pages keep their natural size. These are wide table diagrams, and a fit to
# A4 makes the column text unreadable. pdfunite joins mixed page sizes.
# =============================================================================
echo "-- ERD: rendering corpus and app with graphviz $GRAPHVIZ_VER"
"$ENGINE" run --rm \
  -v "$ERD_DIR:/erd:z" -v "$OUT:/out:z" \
  "$RENDER_IMAGE" sh -c "
    set -e
    pacman -Sy --noconfirm --needed curl ttf-dejavu >/dev/null 2>&1
    curl -sO https://archive.archlinux.org/packages/g/graphviz/graphviz-${GRAPHVIZ_VER}-x86_64.pkg.tar.zst
    pacman -U --noconfirm ./graphviz-${GRAPHVIZ_VER}-x86_64.pkg.tar.zst >/dev/null 2>&1
    dot -V
    dot -Tpdf /erd/corpus.dot -o /out/.page1_corpus.pdf
    dot -Tpdf /erd/app.dot    -o /out/.page2_app.pdf
  "

pdfunite "$OUT/.page1_corpus.pdf" "$OUT/.page2_app.pdf" "$PDF"
rm -f "$OUT/.page1_corpus.pdf" "$OUT/.page2_app.pdf"

# =============================================================================
# 2. The schema, as a text file
#
# Three hand-written DDL files, unchanged apart from the two staging lines in
# 00_init.sql. The comments in them carry the reason for each design decision,
# which is the point of submitting them. A pg_dump is three times longer and
# keeps four of them.
#
# 00_init.sql is included and not replaced by a bare CREATE SCHEMA preamble. It
# defines corpus.normalize_arabic, which 01_corpus.sql needs at load time for
# the GENERATED ... STORED column narrators.name_norm. Without it the file does
# not run. It is also a graded routine, so its comments belong in the submission.
#
# Two lines are filtered: the DROP and the CREATE for the staging schema. Every
# other line of the three files is verbatim.
# =============================================================================
echo "-- schema: 00_init.sql (staging lines removed) + 01_corpus.sql + 02_app.sql"
COMMIT="$(git -C "$ROOT" rev-parse --short HEAD 2>/dev/null || echo 'not a git checkout')"

{
  cat <<EOF
-- =============================================================================
-- ILHAM -- database schema
--
-- A hadith study platform. One PostgreSQL instance holds two schemas:
--
--   corpus   read-only reference data: hadiths, chains, narrators, grades
--   app      users and study data: circles, sets, assignments, progress, reviews
--
-- A third schema, staging, exists only while the ETL runs. 05_post_load.sql
-- drops it and REVOKEs every write on corpus from the application role, so the
-- corpus is read-only by permission and not by convention. That sealing step is
-- outside this file, which defines the two schemas that the database keeps.
--
-- Run this file on an empty UTF8 database. It is self-contained and it builds
-- both schemas. The comments give the reason for each decision.
--
-- Source: db/00_init.sql, db/01_corpus.sql and db/02_app.sql at commit $COMMIT
-- =============================================================================

EOF
  echo "-- ============================================================================="
  echo "-- db/00_init.sql   (the two staging lines removed)"
  echo "-- ============================================================================="
  sed -e '/^DROP SCHEMA IF EXISTS staging CASCADE;$/d' \
      -e '/^CREATE SCHEMA staging;/d' "$DIR/00_init.sql"
  echo
  echo "-- ============================================================================="
  echo "-- db/01_corpus.sql"
  echo "-- ============================================================================="
  cat "$DIR/01_corpus.sql"
  echo
  echo "-- ============================================================================="
  echo "-- db/02_app.sql"
  echo "-- ============================================================================="
  cat "$DIR/02_app.sql"
} > "$TXT"

# =============================================================================
# 3. The ZIP
#
# -j stores the files flat. A submission portal that reads one entry deep must
# not find a directory in the way.
# =============================================================================
echo "-- zip"
( cd "$OUT" && zip -q -j "$(basename "$ZIP")" "$(basename "$PDF")" "$(basename "$TXT")" )

echo
echo "-- done"
echo "   $PDF"
echo "   $TXT"
echo "   $ZIP"
