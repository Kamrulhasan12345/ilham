#!/usr/bin/env bash
# Start a disposable PostgreSQL 16 for Ilham, matching the settings the schema
# requires. Works with podman (rootless) or docker.
#
#   ./run_container.sh            start (idempotent), load DDL + seed
#   ./run_container.sh test       ... then run the smoke test
#   ./run_container.sh reset      destroy the container and start clean
#
# Port 5432 is published so the Node ETL on the host can reach it.
#
# UTF8 is not optional: 00_init.sql aborts on any other server_encoding, and the
# corpus is canonically Arabic. C.UTF-8 keeps collation deterministic across
# machines, which matters because the reconciliation numbers must reproduce.
set -euo pipefail

ENGINE="${ILHAM_ENGINE:-$(command -v podman >/dev/null 2>&1 && echo podman || echo docker)}"
NAME="${ILHAM_CONTAINER:-ilham-pg}"
IMAGE="${ILHAM_IMAGE:-docker.io/library/postgres:16-alpine}"
PORT="${PGPORT:-5432}"
DB="${PGDATABASE:-ilham}"
PASS="${PGPASSWORD:-ilham}"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ "${1:-}" == "reset" ]]; then
  "$ENGINE" rm -f "$NAME" >/dev/null 2>&1 || true
  echo "-- removed $NAME"
  shift || true
fi

if ! "$ENGINE" inspect "$NAME" >/dev/null 2>&1; then
  echo "-- creating $NAME from $IMAGE"
  "$ENGINE" run -d --name "$NAME" \
    -e POSTGRES_PASSWORD="$PASS" \
    -e POSTGRES_DB="$DB" \
    -e POSTGRES_INITDB_ARGS="--encoding=UTF8 --locale=C.UTF-8" \
    -p "127.0.0.1:${PORT}:5432" \
    -v "$DIR:/db:ro,z" \
    "$IMAGE" >/dev/null
else
  "$ENGINE" start "$NAME" >/dev/null 2>&1 || true
fi

printf -- '-- waiting for postgres'
for _ in $(seq 1 60); do
  if "$ENGINE" exec "$NAME" pg_isready -U postgres -d "$DB" >/dev/null 2>&1; then
    echo " ready"; break
  fi
  printf '.'; sleep 1
done
"$ENGINE" exec "$NAME" pg_isready -U postgres -d "$DB" >/dev/null 2>&1 || {
  echo; echo "postgres did not become ready; try: $ENGINE logs $NAME" >&2; exit 1; }

# run_ddl.sh lives beside this script and is mounted at /db.
# PGUSER is required: exec runs as root, whose role does not exist in the server.
"$ENGINE" exec -e PGUSER=postgres -e PGPASSWORD="$PASS" "$NAME" \
  /db/run_ddl.sh "$DB" "${1:-}"

echo "-- $NAME up on 127.0.0.1:${PORT}  db=$DB user=postgres"
