import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../../app.js';
import { pool } from '../../db/pool.js';
import { bearer, registerAndGetToken, uniqueEmail } from '../../testUtils/helpers.js';

async function firstHadithId(): Promise<number> {
  const { rows } = await pool.query<{ hadith_id: number }>(
    'SELECT hadith_id FROM corpus.hadiths ORDER BY hadith_id LIMIT 1',
  );
  assert.ok(rows[0], 'expected at least one hadith in the corpus');
  return rows[0].hadith_id;
}

async function createStudySet(token: string, name: string): Promise<number> {
  const res = await request(app).post('/study-sets').set(bearer(token)).send({ name });
  assert.equal(res.status, 201);
  return res.body.data.study_set_id;
}

describe('POST /study-sets', () => {
  test('creates a set (201) with the expected fields', async () => {
    const { accessToken } = await registerAndGetToken(app, uniqueEmail('setCreate'), 'student');

    const res = await request(app)
      .post('/study-sets')
      .set(bearer(accessToken))
      .send({ name: 'Ramadan set' });
    assert.equal(res.status, 201);
    assert.equal(res.body.data.name, 'Ramadan set');
    assert.ok(typeof res.body.data.study_set_id === 'number');
    assert.ok(typeof res.body.data.owner_id === 'number');
  });

  test('empty name is rejected with 400', async () => {
    const { accessToken } = await registerAndGetToken(app, uniqueEmail('setCreateEmpty'), 'student');

    const res = await request(app)
      .post('/study-sets')
      .set(bearer(accessToken))
      .send({ name: '' });
    assert.equal(res.status, 400);
  });
});

describe('GET /study-sets', () => {
  test('lists the owner\u2019s sets; another user sees none', async () => {
    const a = await registerAndGetToken(app, uniqueEmail('setListA'), 'student');
    const b = await registerAndGetToken(app, uniqueEmail('setListB'), 'student');
    const setId = await createStudySet(a.accessToken, 'A\u2019s set');

    const listA = await request(app).get('/study-sets').set(bearer(a.accessToken));
    assert.equal(listA.status, 200);
    assert.ok(listA.body.data.some((s: { study_set_id: number }) => s.study_set_id === setId));

    const listB = await request(app).get('/study-sets').set(bearer(b.accessToken));
    assert.equal(listB.status, 200);
    assert.ok(!listB.body.data.some((s: { study_set_id: number }) => s.study_set_id === setId));
  });
});

describe('GET /study-sets/:id', () => {
  test('owner gets 200 with an items array', async () => {
    const { accessToken } = await registerAndGetToken(app, uniqueEmail('setGet'), 'student');
    const setId = await createStudySet(accessToken, 'Get me');

    const res = await request(app).get(`/study-sets/${setId}`).set(bearer(accessToken));
    assert.equal(res.status, 200);
    assert.equal(res.body.data.study_set_id, setId);
    assert.ok(Array.isArray(res.body.data.items));
  });

  test('a stranger\u2019s id returns 404, a non-numeric id returns 400', async () => {
    const a = await registerAndGetToken(app, uniqueEmail('setGetA'), 'student');
    const b = await registerAndGetToken(app, uniqueEmail('setGetB'), 'student');
    const setId = await createStudySet(a.accessToken, 'Private set');

    const stranger = await request(app).get(`/study-sets/${setId}`).set(bearer(b.accessToken));
    assert.equal(stranger.status, 404);

    const badId = await request(app).get('/study-sets/abc').set(bearer(a.accessToken));
    assert.equal(badId.status, 400);
  });
});

describe('PATCH /study-sets/:id', () => {
  test('owner renames (200); a stranger gets 404', async () => {
    const a = await registerAndGetToken(app, uniqueEmail('setPatchA'), 'student');
    const b = await registerAndGetToken(app, uniqueEmail('setPatchB'), 'student');
    const setId = await createStudySet(a.accessToken, 'Old name');

    const stranger = await request(app)
      .patch(`/study-sets/${setId}`)
      .set(bearer(b.accessToken))
      .send({ name: 'Hijacked' });
    assert.equal(stranger.status, 404);

    const res = await request(app)
      .patch(`/study-sets/${setId}`)
      .set(bearer(a.accessToken))
      .send({ name: 'New name' });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.name, 'New name');
  });
});

describe('study set items', () => {
  test('POST /study-sets/:id/items adds a hadith (201), GET shows it, DELETE removes it, second DELETE 404s', async () => {
    const { accessToken } = await registerAndGetToken(app, uniqueEmail('setItems'), 'student');
    const setId = await createStudySet(accessToken, 'Item set');
    const hadithId = await firstHadithId();

    const added = await request(app)
      .post(`/study-sets/${setId}/items`)
      .set(bearer(accessToken))
      .send({ hadith_id: hadithId });
    assert.equal(added.status, 201);
    assert.equal(added.body.data.study_set_id, setId);
    assert.equal(added.body.data.hadith_id, hadithId);

    const got = await request(app).get(`/study-sets/${setId}`).set(bearer(accessToken));
    assert.equal(got.status, 200);
    assert.ok(got.body.data.items.some((i: { hadith_id: number }) => i.hadith_id === hadithId));

    const removed = await request(app)
      .delete(`/study-sets/${setId}/items/${hadithId}`)
      .set(bearer(accessToken));
    assert.equal(removed.status, 200);

    const removedAgain = await request(app)
      .delete(`/study-sets/${setId}/items/${hadithId}`)
      .set(bearer(accessToken));
    assert.equal(removedAgain.status, 404);
  });
});

describe('DELETE /study-sets/:id', () => {
  test('owner deletes (200); GET after delete returns 404', async () => {
    const { accessToken } = await registerAndGetToken(app, uniqueEmail('setDelete'), 'student');
    const setId = await createStudySet(accessToken, 'Doomed set');

    const del = await request(app).delete(`/study-sets/${setId}`).set(bearer(accessToken));
    assert.equal(del.status, 200);

    const got = await request(app).get(`/study-sets/${setId}`).set(bearer(accessToken));
    assert.equal(got.status, 404);
  });
});

describe('set item repeats (PRD 5.7: 409 on a repeat)', () => {
  test('adding the same hadith twice returns 409 the second time', async () => {
    const email = uniqueEmail('itemrepeat');
    const { accessToken } = await registerAndGetToken(app, email, 'teacher');
    const setRes = await request(app)
      .post('/study-sets')
      .set(bearer(accessToken))
      .send({ name: 'repeat set' });
    const setId = setRes.body.data.study_set_id;
    const hadith = await pool.query<{ hadith_id: number }>(
      'SELECT hadith_id FROM corpus.hadiths ORDER BY hadith_id LIMIT 1',
    );
    const first = await request(app)
      .post(`/study-sets/${setId}/items`)
      .set(bearer(accessToken))
      .send({ hadith_id: hadith.rows[0].hadith_id });
    assert.equal(first.status, 201);
    const second = await request(app)
      .post(`/study-sets/${setId}/items`)
      .set(bearer(accessToken))
      .send({ hadith_id: hadith.rows[0].hadith_id });
    assert.equal(second.status, 409);
  });
});
