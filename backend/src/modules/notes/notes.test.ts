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

async function createNote(token: string, hadithId: number, body: string): Promise<number> {
  const res = await request(app)
    .post('/notes')
    .set(bearer(token))
    .send({ hadith_id: hadithId, body });
  assert.equal(res.status, 201);
  return res.body.data.note_id;
}

describe('PATCH /notes/:id', () => {
  test('owner updates body (200)', async () => {
    const { accessToken } = await registerAndGetToken(app, uniqueEmail('notePatch'), 'student');
    const hadithId = await firstHadithId();
    const noteId = await createNote(accessToken, hadithId, 'original body');

    const res = await request(app)
      .patch(`/notes/${noteId}`)
      .set(bearer(accessToken))
      .send({ body: 'edited body' });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.note_id, noteId);
    assert.equal(res.body.data.body, 'edited body');
  });

  test('empty body is rejected with 400', async () => {
    const { accessToken } = await registerAndGetToken(app, uniqueEmail('notePatchEmpty'), 'student');
    const hadithId = await firstHadithId();
    const noteId = await createNote(accessToken, hadithId, 'keep me');

    const res = await request(app)
      .patch(`/notes/${noteId}`)
      .set(bearer(accessToken))
      .send({ body: '' });
    assert.equal(res.status, 400);
  });

  test('nonexistent id returns 404', async () => {
    const { accessToken } = await registerAndGetToken(app, uniqueEmail('notePatchMissing'), 'student');

    const res = await request(app)
      .patch('/notes/999999999')
      .set(bearer(accessToken))
      .send({ body: 'no such note' });
    assert.equal(res.status, 404);
  });

  test("another user's note id returns 404, not 403 (ownership)", async () => {
    const a = await registerAndGetToken(app, uniqueEmail('notePatchA'), 'student');
    const b = await registerAndGetToken(app, uniqueEmail('notePatchB'), 'student');
    const hadithId = await firstHadithId();
    const noteId = await createNote(a.accessToken, hadithId, 'private note');

    const res = await request(app)
      .patch(`/notes/${noteId}`)
      .set(bearer(b.accessToken))
      .send({ body: 'hijacked' });
    assert.equal(res.status, 404);
  });
});

describe('DELETE /notes/:id', () => {
  test('deleted note is gone: list no longer shows it and PATCH after delete 404s', async () => {
    const { accessToken } = await registerAndGetToken(app, uniqueEmail('noteDelete'), 'student');
    const hadithId = await firstHadithId();
    const noteId = await createNote(accessToken, hadithId, 'soon gone');

    // There is no GET /notes/:id route; "gone" means absent from GET /notes
    // and unreachable by id (PATCH on the deleted id 404s).
    const del = await request(app).delete(`/notes/${noteId}`).set(bearer(accessToken));
    assert.equal(del.status, 200);

    const list = await request(app).get('/notes').set(bearer(accessToken));
    assert.equal(list.status, 200);
    assert.ok(!list.body.data.some((n: { note_id: number }) => n.note_id === noteId));

    const patch = await request(app)
      .patch(`/notes/${noteId}`)
      .set(bearer(accessToken))
      .send({ body: 'resurrect' });
    assert.equal(patch.status, 404);
  });

  test('deleting a nonexistent id returns 404', async () => {
    const { accessToken } = await registerAndGetToken(app, uniqueEmail('noteDeleteMissing'), 'student');

    const res = await request(app).delete('/notes/999999999').set(bearer(accessToken));
    assert.equal(res.status, 404);
  });

  test('list shows only the caller\u2019s notes', async () => {
    const a = await registerAndGetToken(app, uniqueEmail('noteListA'), 'student');
    const b = await registerAndGetToken(app, uniqueEmail('noteListB'), 'student');
    const hadithId = await firstHadithId();
    const noteId = await createNote(a.accessToken, hadithId, 'a private note');

    const listB = await request(app).get('/notes').set(bearer(b.accessToken));
    assert.equal(listB.status, 200);
    assert.ok(!listB.body.data.some((n: { note_id: number }) => n.note_id === noteId));

    const listA = await request(app).get('/notes').set(bearer(a.accessToken));
    assert.equal(listA.status, 200);
    assert.ok(listA.body.data.some((n: { note_id: number }) => n.note_id === noteId));
  });
});
