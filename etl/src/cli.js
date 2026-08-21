#!/usr/bin/env node
import { profile, rankmap } from './profile.js';
import { extract } from './extract.js';
import { load, transform } from './load.js';
import { seed } from './seed.js';
import { verify } from './verify.js';
import { doctor } from './doctor.js';

const USAGE = `
ilham-etl

  node src/cli.js <command>          (or: npm run <command>)

Setup
  verify      Check etl/raw/* against the sha256 manifest in sources.json, and
              record the hashes in corpus.etl_metrics as the corpus's own
              provenance. The raw data is too large for git, so this is what
              makes a load reproducible. Acquisition is MANUAL — see README.md.

  doctor      Preflight. Database reachable, UTF8, schemas present, and the JS
              and SQL copies of normalize_arabic still agree. Run before any
              load; every check here is a failure that is silent if you meet it
              later instead of now.

Inspection (write nothing to the database — read the output)
  profile     Report the source's detected field shape and answer the three
              questions the pipeline depends on: which name surface chain
              strings match, the single-sanad share, and whether chain and
              mention lengths agree. RUN THIS FIRST.

  rankmap     Emit build/rank_map.sql — the frequency-ordered rijal grade
              strings with a first-pass code guess. Review by hand, then run it.

Load
  extract     JSON -> build/*.csv. Structural flattening only; streamed.
  load        build/*.csv -> staging, via COPY.
  transform   SQL stages 10 -> 19 (staging -> corpus). Optionally one stage:
                node src/cli.js transform 12_resolve
  seed        Populate the app layer through the procedure and triggers.
              Requires a loaded corpus.

  all         extract, load, transform.  (profile and rankmap stay manual: both
              produce output a human has to read before the next step.)

Then, once and destructively:  psql -f ../db/05_post_load.sql

Environment (.env — see .env.example):
  ILHAM_BOOKS_DIR, ILHAM_NARRATORS_FILE, ILHAM_MANIFEST_FILE, ILHAM_LK_DIR,
  ILHAM_OUT_DIR, ILHAM_SQL_DIR, ILHAM_SHAPE_OVERRIDE, ILHAM_KEEP_RAW_DOC
  PGHOST, PGPORT, PGDATABASE, PGUSER, PGPASSWORD
`;

const cmd = process.argv[2];

const COMMANDS = {
  verify,
  doctor,
  profile,
  rankmap,
  extract,
  load,
  transform: () => transform({ only: process.argv[3] || null }),
  seed,
  all: async () => { await extract(); await load(); await transform(); },
};

if (!cmd || !COMMANDS[cmd]) {
  console.log(USAGE);
  process.exit(cmd ? 1 : 0);
}

COMMANDS[cmd]()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('\nFAILED:', e.message);
    if (process.env.ILHAM_DEBUG) console.error(e.stack);
    process.exit(1);
  });
