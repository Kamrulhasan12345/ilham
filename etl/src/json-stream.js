import fs from 'node:fs';
import { StringDecoder } from 'node:string_decoder';

// =============================================================================
// STREAMING READER for a top-level JSON array.
//
// extract.js used to JSON.parse an entire book file. The Ifta books are 322MB
// and 340MB on disk and expand several-fold as a JS object graph, so that needs
// multiple GB of heap for a file we only ever walk once, front to back. On a
// 5GB machine it does not complete, and --max-old-space-size only moves where
// it fails.
//
// This yields one record at a time and never holds more than a window of the
// file plus the current record. Hand-rolled rather than a dependency: the whole
// mechanism is "read a chunk, decode complete values off the front, repeat",
// and the alternative is a third-party parser sitting between the corpus and a
// mangled Arabic string.
//
// Two things this gets right that a naive version does not:
//
//   1. StringDecoder, not buf.toString(). A 4MB read almost never lands on a
//      character boundary, and Arabic is 2 bytes per letter in UTF-8. Decoding
//      each chunk independently corrupts whatever letter straddles the seam --
//      silently, as U+FFFD, in maybe one record per chunk.
//   2. A moving offset, not repeated slice(). Slicing a 4MB string once per
//      record is quadratic; the Ifta records are ~15KB, so that is ~270 copies
//      of a 4MB buffer per chunk.
//
// Only handles the shape the sources actually have -- a top-level array. It is
// not a general JSON streaming parser and should not become one.
// =============================================================================

const CHUNK = 1 << 22;         // 4MB reads
const COMPACT_AT = 1 << 23;    // reclaim the consumed prefix past 8MB

// Scan for the end of one complete JSON value starting at `i`.
// Returns the index one past the value, or -1 if `s` is short.
// String-aware, so braces/brackets inside Arabic text cannot fool it.
function endOfValue(s, i) {
  let depth = 0, inStr = false, esc = false;
  for (let j = i; j < s.length; j++) {
    const c = s[j];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === '{' || c === '[') depth++;
    else if (c === '}' || c === ']') {
      if (--depth === 0) return j + 1;
    }
  }
  return -1;
}

const isWs = (c) => c === ' ' || c === '\n' || c === '\r' || c === '\t' || c === ',';

/**
 * Iterate the elements of a top-level JSON array.
 * @param {string} path
 * @param {{limit?: number}} opts
 * @yields {any}
 */
export function* streamArray(path, { limit = 0 } = {}) {
  const fd = fs.openSync(path, 'r');
  const raw = Buffer.allocUnsafe(CHUNK);
  const decoder = new StringDecoder('utf8');
  let s = '';        // window into the file
  let pos = 0;       // read cursor within s
  let started = false;
  let n = 0;

  try {
    for (;;) {
      const read = fs.readSync(fd, raw, 0, CHUNK, null);
      s += read > 0 ? decoder.write(raw.subarray(0, read)) : decoder.end();
      const atEof = read === 0;

      if (!started) {
        const open = s.indexOf('[', pos);
        if (open < 0) {
          if (atEof) return;
          continue;
        }
        pos = open + 1;
        started = true;
      }

      for (;;) {
        while (pos < s.length && isWs(s[pos])) pos++;
        if (pos >= s.length) break;
        if (s[pos] === ']') return;

        const end = endOfValue(s, pos);
        if (end < 0) break;                     // incomplete: need more bytes
        yield JSON.parse(s.slice(pos, end));
        pos = end;
        if (limit && ++n >= limit) return;
      }

      if (atEof) return;
      if (pos > COMPACT_AT) { s = s.slice(pos); pos = 0; }
    }
  } finally {
    fs.closeSync(fd);
  }
}

/** Count elements without retaining them. */
export function countArray(path) {
  let n = 0;
  // eslint-disable-next-line no-unused-vars
  for (const _ of streamArray(path)) n++;
  return n;
}
