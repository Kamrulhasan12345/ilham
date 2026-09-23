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
