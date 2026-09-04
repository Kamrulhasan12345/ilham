#!/usr/bin/env node
// Enforces docs/frontend-prd.md §4.2: no raw colour, size, space, radius, or
// duration literal outside Layer 0 (frontend/src/styles/tokens.css). A
// literal border-width (e.g. "1px solid") is the one allowed exception.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_ROOT = fileURLToPath(new URL('../src', import.meta.url));
const ROOT = process.env.TOKEN_CHECK_SRC_DIR ?? DEFAULT_ROOT;
const SCAN_DIRS = ['ui', 'domain', 'routes', 'app'];

const HEX_RE = /#[0-9a-fA-F]{3,8}\b/;
const RGB_RE = /\brgba?\(/i;
const PX_RE = /(?<![\w-])\d+(?:\.\d+)?px\b/;
const BORDER_LINE_RE = /border(-width)?\s*:/i;

function walk(dir, files = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return files;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, files);
    else if (extname(entry) === '.css') files.push(full);
  }
  return files;
}

function checkFile(path) {
  const lines = readFileSync(path, 'utf8').split('\n');
  const violations = [];
  lines.forEach((line, i) => {
    if (HEX_RE.test(line) || RGB_RE.test(line)) {
      violations.push({ line: i + 1, text: line.trim(), reason: 'raw colour literal' });
      return;
    }
    if (PX_RE.test(line) && !BORDER_LINE_RE.test(line)) {
      violations.push({
        line: i + 1,
        text: line.trim(),
        reason: 'raw px literal outside a border width',
      });
    }
  });
  return violations;
}

function main() {
  const files = SCAN_DIRS.flatMap((dir) => walk(join(ROOT, dir)));

  let failed = false;
  for (const file of files) {
    for (const v of checkFile(file)) {
      failed = true;
      console.error(`${file}:${v.line}: ${v.reason} — ${v.text}`);
    }
  }

  if (failed) {
    console.error('\nToken check failed: use var(--token) from src/styles/tokens.css instead.');
    process.exit(1);
  }
  console.log(`Token check passed (${files.length} CSS files scanned under ${ROOT}).`);
}

main();
