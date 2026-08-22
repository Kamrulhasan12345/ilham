#!/usr/bin/env bash
# Start a disposable PostgreSQL 16 for Ilham, matching the settings the schema
# requires. Works with podman (rootless) or docker.
#
#   ./run_container.sh            start (idempotent), load DDL + seed
#   ./run_container.sh test       ... then run the smoke test
#   ./run_container.sh reset      destroy the container and start clean
#   ./run_container.sh bootstrap  idempotent: create/start, load DDL only if
#                                  missing, then populate an empty corpus from
#                                  db/ilham.dump (or .sql.gz) if committed, else
#                                  from etl/raw/ via the real ETL. Never touches
#                                  existing data.
#   ./run_container.sh dump       snapshot an already-sealed instance to
#                                  db/ilham.dump (falls back to a gzipped
#                                  plain-SQL dump if that comes out over the
#                                  git size margin) for bootstrap to restore.
#
# Port 5432 is published so the Node ETL on the host can reach it.
#
# UTF8 is not optional: 00_init.sql aborts on any other server_encoding, and the
# corpus is canonically Arabic. C.UTF-8 keeps collation deterministic across
# machines, which matters because the reconciliation numbers must reproduce.
#
# Windows: WSL2 is the recommended shell (real Linux bash, no path quirks).
# Git Bash also works -- MSYS_NO_PATHCONV below is for exactly that case. Without
# it, Git Bash's MSYS runtime rewrites any argument that looks like a POSIX
# path before handing it to docker.exe, including paths meant to stay literal
# INSIDE the container (/db, /tmp/...) -- this script passes plenty of those.
# The env var is a no-op outside MSYS (Linux, macOS, WSL2), so it's safe to set
# unconditionally rather than only under Git Bash.
export MSYS_NO_PATHCONV=1
set -euo pipefail

ENGINE="${ILHAM_ENGINE:-$(command -v podman >/dev/null 2>&1 && echo podman || echo docker)}"
NAME="${ILHAM_CONTAINER:-ilham-pg}"
IMAGE="${ILHAM_IMAGE:-docker.io/library/postgres:16-alpine}"
PORT="${PGPORT:-5432}"
DB="${PGDATABASE:-ilham}"
PASS="${PGPASSWORD:-ilham}"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Committed dump: the fast path for bootstrap. .dump (custom format) is tried
# first; .sql.gz is the automatic fallback when .dump doesn't fit under git's
# size margin (see `dump` mode below). Both are meant to be committed to git.
DUMP_FILE_FC="${ILHAM_DUMP_FILE:-$DIR/ilham.dump}"
DUMP_FILE_SQLGZ="${DUMP_FILE_FC%.dump}.sql.gz"
DUMP_SIZE_LIMIT_MB=50
# pg_dump/pg_restore always run INSIDE the container (never the host), so they
# match the server's version exactly -- a host client on a different major
# version can emit directives the server rejects on restore (transaction_timeout,
# added in PG17+, is exactly this trap: pg_dump 18 emits it, pg16 refuses it).
# That means the dump file must live directly under db/, the one directory
# bind-mounted into the container.
DUMP_BASENAME_FC="$(basename "$DUMP_FILE_FC")"
DUMP_BASENAME_SQLGZ="$(basename "$DUMP_FILE_SQLGZ")"

# psql_scalar QUERY — runs a single-row/column query inside the container as
# postgres, returns the trimmed value. Failures propagate (no `|| true`): a
# bad query or a connection problem aborts the script under set -e, same as
# every other command here.
psql_scalar() {
  "$ENGINE" exec -e PGUSER=postgres -e PGPASSWORD="$PASS" "$NAME" \
    psql -X -q -v ON_ERROR_STOP=1 -d "$DB" -tAc "$1"
}

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

# =============================================================================
# dump — snapshot an already-sealed instance for bootstrap's fast path.
# =============================================================================
dump_main() {
  local hadith_count staging_present
  hadith_count="$(psql_scalar "SELECT count(*) FROM corpus.hadiths")"
  staging_present="$(psql_scalar "SELECT to_regnamespace('staging') IS NOT NULL")"
  if [[ "$hadith_count" -eq 0 || "$staging_present" == "t" ]]; then
    echo "-- dump: refusing — corpus isn't loaded and sealed yet (hadiths=$hadith_count staging_present=$staging_present)." >&2
    echo "--   Run './run_container.sh bootstrap' first." >&2
    exit 1
  fi

  echo "-- dump: writing $DUMP_FILE_FC (custom format, compressed)"
  "$ENGINE" exec -e PGUSER=postgres -e PGPASSWORD="$PASS" "$NAME" \
    pg_dump -Fc -Z9 -U postgres -d "$DB" -f "/tmp/$DUMP_BASENAME_FC"
  "$ENGINE" cp "$NAME:/tmp/$DUMP_BASENAME_FC" "$DUMP_FILE_FC"
  "$ENGINE" exec "$NAME" rm -f "/tmp/$DUMP_BASENAME_FC"
  local size_mb; size_mb=$(du -m "$DUMP_FILE_FC" | cut -f1)

  if [[ "$size_mb" -le "$DUMP_SIZE_LIMIT_MB" ]]; then
    rm -f "$DUMP_FILE_SQLGZ"   # don't leave a stale fallback lying around
    echo "-- dump: done -> $DUMP_FILE_FC (${size_mb}MB)"
  else
    echo "-- dump: $DUMP_FILE_FC is ${size_mb}MB, over the ${DUMP_SIZE_LIMIT_MB}MB git safety margin."
    echo "--   Falling back to a gzipped plain-SQL dump."
    # No --clean here: bootstrap's restore side does its own CASCADE drop of
    # corpus/app/staging first (see bootstrap_main), which is cascade-aware
    # across schemas in a way pg_dump's --clean fixup statements are not.
    "$ENGINE" exec -e PGUSER=postgres -e PGPASSWORD="$PASS" "$NAME" \
      sh -c "pg_dump -Fp -U postgres -d '$DB' | gzip -9 > /tmp/$DUMP_BASENAME_SQLGZ"
    "$ENGINE" cp "$NAME:/tmp/$DUMP_BASENAME_SQLGZ" "$DUMP_FILE_SQLGZ"
    "$ENGINE" exec "$NAME" rm -f "/tmp/$DUMP_BASENAME_SQLGZ"
    rm -f "$DUMP_FILE_FC"
    local gz_mb; gz_mb=$(du -m "$DUMP_FILE_SQLGZ" | cut -f1)
    echo "-- dump: done -> $DUMP_FILE_SQLGZ (${gz_mb}MB)"
    if [[ "$gz_mb" -gt "$DUMP_SIZE_LIMIT_MB" ]]; then
      echo "-- dump: WARNING — still ${gz_mb}MB, still over the margin. Consider trimming" >&2
      echo "--   the corpus or revisiting Git LFS before committing this." >&2
    fi
  fi
  exit 0
}

if [[ "${1:-}" == "dump" ]]; then
  dump_main
fi

# =============================================================================
# bootstrap — idempotent, never destructive of existing data. Every other mode
# above always rebuilds; this one only fills in what is actually missing.
# =============================================================================
bootstrap_main() {
  echo "-- bootstrap: checking schema state"

  # --- schema presence + corpus load state ---
  local has_corpus hadith_count staging_present seed_already_run=0
  has_corpus="$(psql_scalar "SELECT to_regnamespace('corpus') IS NOT NULL")"
  hadith_count=0
  staging_present="t"
  if [[ "$has_corpus" == "t" ]]; then
    hadith_count="$(psql_scalar "SELECT count(*) FROM corpus.hadiths")"
    staging_present="$(psql_scalar "SELECT to_regnamespace('staging') IS NOT NULL")"
  fi

  if [[ "$hadith_count" -gt 0 ]]; then
    echo "-- bootstrap: corpus.hadiths already has $hadith_count rows — skipping schema load and ETL"

  elif [[ -f "$DUMP_FILE_FC" || -f "$DUMP_FILE_SQLGZ" ]]; then
    # A committed dump recreates schema + data + the seal itself, so it skips
    # run_ddl.sh and the ETL entirely. Drop any existing schemas first, exactly
    # like 00_init.sql does -- pg_restore's own --clean drops object-by-object
    # and isn't cascade-aware across schemas, so it fails outright whenever a
    # fresh run_ddl.sh has already put a staging schema in place whose FKs
    # point at corpus (staging isn't in the dump at all, since it was taken
    # post-seal). A CASCADE drop first makes restore safe over a fresh volume,
    # a schema-only container, or the broken half-state below (self-healing,
    # no `reset` required) regardless of what's already there.
    "$ENGINE" exec -e PGUSER=postgres -e PGPASSWORD="$PASS" "$NAME" \
      psql -X -q -v ON_ERROR_STOP=1 -d "$DB" -c \
      "DROP SCHEMA IF EXISTS staging CASCADE; DROP SCHEMA IF EXISTS app CASCADE; DROP SCHEMA IF EXISTS corpus CASCADE;"
    # ilham_app must exist before either dump's GRANT statements replay;
    # CREATE ROLE has no IF NOT EXISTS, so reuse 05_post_load.sql's own guard.
    psql_scalar "DO \$\$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='ilham_app') THEN CREATE ROLE ilham_app LOGIN; END IF; END \$\$;" >/dev/null

    if [[ -f "$DUMP_FILE_FC" ]]; then
      echo "-- bootstrap: restoring from $DUMP_FILE_FC (skipping DDL + ETL)"
      "$ENGINE" exec -e PGUSER=postgres -e PGPASSWORD="$PASS" "$NAME" \
        pg_restore --no-owner --single-transaction \
        -U postgres -d "$DB" "/db/$DUMP_BASENAME_FC"
    else
      echo "-- bootstrap: restoring from $DUMP_FILE_SQLGZ (skipping DDL + ETL)"
      "$ENGINE" exec -e PGUSER=postgres -e PGPASSWORD="$PASS" "$NAME" \
        sh -c "gunzip -c '/db/$DUMP_BASENAME_SQLGZ' | psql -X -q --single-transaction -v ON_ERROR_STOP=1 -U postgres -d '$DB'"
    fi
    seed_already_run=1

  else
    if [[ "$has_corpus" != "t" ]]; then
      echo "-- bootstrap: fresh volume — running DDL (00_init .. 04_seed_reference) + smoke test"
      "$ENGINE" exec -e PGUSER=postgres -e PGPASSWORD="$PASS" "$NAME" \
        /db/run_ddl.sh "$DB" test
    else
      echo "-- bootstrap: corpus schema already present — skipping run_ddl.sh (no data touched)"
    fi

    if [[ "$has_corpus" == "t" && "$staging_present" != "t" ]]; then
      echo "-- bootstrap: ERROR — corpus.hadiths is empty but staging is already gone." >&2
      echo "--   05_post_load.sql must have run against an empty/partial corpus, and no" >&2
      echo "--   dump ($DUMP_FILE_FC / $DUMP_FILE_SQLGZ) is available to fix it. Fix:" >&2
      echo "--     ./run_container.sh reset && ./run_container.sh bootstrap" >&2
      exit 1
    fi

    local raw="$DIR/../etl/raw"
    if [[ -f "$raw/sahih-al-bukhari.json" && -f "$raw/sahih-muslim.json" && -f "$raw/ifta_narrators.json" ]]; then
      echo "-- bootstrap: raw sources present — running the ETL"
      (
        cd "$DIR/../etl"
        export PGPASSWORD="$PASS"
        [[ -d node_modules ]] || npm install
        npm run verify
        npm run doctor
        # profile/rankmap stay manual on purpose: both need a human to read
        # the output, and a curated rank_map.sql is already committed.
        psql -X -q -v ON_ERROR_STOP=1 -h 127.0.0.1 -p "$PORT" -U postgres -d "$DB" -f rank_map.sql
        psql -X -q -v ON_ERROR_STOP=1 -h 127.0.0.1 -p "$PORT" -U postgres -d "$DB" -f narrator_overrides.sql
        npm run all
        npm run seed
      )
      seed_already_run=1

      staging_present="$(psql_scalar "SELECT to_regnamespace('staging') IS NOT NULL")"
      if [[ "$staging_present" == "t" ]]; then
        echo "-- bootstrap: sealing corpus (05_post_load.sql)"
        PGPASSWORD="$PASS" psql -X -q -v ON_ERROR_STOP=1 -h 127.0.0.1 -p "$PORT" -U postgres -d "$DB" \
          -f "$DIR/05_post_load.sql"
      else
        echo "-- bootstrap: staging already gone — skipping 05_post_load.sql (already sealed)"
      fi
    else
      echo "-- bootstrap: no dump and etl/raw/ is missing source files — skipping population."
      echo "--   The container and schema are otherwise ready for schema-only work."
      echo "--   To load the real corpus: download the Ifta Kaggle dataset into etl/raw/"
      echo "--   (see etl/README.md) and re-run bootstrap, or run './run_container.sh dump'"
      echo "--   on an already-populated instance and commit the result."
    fi
  fi

  # --- defensive re-check: corpus loaded but app was never seeded ---
  hadith_count="$(psql_scalar "SELECT count(*) FROM corpus.hadiths")"
  if [[ "$hadith_count" -gt 0 && "$seed_already_run" -eq 0 ]]; then
    local user_count
    user_count="$(psql_scalar "SELECT count(*) FROM app.users")"
    if [[ "$user_count" -eq 0 ]]; then
      echo "-- bootstrap: corpus loaded but app.users is empty — running npm run seed"
      ( cd "$DIR/../etl" && PGPASSWORD="$PASS" npm run seed )
    fi
  fi

  # --- final status ---
  local final_hadiths final_users final_staging
  final_hadiths="$(psql_scalar "SELECT count(*) FROM corpus.hadiths")"
  final_users="$(psql_scalar "SELECT count(*) FROM app.users")"
  final_staging="$(psql_scalar "SELECT to_regnamespace('staging') IS NOT NULL")"
  echo "-- bootstrap: $NAME up on 127.0.0.1:${PORT}  db=$DB  hadiths=$final_hadiths  app.users=$final_users  staging_present=$final_staging"
  exit 0
}

if [[ "${1:-}" == "bootstrap" ]]; then
  bootstrap_main
fi

# run_ddl.sh lives beside this script and is mounted at /db.
# PGUSER is required: exec runs as root, whose role does not exist in the server.
"$ENGINE" exec -e PGUSER=postgres -e PGPASSWORD="$PASS" "$NAME" \
  /db/run_ddl.sh "$DB" "${1:-}"

echo "-- $NAME up on 127.0.0.1:${PORT}  db=$DB user=postgres"
