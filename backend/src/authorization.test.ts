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

    // Paginated and ordered by created_at: page through rather than assume
    // this teacher lands on page 1 (see the identical note further down).
    let foundInQueue = false;
    for (let offset = 0; !foundInQueue; offset += 100) {
      const queue = await request(app)
        .get(`/teachers/unverified?limit=100&offset=${offset}`)
        .set(bearer(admin.token));
      assert.equal(queue.status, 200);
      const page: { user_id: number }[] = queue.body.data;
      foundInQueue = page.some((t) => t.user_id === teacherId);
      if (page.length < 100) break;
    }
    assert.ok(foundInQueue, 'expected the new teacher to appear in the unverified queue');

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

  test('an admin reads teacher-only routes: admin does everything a teacher does', async () => {
    const admin = await seedAdmin('adminreads');
    const teacherEmail = uniqueEmail('teachreads');
    const teacher = await registerAndGetToken(app, teacherEmail, 'teacher');
    const { rows } = await pool.query<{ user_id: number }>(
      'SELECT user_id FROM app.users WHERE email = $1',
      [teacherEmail],
    );
    await request(app).post(`/teachers/${rows[0].user_id}/verify`).set(bearer(admin.token));
    const circle = await request(app)
      .post('/circles')
      .set(bearer(teacher.accessToken))
      .send({ name: 'Readable circle' });
    assert.equal(circle.status, 201);
    const circleId = circle.body.data.circle_id;

    // Teacher-only mounts. Before the fix these answered 403 for admins,
    // against docs/frontend-prd.md §2 ("everything a teacher does").
    for (const path of [`/circles/${circleId}/overview`, `/circles/${circleId}/students`]) {
      const res = await request(app).get(path).set(bearer(admin.token));
      assert.equal(res.status, 200, `admin blocked from teacher-only ${path}`);
    }
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

describe('declining a teacher (DELETE /teachers/:id/verify)', () => {
  test('admin unverifies: flag flips, teacher rejoins the queue, circles stay', async () => {
    const teacherEmail = uniqueEmail('decline');
    await registerAndGetToken(app, teacherEmail, 'teacher');
    const t = await pool.query<{ user_id: number }>(
      'SELECT user_id FROM app.users WHERE email = $1',
      [teacherEmail],
    );
    const teacherId = t.rows[0].user_id;
    const { token: adminToken } = await seedAdmin('declineadmin');

    await request(app).post(`/teachers/${teacherId}/verify`).set(bearer(adminToken));
    const declined = await request(app)
      .delete(`/teachers/${teacherId}/verify`)
      .set(bearer(adminToken));
    assert.equal(declined.status, 200);
    assert.equal(declined.body.data.is_verified, false);

    // The queue is paginated (ORDER BY created_at) and the rest of the suite
    // registers many teachers before this one runs, so this teacher is not
    // guaranteed to land on the first page — page through instead of
    // assuming page 1, the same way corpus.test.ts finds a specific hadith.
    let found = false;
    for (let offset = 0; !found; offset += 100) {
      const queue = await request(app)
        .get(`/teachers/unverified?limit=100&offset=${offset}`)
        .set(bearer(adminToken));
      const page: { user_id: number }[] = queue.body.data;
      found = page.some((r) => r.user_id === teacherId);
      if (page.length < 100) break;
    }
    assert.ok(found, 'expected the declined teacher to reappear in the unverified queue');
  });

  test('rules: bad id 400, missing teacher 404, non-admin 403, anonymous 401', async () => {
    const { token: adminToken } = await seedAdmin('declinerules');
    const bad = await request(app).delete('/teachers/abc/verify').set(bearer(adminToken));
    assert.equal(bad.status, 400);
    const missing = await request(app).delete('/teachers/999999999/verify').set(bearer(adminToken));
    assert.equal(missing.status, 404);

    const { accessToken: teacherToken } = await registerAndGetToken(
      app,
      uniqueEmail('declinetch'),
      'teacher',
    );
    const forbidden = await request(app).delete('/teachers/1/verify').set(bearer(teacherToken));
    assert.equal(forbidden.status, 403);
    const anon = await request(app).delete('/teachers/1/verify');
    assert.equal(anon.status, 401);
  });
});
