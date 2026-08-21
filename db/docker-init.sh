#!/bin/sh
# Runs ONCE, on first container start, from /docker-entrypoint-initdb.d/.
# The postgres image executes everything in that directory in alphabetical
# order, which is why db/*.sql is NOT mounted there directly: that would run
# 05_post_load.sql — which seals the corpus and drops the staging schema —
# before the ETL has loaded anything.
#
# The order below is the same one run_ddl.sh uses. 05_post_load.sql is
# deliberately absent and stays a manual, once-only step.
set -e

FILES="00_init 01_corpus 02_app 03_staging 04_seed_reference"
[ "${ILHAM_SMOKE_TEST:-1}" = "1" ] && FILES="$FILES 98_smoke_test"

for f in $FILES; do
  echo "-- $f"
  psql -q -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f "/db/$f.sql"
done

echo "-- ilham schema ready ($POSTGRES_DB)"
