#!/bin/sh
# Runs ONCE, on first container start, from /docker-entrypoint-initdb.d/.
# The postgres image executes everything in that directory in alphabetical
# order, which is why db/*.sql is NOT mounted there directly: that would run
# 05_post_load.sql — which seals the corpus and drops the staging schema —
# before the ETL has loaded anything.
#
# If db/ilham.dump (or its gzipped fallback) is committed, restore it instead:
# it already IS schema + real corpus + seeded app layer + the seal, so there
# is nothing left for the DDL files or 05_post_load.sql to do. This is what
# lets plain `docker compose up -d db` alone give a fully populated database
# on any host OS, including native Windows — this script runs inside the
# Linux container regardless of what's on the host.
#
# Falls back to the schema-only DDL load (00_init .. 04_seed_reference, plus
# the smoke test) when no dump is committed. That order matches run_ddl.sh.
# 05_post_load.sql itself stays absent either way; it is a manual, once-only
# step for anyone building the corpus from raw data through the ETL instead.
#
# No pre-existing-schema guard is needed here, unlike run_container.sh's
# `bootstrap`: this script only ever runs once, against a brand new $PGDATA,
# by construction of docker-entrypoint-initdb.d.
set -e

DUMP_FC=/db/ilham.dump
DUMP_SQLGZ=/db/ilham.sql.gz

if [ -f "$DUMP_FC" ] || [ -f "$DUMP_SQLGZ" ]; then
  # CREATE ROLE has no IF NOT EXISTS; the dump's own GRANT statements target
  # ilham_app and fail to replay unless the role already exists.
  psql -q -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c \
    "DO \$\$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='ilham_app') THEN CREATE ROLE ilham_app LOGIN; END IF; END \$\$;"

  if [ -f "$DUMP_FC" ]; then
    echo "-- restoring $DUMP_FC"
    pg_restore --no-owner --single-transaction -U "$POSTGRES_USER" -d "$POSTGRES_DB" "$DUMP_FC"
  else
    echo "-- restoring $DUMP_SQLGZ"
    gunzip -c "$DUMP_SQLGZ" | psql -q --single-transaction -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"
  fi

  echo "-- ilham corpus restored from a committed dump ($POSTGRES_DB)"
else
  FILES="00_init 01_corpus 02_app 03_staging 04_seed_reference"
  [ "${ILHAM_SMOKE_TEST:-1}" = "1" ] && FILES="$FILES 98_smoke_test"

  for f in $FILES; do
    echo "-- $f"
    psql -q -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f "/db/$f.sql"
  done

  echo "-- ilham schema ready, corpus empty ($POSTGRES_DB)"
fi
