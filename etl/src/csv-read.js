// =============================================================================
// ILHAM ETL — csv-read.js
//
// An RFC4180 CSV reader. config.js has a writer (csvCell/CsvFile); this is the
// other direction, needed because LK-Hadith-Corpus ships CSV, not JSON.
//
// Hand-rolled for the same reason the writer is: the file is Arabic, the fields
// contain embedded commas, quotes and newlines, and a dependency here would be
// the only thing standing between the corpus and a mangled string. The rules
// are short:
//
//   - fields are separated by ','
//   - a field may be wrapped in '"'
//   - inside a quoted field, '""' is a literal '"'
//   - a quoted field may contain ',' and newlines
//   - CRLF and LF both end a record
//
// Reads the whole file. LK's largest chapter file is ~2 MB, so streaming buys
// nothing here — unlike the 322 MB Ifta books, which json-stream.js handles.
// =============================================================================

import fs from 'node:fs';

// Parse CSV text into an array of string arrays. No type coercion: the caller
// decides what a field means.
export function parseCsv(text) {
  // Strip a UTF-8 BOM. Excel and pandas both emit one; left in place it becomes
  // part of the first header name and every lookup on that column misses.
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  const rows = [];
  let row = [], field = '', i = 0, quoted = false;
  const n = text.length;

  while (i < n) {
    const c = text[i];

    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        quoted = false; i++; continue;
      }
      field += c; i++; continue;
    }

    if (c === '"') { quoted = true; i++; continue; }
    if (c === ',') { row.push(field); field = ''; i++; continue; }
    if (c === '\r') { i++; continue; }               // CRLF -> handled by \n
    if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; continue; }
    field += c; i++;
  }
  // Trailing record without a final newline.
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

// Parse into objects keyed by the header row. Duplicate header names keep the
// first column, which is the conventional reading and never silently reorders.
export function readCsvObjects(file) {
  const rows = parseCsv(fs.readFileSync(file, 'utf8'));
  if (!rows.length) return { header: [], records: [] };
  const header = rows[0].map((h) => h.trim());
  const records = [];
  for (let r = 1; r < rows.length; r++) {
    // A blank trailing line is not a record.
    if (rows[r].length === 1 && rows[r][0] === '') continue;
    const o = {};
    for (let c = 0; c < header.length; c++) {
      if (!(header[c] in o)) o[header[c]] = rows[r][c] ?? '';
    }
    records.push(o);
  }
  return { header, records };
}

// LK is a pandas export: a missing value is the literal string 'nan', and an
// integer column that ever held a NULL is written '2.0' rather than '2'. Both
// are artefacts of the export, not of the source, so they are cleaned here at
// the boundary rather than being carried into staging.
export function lkField(v) {
  const s = (v ?? '').trim();
  return (s === '' || s.toLowerCase() === 'nan') ? null : s;
}

export function lkNumber(v) {
  const s = lkField(v);
  return s === null ? null : s.replace(/\.0$/, '');
}
