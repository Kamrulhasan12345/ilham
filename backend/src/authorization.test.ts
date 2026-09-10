import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from './app.js';
import { pool } from './db/pool.js';
import { hashPassword } from './lib/password.js';
import { bearer, loginAndGetToken, registerAndGetToken, uniqueEmail } from './testUtils/helpers.js';

// The 60% evaluation checks, against the real dev database:
// - 401 for unauthenticated requests,
// - 403 when a role touches another role's capability,
// - object-level ownership (one user's note is invisible to another),
// - login as every role, including an admin created directly in app.admins
//   (admins never self-register: POST /auth/register rejects role "admin").

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
});

describe('object-level ownership on notes', () => {
  test("one student cannot read, change, or delete another student's note", async () => {
    const a = await registerAndGetToken(app, uniqueEmail('noteA'), 'student');
    const b = await registerAndGetToken(app, uniqueEmail('noteB'), 'student');

    // hadith_id 1 does not exist in every database; read a real one.
    const { rows: hadithRows } = await pool.query<{ hadith_id: number }>(
      'SELECT hadith_id FROM corpus.hadiths ORDER BY hadith_id LIMIT 1',
    );
    assert.ok(hadithRows[0], 'expected at least one hadith in the corpus');
    const hadithId = hadithRows[0].hadith_id;

    const created = await request(app)
      .post('/notes')
      .set(bearer(a.accessToken))
      .send({ hadith_id: hadithId, body: 'private note' });
    assert.equal(created.status, 201);
    const noteId = created.body.data.note_id;

    // B's list does not contain A's note.
    const listB = await request(app).get('/notes').set(bearer(b.accessToken));
    assert.equal(listB.status, 200);
    assert.ok(!listB.body.data.some((n: { note_id: number }) => n.note_id === noteId));

    // B touching A's note by id gets 404, not 403: the response never
    // confirms the row exists.
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
  test('admin (seeded in app.admins) -> verify teacher -> teacher opens circle', async () => {
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

    const list = await request(app).get('/circles').set(bearer(teacher.accessToken));
    assert.ok(list.body.data.some((c: { name: string }) => c.name === 'First halaqa'));
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
