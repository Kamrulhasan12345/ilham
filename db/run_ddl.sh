#!/usr/bin/env bash
# Rebuild the Ilham schema from scratch. Destructive: drops all three schemas.
#   ./run_ddl.sh [dbname]        rebuild DDL + seed
#   ./run_ddl.sh [dbname] test   rebuild, then run the smoke test
set -euo pipefail
DB="${1:-ilham}"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FILES=(00_init 01_corpus 02_app 03_staging 04_seed_reference)
[[ "${2:-}" == "test" ]] && FILES+=(98_smoke_test)
for f in "${FILES[@]}"; do
  echo "-- $f"
  psql -q -v ON_ERROR_STOP=1 -d "$DB" -f "$DIR/$f.sql"
done
echo "-- done: $DB"
