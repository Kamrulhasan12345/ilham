import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../../app.js';
import { pool } from '../../db/pool.js';
import { bearer, loginAndGetToken, registerAndGetToken, uniqueEmail } from '../../testUtils/helpers.js';
import { hashPassword } from '../../lib/password.js';

async function firstHadithId(): Promise<number> {
  const { rows } = await pool.query<{ hadith_id: number }>(
    'SELECT hadith_id FROM corpus.hadiths ORDER BY hadith_id LIMIT 1',
  );
  assert.ok(rows[0], 'expected at least one hadith in the corpus');
  return rows[0].hadith_id;
}

async function createStudySet(token: string, name: string): Promise<number> {
  const res = await request(app).post('/sets').set(bearer(token)).send({ name });
  assert.equal(res.status, 201);
  return res.body.data.study_set_id;
}

describe('POST /sets', () => {
  test('creates a set (201) with the expected fields', async () => {
    const { accessToken } = await registerAndGetToken(app, uniqueEmail('setCreate'), 'student');

    const res = await request(app)
      .post('/sets')
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
      .post('/sets')
      .set(bearer(accessToken))
      .send({ name: '' });
    assert.equal(res.status, 400);
  });
});

describe('GET /sets', () => {
  test('lists the owner\u2019s sets; another user sees none', async () => {
    const a = await registerAndGetToken(app, uniqueEmail('setListA'), 'student');
    const b = await registerAndGetToken(app, uniqueEmail('setListB'), 'student');
    const setId = await createStudySet(a.accessToken, 'A\u2019s set');

    const listA = await request(app).get('/sets').set(bearer(a.accessToken));
    assert.equal(listA.status, 200);
    assert.ok(listA.body.data.some((s: { study_set_id: number }) => s.study_set_id === setId));

    const listB = await request(app).get('/sets').set(bearer(b.accessToken));
    assert.equal(listB.status, 200);
    assert.ok(!listB.body.data.some((s: { study_set_id: number }) => s.study_set_id === setId));
  });
});

describe('GET /sets/:id', () => {
  test('owner gets 200 with an items array', async () => {
    const { accessToken } = await registerAndGetToken(app, uniqueEmail('setGet'), 'student');
    const setId = await createStudySet(accessToken, 'Get me');

    const res = await request(app).get(`/sets/${setId}`).set(bearer(accessToken));
    assert.equal(res.status, 200);
    assert.equal(res.body.data.study_set_id, setId);
    assert.ok(Array.isArray(res.body.data.items));
  });

  test('a stranger\u2019s id returns 404, a non-numeric id returns 400', async () => {
    const a = await registerAndGetToken(app, uniqueEmail('setGetA'), 'student');
    const b = await registerAndGetToken(app, uniqueEmail('setGetB'), 'student');
    const setId = await createStudySet(a.accessToken, 'Private set');

    const stranger = await request(app).get(`/sets/${setId}`).set(bearer(b.accessToken));
    assert.equal(stranger.status, 404);

    const badId = await request(app).get('/sets/abc').set(bearer(a.accessToken));
    assert.equal(badId.status, 400);
  });
});

describe('PATCH /sets/:id', () => {
  test('owner renames (200); a stranger gets 404', async () => {
    const a = await registerAndGetToken(app, uniqueEmail('setPatchA'), 'student');
    const b = await registerAndGetToken(app, uniqueEmail('setPatchB'), 'student');
    const setId = await createStudySet(a.accessToken, 'Old name');

    const stranger = await request(app)
      .patch(`/sets/${setId}`)
      .set(bearer(b.accessToken))
      .send({ name: 'Hijacked' });
    assert.equal(stranger.status, 404);

    const res = await request(app)
      .patch(`/sets/${setId}`)
      .set(bearer(a.accessToken))
      .send({ name: 'New name' });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.name, 'New name');
  });
});

describe('study set items', () => {
  test('POST /sets/:id/items adds a hadith (201), GET shows it, DELETE removes it, second DELETE 404s', async () => {
    const { accessToken } = await registerAndGetToken(app, uniqueEmail('setItems'), 'student');
    const setId = await createStudySet(accessToken, 'Item set');
    const hadithId = await firstHadithId();

    const added = await request(app)
      .post(`/sets/${setId}/items`)
      .set(bearer(accessToken))
      .send({ hadith_id: hadithId });
    assert.equal(added.status, 201);
    assert.equal(added.body.data.study_set_id, setId);
    assert.equal(added.body.data.hadith_id, hadithId);

    const got = await request(app).get(`/sets/${setId}`).set(bearer(accessToken));
    assert.equal(got.status, 200);
    assert.ok(got.body.data.items.some((i: { hadith_id: number }) => i.hadith_id === hadithId));

    const removed = await request(app)
      .delete(`/sets/${setId}/items/${hadithId}`)
      .set(bearer(accessToken));
    assert.equal(removed.status, 200);

    const removedAgain = await request(app)
      .delete(`/sets/${setId}/items/${hadithId}`)
      .set(bearer(accessToken));
    assert.equal(removedAgain.status, 404);
  });
});

describe('DELETE /sets/:id', () => {
  test('owner deletes (200); GET after delete returns 404', async () => {
    const { accessToken } = await registerAndGetToken(app, uniqueEmail('setDelete'), 'student');
    const setId = await createStudySet(accessToken, 'Doomed set');

    const del = await request(app).delete(`/sets/${setId}`).set(bearer(accessToken));
    assert.equal(del.status, 200);

    const got = await request(app).get(`/sets/${setId}`).set(bearer(accessToken));
    assert.equal(got.status, 404);
  });
});

describe('set item repeats (PRD 5.7: 409 on a repeat)', () => {
  test('adding the same hadith twice returns 409 the second time', async () => {
    const email = uniqueEmail('itemrepeat');
    const { accessToken } = await registerAndGetToken(app, email, 'teacher');
    const setRes = await request(app)
      .post('/sets')
      .set(bearer(accessToken))
      .send({ name: 'repeat set' });
    const setId = setRes.body.data.study_set_id;
    const hadith = await pool.query<{ hadith_id: number }>(
      'SELECT hadith_id FROM corpus.hadiths ORDER BY hadith_id LIMIT 1',
    );
    const first = await request(app)
      .post(`/sets/${setId}/items`)
      .set(bearer(accessToken))
      .send({ hadith_id: hadith.rows[0].hadith_id });
    assert.equal(first.status, 201);
    const second = await request(app)
      .post(`/sets/${setId}/items`)
      .set(bearer(accessToken))
      .send({ hadith_id: hadith.rows[0].hadith_id });
    assert.equal(second.status, 409);
  });
});

describe('GET /sets/:id -- assigned-student read access', () => {
  async function verifiedTeacher(tag: string): Promise<{ accessToken: string; userId: number }> {
    const email = uniqueEmail(tag);
    const { accessToken } = await registerAndGetToken(app, email, 'teacher');
    const { rows } = await pool.query<{ user_id: number }>(
      'SELECT user_id FROM app.users WHERE email = $1',
      [email],
    );
    const adminEmail = uniqueEmail(`${tag}admin`);
    await pool.query(
      `INSERT INTO app.admins (email, password_hash, full_name, role, admin_level)
       VALUES ($1, $2, 'Flow Admin', 'admin', 'super')`,
      [adminEmail, await hashPassword('password123')],
    );
    const adminToken = await loginAndGetToken(app, adminEmail);
    await request(app).post(`/teachers/${rows[0].user_id}/verify`).set(bearer(adminToken));
    return { accessToken, userId: rows[0].user_id };
  }

  async function assignedSetup(tag: string) {
    const teacher = await verifiedTeacher(`${tag}t`);
    const studentEmail = uniqueEmail(`${tag}s`);
    const { accessToken: studentToken } = await registerAndGetToken(app, studentEmail, 'student');
    const { rows: stu } = await pool.query<{ user_id: number }>(
      'SELECT user_id FROM app.users WHERE email = $1',
      [studentEmail],
    );
    const circle = await request(app)
      .post('/circles')
      .set(bearer(teacher.accessToken))
      .send({ name: `Circle ${tag}` });
    const setId = await createStudySet(teacher.accessToken, `Set ${tag}`);
    await request(app)
      .post(`/sets/${setId}/items`)
      .set(bearer(teacher.accessToken))
      .send({ hadith_id: await firstHadithId() });
    await request(app)
      .post(`/circles/${circle.body.data.circle_id}/students`)
      .set(bearer(teacher.accessToken))
      .send({ student_id: stu[0].user_id });
    const assigned = await request(app)
      .post('/assignments')
      .set(bearer(teacher.accessToken))
      .send({
        circle_id: circle.body.data.circle_id,
        study_set_id: setId,
        due_date: '2027-06-01',
      });
    assert.equal(assigned.status, 201);
    return { teacher, studentToken, studentId: stu[0].user_id, setId };
  }

  test('an enrolled student reads the assigned set with its items', async () => {
    const { studentToken, setId } = await assignedSetup('assignedread');

    const res = await request(app).get(`/sets/${setId}`).set(bearer(studentToken));
    assert.equal(res.status, 200);
    assert.equal(res.body.data.study_set_id, setId);
    assert.ok(Array.isArray(res.body.data.items));
    assert.equal(res.body.data.items.length, 1);
  });

  test('a student outside the circle gets 404, and writes stay owner-only', async () => {
    const { setId } = await assignedSetup('assignedstranger');
    const { accessToken: outsiderToken } = await registerAndGetToken(
      app,
      uniqueEmail('assignedoutsider'),
      'student',
    );

    const res = await request(app).get(`/sets/${setId}`).set(bearer(outsiderToken));
    assert.equal(res.status, 404);

    const patch = await request(app)
      .patch(`/sets/${setId}`)
      .set(bearer(outsiderToken))
      .send({ name: 'Hijacked' });
    assert.equal(patch.status, 404);

    const del = await request(app).delete(`/sets/${setId}`).set(bearer(outsiderToken));
    assert.equal(del.status, 404);
  });
});
