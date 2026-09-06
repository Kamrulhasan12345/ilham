import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from './app.js';
import { pool } from './db/pool.js';
import { hashPassword } from './lib/password.js';
import { bearer, loginAndGetToken, registerAndGetToken, uniqueEmail } from './testUtils/helpers.js';


async function seedAdmin(tag: string): Promise<{ email: string; token: string }> {
  const email = uniqueEmail(tag);
  await pool.query(
    `INSERT INTO app.admins (email, password_hash, full_name, role, admin_level)
     VALUES ($1, $2, 'Seeded Admin', 'admin', 'super')`,
    [email, await hashPassword('password123')],
  );
  const token = await loginAndGetToken(app, email);
  return { email, token };
}

describe('unauthenticated requests get 401', () => {
  const routes: Array<['get' | 'post', string]> = [
    ['get', '/circles'],
    ['post', '/circles'],
    ['get', '/notes'],
    ['get', '/students'],
    ['get', '/teachers/unverified'],
    ['get', '/study-sets'],
    ['get', '/assignments'],
    ['get', '/review-sessions'],
    ['get', '/progress'],
  ];

  for (const [method, path] of routes) {
    test(`${method.toUpperCase()} ${path} without a token`, async () => {
      const res = method === 'get' ? await request(app).get(path) : await request(app).post(path);
      assert.equal(res.status, 401);
      assert.equal(res.body.error.code, 'unauthenticated');
    });
  }
});

describe('cross-role access is blocked with 403', () => {
  test('a student cannot open a circle (teacher-only)', async () => {
    const { accessToken } = await registerAndGetToken(app, uniqueEmail('stud'), 'student');
    const res = await request(app)
      .post('/circles')
      .set(bearer(accessToken))
      .send({ name: 'Sneaky circle' });
    assert.equal(res.status, 403);
  });

  test('a student cannot read the teacher verification queue (admin-only)', async () => {
    const { accessToken } = await registerAndGetToken(app, uniqueEmail('stud2'), 'student');
    const res = await request(app).get('/teachers/unverified').set(bearer(accessToken));
    assert.equal(res.status, 403);
  });

  test('a teacher cannot read the verification queue either', async () => {
    const { accessToken } = await registerAndGetToken(app, uniqueEmail('teach'), 'teacher');
    const res = await request(app).get('/teachers/unverified').set(bearer(accessToken));
    assert.equal(res.status, 403);
  });

  test('an unverified teacher cannot open a circle yet', async () => {
    const { accessToken } = await registerAndGetToken(app, uniqueEmail('teach2'), 'teacher');
    const res = await request(app)
      .post('/circles')
      .set(bearer(accessToken))
      .send({ name: 'Too early' });
    assert.equal(res.status, 403);
    assert.equal(res.body.error.code, 'teacher_not_verified');
  });

  test('a student cannot assign a study set (teacher/admin-only route guard)', async () => {
    const { accessToken } = await registerAndGetToken(app, uniqueEmail('studassign'), 'student');
    const res = await request(app)
      .post('/assignments')
      .set(bearer(accessToken))
      .send({ circle_id: 1, study_set_id: 1, due_date: '2026-12-31' });
    assert.equal(res.status, 403);
  });
});

describe('object-level ownership on notes', () => {
  test("one student cannot read, change, or delete another student's note", async () => {
    const a = await registerAndGetToken(app, uniqueEmail('noteA'), 'student');
    const b = await registerAndGetToken(app, uniqueEmail('noteB'), 'student');

    const { rows: hadithRows } = await pool.query<{ hadith_id: number }>(
      'SELECT hadith_id FROM corpus.hadiths ORDER BY hadith_id LIMIT 1',
    );
    assert.ok(hadithRows[0], 'expected at least one hadith in the corpus');
    const hadithId = hadithRows[0].hadith_id;

    const created = await request(app)
      .post(`/hadiths/${hadithId}/notes`)
      .set(bearer(a.accessToken))
      .send({ body: 'private note' });
    assert.equal(created.status, 201);
    const noteId = created.body.data.note_id;

    const listB = await request(app).get(`/hadiths/${hadithId}/notes`).set(bearer(b.accessToken));
    assert.equal(listB.status, 200);
    assert.ok(!listB.body.data.some((n: { note_id: number }) => n.note_id === noteId));

    const patch = await request(app)
      .patch(`/notes/${noteId}`)
      .set(bearer(b.accessToken))
      .send({ body: 'hijacked' });
    assert.equal(patch.status, 404);

    const del = await request(app).delete(`/notes/${noteId}`).set(bearer(b.accessToken));
    assert.equal(del.status, 404);

    const ownPatch = await request(app)
      .patch(`/notes/${noteId}`)
      .set(bearer(a.accessToken))
      .send({ body: 'edited by owner' });
    assert.equal(ownPatch.status, 200);
  });
});

describe('object-level ownership on study sets', () => {
  test("one user's study set is invisible (404) to another user, even a teacher", async () => {
    const owner = await registerAndGetToken(app, uniqueEmail('setowner'), 'student');
    const other = await registerAndGetToken(app, uniqueEmail('setother'), 'teacher');

    const created = await request(app)
      .post('/study-sets')
      .set(bearer(owner.accessToken))
      .send({ name: 'My private set' });
    assert.equal(created.status, 201);
    const setId = created.body.data.study_set_id;

    const getOther = await request(app).get(`/study-sets/${setId}`).set(bearer(other.accessToken));
    assert.equal(getOther.status, 404);

    const getOwn = await request(app).get(`/study-sets/${setId}`).set(bearer(owner.accessToken));
    assert.equal(getOwn.status, 200);
  });

  test('adding the same hadith to a study set twice returns 409 on the repeat', async () => {
    const owner = await registerAndGetToken(app, uniqueEmail('setdup'), 'student');
    const { rows: hadithRows } = await pool.query<{ hadith_id: number }>(
      'SELECT hadith_id FROM corpus.hadiths ORDER BY hadith_id LIMIT 1',
    );
    const hadithId = hadithRows[0].hadith_id;

    const created = await request(app)
      .post('/study-sets')
      .set(bearer(owner.accessToken))
      .send({ name: 'Dup test set' });
    const setId = created.body.data.study_set_id;

    const first = await request(app)
      .post(`/study-sets/${setId}/items`)
      .set(bearer(owner.accessToken))
      .send({ hadith_id: hadithId });
    assert.equal(first.status, 201);

    const second = await request(app)
      .post(`/study-sets/${setId}/items`)
      .set(bearer(owner.accessToken))
      .send({ hadith_id: hadithId });
    assert.equal(second.status, 409);
  });
});

describe('teachers and admins can list students, students cannot', () => {
  test('a new student starts at beginner level', async () => {
    const teacher = await registerAndGetToken(app, uniqueEmail('teachlvl'), 'teacher');
    const studentEmail = uniqueEmail('studlvl');
    await registerAndGetToken(app, studentEmail, 'student');

    const res = await request(app).get('/students').set(bearer(teacher.accessToken));
    assert.equal(res.status, 200);
    const row = res.body.data.find((s: { email: string }) => s.email === studentEmail);
    assert.ok(row, 'expected the new student in the teacher list');
    assert.equal(row.student_level, 'beginner');
  });

  test('teacher and admin get 200, student gets 403', async () => {
    const teacher = await registerAndGetToken(app, uniqueEmail('teachlist'), 'teacher');
    const student = await registerAndGetToken(app, uniqueEmail('studlist'), 'student');
    const admin = await seedAdmin('adminlist');

    for (const token of [teacher.accessToken, admin.token]) {
      const res = await request(app).get('/students').set(bearer(token));
      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.body.data));
    }

    const denied = await request(app).get('/students').set(bearer(student.accessToken));
    assert.equal(denied.status, 403);
  });
});

describe('every role can log in, and the verified-teacher flow works end to end', () => {
  test('admin (seeded in app.admins) -> verify teacher -> teacher opens circle -> enrolls a student -> assigns a study set', async () => {
    const admin = await seedAdmin('adminflow');

    const me = await request(app).get('/auth/me').set(bearer(admin.token));
    assert.equal(me.status, 200);
    assert.equal(me.body.data.role, 'admin');

    const teacherEmail = uniqueEmail('teachflow');
    const teacher = await registerAndGetToken(app, teacherEmail, 'teacher');
    const { rows } = await pool.query<{ user_id: number }>(
      'SELECT user_id FROM app.users WHERE email = $1',
      [teacherEmail],
    );
    const teacherId = rows[0].user_id;

    const queue = await request(app).get('/teachers/unverified').set(bearer(admin.token));
    assert.equal(queue.status, 200);
    assert.ok(queue.body.data.some((t: { user_id: number }) => t.user_id === teacherId));

    const verify = await request(app).post(`/teachers/${teacherId}/verify`).set(bearer(admin.token));
    assert.equal(verify.status, 200);

    const circle = await request(app)
      .post('/circles')
      .set(bearer(teacher.accessToken))
      .send({ name: 'First halaqa' });
    assert.equal(circle.status, 201);
    const circleId = circle.body.data.circle_id;

    const list = await request(app).get('/circles').set(bearer(teacher.accessToken));
    assert.ok(list.body.data.some((c: { name: string }) => c.name === 'First halaqa'));

    const studentEmail = uniqueEmail('enrollflow');
    await registerAndGetToken(app, studentEmail, 'student');
    const { rows: studentRows } = await pool.query<{ user_id: number }>(
      'SELECT user_id FROM app.users WHERE email = $1',
      [studentEmail],
    );
    const studentId = studentRows[0].user_id;

    const enroll = await request(app)
      .post(`/circles/${circleId}/students`)
      .set(bearer(teacher.accessToken))
      .send({ student_id: studentId });
    assert.equal(enroll.status, 201);

    const enrollAgain = await request(app)
      .post(`/circles/${circleId}/students`)
      .set(bearer(teacher.accessToken))
      .send({ student_id: studentId });
    assert.equal(enrollAgain.status, 409);

    const studySet = await request(app)
      .post('/study-sets')
      .set(bearer(teacher.accessToken))
      .send({ name: 'Flow study set' });
    assert.equal(studySet.status, 201);
    const studySetId = studySet.body.data.study_set_id;

    const assignment = await request(app)
      .post('/assignments')
      .set(bearer(teacher.accessToken))
      .send({ circle_id: circleId, study_set_id: studySetId, due_date: '2027-01-01' });
    assert.equal(assignment.status, 201);
  });

  test('a verified teacher can create a circle immediately, no queue wait', async () => {
    const admin = await seedAdmin('adminflow2');
    const teacherEmail = uniqueEmail('preverified');
    const teacher = await registerAndGetToken(app, teacherEmail, 'teacher');
    const { rows } = await pool.query<{ user_id: number }>(
      'SELECT user_id FROM app.users WHERE email = $1',
      [teacherEmail],
    );
    await request(app).post(`/teachers/${rows[0].user_id}/verify`).set(bearer(admin.token));

    const circle = await request(app)
      .post('/circles')
      .set(bearer(teacher.accessToken))
      .send({ name: 'Immediate circle' });
    assert.equal(circle.status, 201);
  });
});
