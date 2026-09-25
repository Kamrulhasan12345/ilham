import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from './app.js';
import { pool } from './db/pool.js';
import { bearer, fakeIp, registerAndGetToken, uniqueEmail } from './testUtils/helpers.js';

async function tokenFor(tag: string): Promise<string> {
  const { accessToken } = await registerAndGetToken(app, uniqueEmail(`corpus-${tag}`), 'student');
  return accessToken;
}

function authed(token: string, req: request.Test): request.Test {
  return req.set(bearer(token)).set('x-forwarded-for', fakeIp());
}

async function firstCollectionId(token: string): Promise<number> {
  const res = await authed(token, request(app).get('/collections'));
  assert.equal(res.status, 200);
  return res.body.data[0].collection_id;
}

async function firstChapterId(token: string, collectionId: number): Promise<number> {
  const res = await authed(
    token,
    request(app).get(`/chapters?collection_id=${collectionId}&limit=100`),
  );
  assert.equal(res.status, 200);
  const withHadiths = res.body.data.find((c: { hadith_count: number }) => c.hadith_count > 0);
  return (withHadiths ?? res.body.data[0]).chapter_id;
}

describe('GET /health (public)', () => {
  test('returns 200 with data.status ok and no token', async () => {
    const res = await request(app).get('/health');
    assert.equal(res.status, 200);
    assert.equal(res.body.data.status, 'ok');
    assert.equal(typeof res.body.data.corpus.hadiths, 'number');
    assert.equal(typeof res.body.data.corpus.narrators, 'number');
  });
});

describe('auth guard on corpus reads', () => {
  test('GET /collections without a token is 401', async () => {
    const res = await request(app).get('/collections');
    assert.equal(res.status, 401);
  });

  test('GET /hadiths without a token is 401', async () => {
    const res = await request(app).get('/hadiths');
    assert.equal(res.status, 401);
  });

  test('GET /meta/etl-metrics without a token is 401', async () => {
    const res = await request(app).get('/meta/etl-metrics');
    assert.equal(res.status, 401);
  });
});

describe('GET /meta/etl-metrics', () => {
  test('returns 200 with an array in body.data', async () => {
    const token = await tokenFor('etlmetrics');
    const res = await authed(token, request(app).get('/meta/etl-metrics'));
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.data));
  });
});

describe('GET /collections', () => {
  test('returns 200 with a non-empty array and item fields', async () => {
    const token = await tokenFor('collections');
    const res = await authed(token, request(app).get('/collections'));
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.data));
    assert.ok(res.body.data.length > 0);
    const first = res.body.data[0];
    assert.equal(typeof first.collection_id, 'number');
    assert.equal(typeof first.slug, 'string');
    assert.equal(typeof first.title_ar, 'string');
  });
});

describe('GET /chapters', () => {
  test('returns 400 when collection_id is missing', async () => {
    const token = await tokenFor('chapters-missing');
    const res = await authed(token, request(app).get('/chapters'));
    assert.equal(res.status, 400);
  });

  test('returns 400 when collection_id is not an integer', async () => {
    const token = await tokenFor('chapters-bad');
    const res = await authed(token, request(app).get('/chapters?collection_id=abc'));
    assert.equal(res.status, 400);
  });

  test('returns 400 when seq is not an integer', async () => {
    const token = await tokenFor('chapters-bad-seq');
    const collectionId = await firstCollectionId(token);
    const res = await authed(
      token,
      request(app).get(`/chapters?collection_id=${collectionId}&seq=abc`),
    );
    assert.equal(res.status, 400);
  });

  test('returns 200 with chapters for a real collection id from the API', async () => {
    const token = await tokenFor('chapters-ok');
    const collectionId = await firstCollectionId(token);
    const res = await authed(token, request(app).get(`/chapters?collection_id=${collectionId}`));
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.data));
    assert.ok(res.body.data.length > 0);
    assert.equal(typeof res.body.page.total, 'number');
    const first = res.body.data[0];
    assert.equal(typeof first.chapter_id, 'number');
    assert.equal(typeof first.seq, 'number');
    assert.equal(typeof first.title_ar, 'string');
    assert.equal(typeof first.hadith_count, 'number');
    for (const row of res.body.data) {
      assert.equal(row.collection_id, collectionId);
    }
  });

  test('filters to one chapter when seq is given', async () => {
    const token = await tokenFor('chapters-seq');
    const collectionId = await firstCollectionId(token);
    const res = await authed(
      token,
      request(app).get(`/chapters?collection_id=${collectionId}&seq=2`),
    );
    assert.equal(res.status, 200);
    assert.equal(res.body.data.length, 1);
    assert.equal(res.body.data[0].collection_id, collectionId);
    assert.equal(res.body.data[0].seq, 2);
    assert.equal(res.body.page.total, 1);
  });

  test('returns 200 with an empty array for an unknown seq', async () => {
    const token = await tokenFor('chapters-seq-unknown');
    const collectionId = await firstCollectionId(token);
    const res = await authed(
      token,
      request(app).get(`/chapters?collection_id=${collectionId}&seq=9999`),
    );
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.data, []);
  });

  test('returns 200 with an empty array for an unknown collection id (no 404 in controller)', async () => {
    const token = await tokenFor('chapters-unknown');
    // NOTE: probe id stays inside the smallint range of corpus.collections.collection_id;
    // an out-of-range integer (e.g. 999999999) overflows smallint and 500s (PG 22003).
    const known = await authed(token, request(app).get('/collections'));
    assert.equal(known.status, 200);
    const unknownId = Math.max(...known.body.data.map((c: { collection_id: number }) => c.collection_id)) + 1;
    const res = await authed(token, request(app).get(`/chapters?collection_id=${unknownId}`));
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.data, []);
  });
});

describe('GET /hadiths', () => {
  test('returns 200 with the data + page envelope', async () => {
    const token = await tokenFor('hadiths-list');
    const res = await authed(token, request(app).get('/hadiths'));
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.data));
    assert.ok(res.body.data.length > 0);
    assert.equal(typeof res.body.page.limit, 'number');
    assert.equal(typeof res.body.page.offset, 'number');
    assert.equal(typeof res.body.page.total, 'number');
    const first = res.body.data[0];
    assert.equal(typeof first.hadith_id, 'number');
    assert.equal(typeof first.hadith_num, 'string');
    assert.equal(typeof first.text_plain, 'string');
  });

  test('honours limit pagination', async () => {
    const token = await tokenFor('hadiths-page');
    const res = await authed(token, request(app).get('/hadiths?limit=2'));
    assert.equal(res.status, 200);
    assert.equal(res.body.page.limit, 2);
    assert.ok(res.body.data.length <= 2);
  });

  test('filters by collection_id from the API', async () => {
    const token = await tokenFor('hadiths-coll');
    const collectionId = await firstCollectionId(token);
    const res = await authed(
      token,
      request(app).get(`/hadiths?collection_id=${collectionId}&limit=5`),
    );
    assert.equal(res.status, 200);
    assert.ok(res.body.data.length > 0);
    for (const row of res.body.data) {
      assert.equal(row.collection_id, collectionId);
    }
  });

  test('filters by chapter_id from the API', async () => {
    const token = await tokenFor('hadiths-chap');
    const collectionId = await firstCollectionId(token);
    const chapterId = await firstChapterId(token, collectionId);
    const res = await authed(token, request(app).get(`/hadiths?chapter_id=${chapterId}&limit=5`));
    assert.equal(res.status, 200);
    assert.ok(res.body.data.length > 0);
    for (const row of res.body.data) {
      assert.equal(row.chapter_id, chapterId);
    }
  });

  test('filters by Arabic full-text q', async () => {
    const token = await tokenFor('hadiths-q');
    const res = await authed(
      token,
      request(app).get(`/hadiths?q=${encodeURIComponent('الأعمال')}&limit=5`),
    );
    assert.equal(res.status, 200);
    assert.ok(res.body.page.total > 0);
    assert.ok(res.body.data.length > 0);
  });

  test('returns 400 for a non-integer collection_id', async () => {
    const token = await tokenFor('hadiths-bad');
    const res = await authed(token, request(app).get('/hadiths?collection_id=abc'));
    assert.equal(res.status, 400);
  });

  test('rows carry text_en when an English translation exists for that hadith', async () => {
    const token = await tokenFor('hadiths-text-en');
    const { rows } = await pool.query<{ hadith_id: number }>(
      `SELECT hadith_id FROM corpus.hadith_translations WHERE lang = 'en' ORDER BY hadith_id LIMIT 1`,
    );
    assert.ok(rows.length > 0, 'expected at least one English translation in the corpus');
    const translatedId = rows[0].hadith_id;

    // The list endpoint has no id filter, so page through until the known
    // translated hadith turns up, capped well under the corpus size.
    let found: { hadith_id: number; text_en: string | null } | undefined;
    for (let offset = 0; offset < 500 && !found; offset += 100) {
      const res = await authed(token, request(app).get(`/hadiths?limit=100&offset=${offset}`));
      assert.equal(res.status, 200);
      found = res.body.data.find((h: { hadith_id: number }) => h.hadith_id === translatedId);
    }
    assert.ok(found, 'expected the translated hadith to appear in the list within 500 rows');
    assert.equal(typeof found?.text_en, 'string');
  });

  test('rows carry text_en: null when no English translation exists for that hadith', async () => {
    const token = await tokenFor('hadiths-text-en-null');
    const { rows } = await pool.query<{ hadith_id: number }>(
      `SELECT h.hadith_id FROM corpus.hadiths h
        LEFT JOIN corpus.hadith_translations t ON t.hadith_id = h.hadith_id AND t.lang = 'en'
       WHERE t.hadith_id IS NULL LIMIT 1`,
    );
    assert.ok(rows.length > 0, 'expected at least one untranslated hadith in the corpus');
    const untranslatedId = rows[0].hadith_id;

    let found: { hadith_id: number; text_en: string | null; text_plain: string } | undefined;
    for (let offset = 0; offset < 500 && !found; offset += 100) {
      const res = await authed(token, request(app).get(`/hadiths?limit=100&offset=${offset}`));
      found = res.body.data.find((h: { hadith_id: number }) => h.hadith_id === untranslatedId);
    }
    assert.ok(found, 'expected the untranslated hadith to appear in the list within 500 rows');
    assert.equal(found?.text_en, null);
    assert.equal(typeof found?.text_plain, 'string');
  });
});

describe('GET /hadiths/:id', () => {
  test('returns 200 with hadith, isnadChain and translation fields for a real id', async () => {
    const token = await tokenFor('hadith-one');
    const list = await authed(token, request(app).get('/hadiths?limit=1'));
    assert.equal(list.status, 200);
    const id = list.body.data[0].hadith_id;

    const res = await authed(token, request(app).get(`/hadiths/${id}`));
    assert.equal(res.status, 200);
    assert.equal(res.body.data.hadith.hadith_id, id);
    assert.equal(typeof res.body.data.hadith.text_plain, 'string');
    assert.ok(Array.isArray(res.body.data.isnadChain));
  });

  test('?lang=en returns the English translation for a translated hadith', async () => {
    const token = await tokenFor('hadith-en');
    const { rows } = await pool.query<{ hadith_id: number }>(
      `SELECT hadith_id FROM corpus.hadith_translations WHERE lang = 'en' ORDER BY hadith_id LIMIT 1`,
    );
    assert.ok(rows.length > 0, 'expected at least one English translation in the corpus');
    const res = await authed(token, request(app).get(`/hadiths/${rows[0].hadith_id}?lang=en`));
    assert.equal(res.status, 200);
    assert.ok(res.body.data.translation, 'expected a translation object');
    assert.equal(res.body.data.translation.lang, 'en');
    assert.equal(typeof res.body.data.translation.text_full, 'string');
  });

  test('returns 404 for a nonexistent id', async () => {
    const token = await tokenFor('hadith-404');
    const res = await authed(token, request(app).get('/hadiths/999999999'));
    assert.equal(res.status, 404);
  });

  test('returns 400 for a non-integer id', async () => {
    const token = await tokenFor('hadith-400');
    const res = await authed(token, request(app).get('/hadiths/abc'));
    assert.equal(res.status, 400);
  });
});

describe('GET /narrators', () => {
  test('returns 200 with the data + page envelope', async () => {
    const token = await tokenFor('narrators-list');
    const res = await authed(token, request(app).get('/narrators?limit=2'));
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.data));
    assert.ok(res.body.data.length > 0);
    assert.equal(res.body.page.limit, 2);
    const first = res.body.data[0];
    assert.equal(typeof first.narrator_id, 'number');
    assert.equal(typeof first.display_name, 'string');
  });

  test('q search returns matching narrators', async () => {
    const token = await tokenFor('narrators-q');
    const res = await authed(
      token,
      request(app).get(`/narrators?q=${encodeURIComponent('عمر')}&limit=5`),
    );
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.data));
    assert.ok(res.body.data.length > 0);
  });
});

describe('GET /narrators/:id', () => {
  test('returns 200 with narrator fields for a real id from the API', async () => {
    const token = await tokenFor('narrator-one');
    const list = await authed(token, request(app).get('/narrators?limit=1'));
    assert.equal(list.status, 200);
    const id = list.body.data[0].narrator_id;

    const res = await authed(token, request(app).get(`/narrators/${id}`));
    assert.equal(res.status, 200);
    assert.equal(res.body.data.narrator_id, id);
    assert.equal(typeof res.body.data.display_name, 'string');
  });

  test('returns 404 for a nonexistent id', async () => {
    const token = await tokenFor('narrator-404');
    const res = await authed(token, request(app).get('/narrators/999999999'));
    assert.equal(res.status, 404);
  });

  test('returns 400 for a non-integer id', async () => {
    const token = await tokenFor('narrator-400');
    const res = await authed(token, request(app).get('/narrators/abc'));
    assert.equal(res.status, 400);
  });
});

describe('GET /narrators/:id/hadiths', () => {
  test('returns 200 with hadiths for a narrator taken from a real isnad chain', async () => {
    const token = await tokenFor('narrator-hadiths');
    const list = await authed(token, request(app).get('/hadiths?limit=10'));
    assert.equal(list.status, 200);
    let narratorId: number | null = null;
    for (const h of list.body.data) {
      const detail = await authed(token, request(app).get(`/hadiths/${h.hadith_id}`));
      assert.equal(detail.status, 200);
      const link = detail.body.data.isnadChain.find(
        (l: { narrator_id: number | null }) => l.narrator_id !== null,
      );
      if (link) {
        narratorId = link.narrator_id;
        break;
      }
    }
    assert.ok(narratorId !== null, 'expected a hadith with a linked narrator');

    const hadiths = await authed(
      token,
      request(app).get(`/narrators/${narratorId}/hadiths?limit=5`),
    );
    assert.equal(hadiths.status, 200);
    assert.ok(Array.isArray(hadiths.body.data));
    assert.ok(hadiths.body.data.length > 0);
    assert.equal(typeof hadiths.body.data[0].hadith_id, 'number');
    assert.equal(typeof hadiths.body.data[0].hadith_num, 'string');
  });

  test('returns 400 for a non-integer id', async () => {
    const token = await tokenFor('narrator-hadiths-400');
    const res = await authed(token, request(app).get('/narrators/abc/hadiths'));
    assert.equal(res.status, 400);
  });
});

describe('out-of-range ids match nothing instead of 500', () => {
  test('chapters with an out-of-smallint-range collection_id returns []', async () => {
    const token = await tokenFor('range-chapters');
    const res = await authed(token, request(app).get('/chapters?collection_id=999999999'));
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.data, []);
  });

  test('hadiths with an out-of-smallint-range collection_id returns []', async () => {
    const token = await tokenFor('range-hadiths');
    const res = await authed(token, request(app).get('/hadiths?collection_id=999999999'));
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.data, []);
  });
});

describe('GET /hadiths/:id grouped chains (PRD §8.4)', () => {
  test('a multi-sanad hadith returns one chain per sanad with view strengths', async () => {
    const token = await tokenFor('chains-multi');
    const idRows = await pool.query<{ hadith_id: number }>(
      `SELECT hadith_id FROM corpus.hadiths WHERE sanad_count >= 3 ORDER BY hadith_id LIMIT 1`,
    );
    const id = idRows.rows[0].hadith_id;
    const res = await authed(token, request(app).get(`/hadiths/${id}`));
    assert.equal(res.status, 200);
    const { chains, isnadChain, chainStrength } = res.body.data;
    assert.ok(Array.isArray(chains) && chains.length >= 3);
    const flat = await pool.query<{ sanad_no: number; strength: string }>(
      `SELECT sanad_no, strength FROM corpus.sanad_strengths WHERE hadith_id = $1 ORDER BY sanad_no`,
      [id],
    );
    assert.equal(chains.length, flat.rows.length);
    for (let i = 0; i < flat.rows.length; i++) {
      assert.equal(chains[i].sanad_no, flat.rows[i].sanad_no);
      assert.equal(chains[i].strength, Number(flat.rows[i].strength));
      assert.ok(chains[i].links.length > 0);
      assert.ok(chains[i].links.every((l: { sanad_no: number }) => l.sanad_no === chains[i].sanad_no));
    }
    assert.equal(isnadChain.length, chains.reduce((n: number, c: { links: unknown[] }) => n + c.links.length, 0));
    assert.equal(chainStrength, Math.max(...chains.map((c: { strength: number }) => c.strength)));
  });

  test('every link carries the function\u2019s own an\u02bfana-adjusted weight', async () => {
    const token = await tokenFor('link-weight');
    const idRows = await pool.query<{ hadith_id: number }>(
      `SELECT hadith_id FROM corpus.hadiths WHERE sanad_count >= 3 ORDER BY hadith_id LIMIT 1`,
    );
    const id = idRows.rows[0].hadith_id;
    const res = await authed(token, request(app).get(`/hadiths/${id}`));
    assert.equal(res.status, 200);
    const { chains } = res.body.data;
    for (const chain of chains as { sanad_no: number; strength: number; links: { is_compiler: boolean; weight: unknown }[] }[]) {
      assert.ok(chain.links.length > 0);
      for (const link of chain.links) {
        assert.equal(typeof link.weight, 'number', 'link weight must be a number, not numeric text');
      }
      // The weakest adjusted link sets the sanad score: min(weight) over the
      // served links must equal the served per-sanad strength, which itself
      // comes from corpus.chain_strength's own arithmetic. The collector is
      // never scored, so it stays out of the min exactly like the function.
      const scored = chain.links.filter((l) => !l.is_compiler).map((l) => l.weight as number);
      const min = Math.min(...scored);
      assert.equal(Number(min.toFixed(2)), chain.strength);
    }
  });

  test('a single-sanad hadith returns one chain and an unchanged flat list', async () => {
    const token = await tokenFor('chains-single');
    const idRows = await pool.query<{ hadith_id: number }>(
      `SELECT hadith_id FROM corpus.hadiths WHERE sanad_count = 1 ORDER BY hadith_id LIMIT 1`,
    );
    const res = await authed(token, request(app).get(`/hadiths/${idRows.rows[0].hadith_id}`));
    assert.equal(res.status, 200);
    assert.equal(res.body.data.chains.length, 1);
    assert.equal(typeof res.body.data.chains[0].strength, 'number');
  });
});

describe('GET /hadiths/:id detail companions (PRD 5.3)', () => {
  test('carries collection, chapter, and translation provenance', async () => {
    const token = await tokenFor('detail-companions');
    const res = await authed(token, request(app).get('/hadiths/5'));
    assert.equal(res.status, 200);
    const { collection, chapter, translation } = res.body.data;
    assert.equal(collection.slug, 'sahih-al-bukhari');
    assert.equal(typeof collection.title_ar, 'string');
    assert.ok(chapter === null || typeof chapter.title_ar === 'string');
    if (chapter !== null) assert.equal(typeof chapter.seq, 'number');
    if (translation !== null) {
      assert.equal(translation.lang, 'en');
      assert.ok(translation.match_via === null || typeof translation.match_via === 'string');
    }
  });

  // No live row has chapter_id NULL (verified: zero in this corpus), so the
  // null branch below is structural only: the LEFT JOIN keeps the detail
  // working if one ever loads.
});

describe('frontend page data (closed 2026-09-23)', () => {
  test('collections rows carry a hadith_count matching a direct count', async () => {
    const token = await tokenFor('coll-count');
    const res = await authed(token, request(app).get('/collections'));
    assert.equal(res.status, 200);
    for (const c of res.body.data) {
      const direct = await pool.query<{ count: string }>(
        'SELECT count(*) FROM corpus.hadiths WHERE collection_id = $1',
        [c.collection_id],
      );
      assert.equal(c.hadith_count, Number(direct.rows[0].count));
    }
  });

  test('hadith list rows carry a numeric chain_strength matching the function', async () => {
    const token = await tokenFor('list-strength');
    const res = await authed(token, request(app).get('/hadiths?limit=5'));
    assert.equal(res.status, 200);
    assert.ok(res.body.data.length > 0);
    for (const h of res.body.data) {
      assert.ok(h.chain_strength === null || typeof h.chain_strength === 'number');
    }
    const first = res.body.data[0];
    const direct = await pool.query<{ chain_strength: string | null }>(
      'SELECT corpus.chain_strength($1) AS chain_strength',
      [first.hadith_id],
    );
    const expected = direct.rows[0].chain_strength;
    assert.equal(first.chain_strength, expected != null ? Number(expected) : null);
  });

  test('detail links carry biography and grade provenance fields', async () => {
    const token = await tokenFor('link-fields');
    const res = await authed(token, request(app).get('/hadiths/5'));
    assert.equal(res.status, 200);
    const link = res.body.data.isnadChain.find(
      (l: { narrator_id: number | null }) => l.narrator_id !== null,
    );
    assert.ok(link, 'expected a resolved link');
    for (const field of [
      'kunya',
      'lineage',
      'school',
      'tabaqa_raw',
      'generation',
      'rank_ibn_hajar_raw',
      'rank_ibn_hajar_via',
      'rank_dhahabi_raw',
      'rank_dhahabi_via',
    ] as const) {
      assert.ok(field in link, `link missing ${field}`);
    }
  });

  test('link generation matches the tabaqa mapping, or is null where the text names none', async () => {
    const token = await tokenFor('link-generation');
    const res = await authed(token, request(app).get('/hadiths/5'));
    assert.equal(res.status, 200);
    const direct = await pool.query<{ narrator_id: number | null; generation: number | null }>(
      `SELECT l.narrator_id, n.generation
         FROM corpus.isnad_links l
         LEFT JOIN corpus.narrators n ON n.narrator_id = l.narrator_id
        WHERE l.hadith_id = 5 ORDER BY l.sanad_no, l.position`,
    );
    assert.equal(res.body.data.isnadChain.length, direct.rows.length);
    for (let i = 0; i < direct.rows.length; i++) {
      assert.equal(res.body.data.isnadChain[i].generation, direct.rows[i].generation);
    }
  });
});

describe('detail basis (PRD 5.3: words_aligned flag)', () => {
  test('single-sanad hadith reports words aligned, multi-sanad does not', async () => {
    const token = await tokenFor('basis');
    const single = await authed(token, request(app).get('/hadiths/5'));
    assert.equal(single.status, 200);
    assert.equal(single.body.data.chainStrengthBasis.words_aligned, true);
    assert.equal(
      single.body.data.chainStrengthBasis.sanad_count,
      single.body.data.hadith.sanad_count,
    );

    const multi = await pool.query<{ hadith_id: number }>(
      'SELECT hadith_id FROM corpus.hadiths WHERE sanad_count > 1 ORDER BY hadith_id LIMIT 1',
    );
    const res = await authed(token, request(app).get(`/hadiths/${multi.rows[0].hadith_id}`));
    assert.equal(res.status, 200);
    assert.equal(res.body.data.chainStrengthBasis.words_aligned, false);
  });
});

describe('GET /hadiths/strength-distribution', () => {
  test('returns 14 buckets whose counts sum to every scored hadith', async () => {
    const token = await tokenFor('distribution');
    const res = await authed(token, request(app).get('/hadiths/strength-distribution'));
    assert.equal(res.status, 200);
    const buckets = res.body.data as { bucket: number; count: number }[];
    assert.equal(buckets.length, 14);
    assert.deepEqual(
      buckets.map((b) => b.bucket),
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14],
    );
    const direct = await pool.query<{ scored: string }>(
      `SELECT count(*) AS scored FROM (
         SELECT max(strength) AS s FROM corpus.sanad_strengths GROUP BY hadith_id
       ) t WHERE s IS NOT NULL`,
    );
    assert.equal(
      buckets.reduce((n, b) => n + b.count, 0),
      Number(direct.rows[0].scored),
    );
  });
});
