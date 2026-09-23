import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../../app.js';
import { pool } from '../../db/pool.js';
import { hashPassword } from '../../lib/password.js';
import { bearer, loginAndGetToken, registerAndGetToken, uniqueEmail } from '../../testUtils/helpers.js';

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

async function registerStudent(tag: string): Promise<{ accessToken: string; userId: number }> {
  const email = uniqueEmail(tag);
  const { accessToken } = await registerAndGetToken(app, email, 'student');
  const { rows } = await pool.query<{ user_id: number }>(
    'SELECT user_id FROM app.users WHERE email = $1',
    [email],
  );
  return { accessToken, userId: rows[0].user_id };
}

async function makeCircle(teacherToken: string, tag: string): Promise<number> {
  const res = await request(app)
    .post('/circles')
    .set(bearer(teacherToken))
    .send({ name: `Circle ${tag} ${Date.now()}` });
  assert.equal(res.status, 201);
  return res.body.data.circle_id;
}

describe('GET /circles/:id', () => {
  test('owner teacher gets 200 with circle fields', async () => {
    const teacher = await verifiedTeacher('circleget');
    const circleId = await makeCircle(teacher.accessToken, 'get');

    const res = await request(app).get(`/circles/${circleId}`).set(bearer(teacher.accessToken));
    assert.equal(res.status, 200);
    assert.equal(res.body.data.circle_id, circleId);
    assert.equal(res.body.data.teacher_id, teacher.userId);
    assert.ok(typeof res.body.data.name === 'string');
    assert.ok(res.body.data.created_at);
  });

  test('nonexistent id returns 404', async () => {
    const teacher = await verifiedTeacher('circle404');
    const res = await request(app).get('/circles/2147483647').set(bearer(teacher.accessToken));
    assert.equal(res.status, 404);
  });

  test('a student outside the circle gets 404', async () => {
    const teacher = await verifiedTeacher('circleouts');
    const outsider = await registerStudent('circleoutsider');
    const circleId = await makeCircle(teacher.accessToken, 'outsider');

    const res = await request(app).get(`/circles/${circleId}`).set(bearer(outsider.accessToken));
    assert.equal(res.status, 404);
  });

  test('returns 401 without a token', async () => {
    const teacher = await verifiedTeacher('circle401');
    const circleId = await makeCircle(teacher.accessToken, 'notoken');

    const res = await request(app).get(`/circles/${circleId}`);
    assert.equal(res.status, 401);
  });
});

describe('PATCH /circles/:id', () => {
  test('owner renames the circle (200 + new name)', async () => {
    const teacher = await verifiedTeacher('circlepatch');
    const circleId = await makeCircle(teacher.accessToken, 'rename');
    const newName = `Renamed ${Date.now()}`;

    const res = await request(app)
      .patch(`/circles/${circleId}`)
      .set(bearer(teacher.accessToken))
      .send({ name: newName });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.name, newName);
    assert.equal(res.body.data.circle_id, circleId);
  });

  test('empty name returns 400', async () => {
    const teacher = await verifiedTeacher('circlepatchempty');
    const circleId = await makeCircle(teacher.accessToken, 'empty');

    const res = await request(app)
      .patch(`/circles/${circleId}`)
      .set(bearer(teacher.accessToken))
      .send({ name: '' });
    assert.equal(res.status, 400);
  });

  test('non-owning teacher gets 403', async () => {
    const owner = await verifiedTeacher('circlepatchowner');
    const intruder = await verifiedTeacher('circlepatchintruder');
    const circleId = await makeCircle(owner.accessToken, 'owned');

    const res = await request(app)
      .patch(`/circles/${circleId}`)
      .set(bearer(intruder.accessToken))
      .send({ name: 'Hijacked' });
    assert.ok(res.status === 403 || res.status === 404, `expected 403/404, got ${res.status}`);
  });
});

describe('POST /circles/:id/students + GET /circles/:id/students', () => {
  test('enrolled student is listed; a student caller gets 403', async () => {
    const teacher = await verifiedTeacher('circleenroll');
    const student = await registerStudent('circleenrollee');
    const circleId = await makeCircle(teacher.accessToken, 'enroll');

    const enrolled = await request(app)
      .post(`/circles/${circleId}/students`)
      .set(bearer(teacher.accessToken))
      .send({ student_id: student.userId });
    assert.equal(enrolled.status, 201);
    assert.equal(enrolled.body.data.circle_id, circleId);
    assert.equal(enrolled.body.data.student_id, student.userId);

    const listed = await request(app)
      .get(`/circles/${circleId}/students`)
      .set(bearer(teacher.accessToken));
    assert.equal(listed.status, 200);
    assert.ok(Array.isArray(listed.body.data));
    assert.ok(listed.body.data.some((s: { student_id: number }) => s.student_id === student.userId));

    const forbiddenPost = await request(app)
      .post(`/circles/${circleId}/students`)
      .set(bearer(student.accessToken))
      .send({ student_id: student.userId });
    assert.equal(forbiddenPost.status, 403);

    const forbiddenGet = await request(app)
      .get(`/circles/${circleId}/students`)
      .set(bearer(student.accessToken));
    assert.equal(forbiddenGet.status, 403);
  });
});

describe('DELETE /circles/:id/students/:sid', () => {
  test('removed enrollment returns 200 and the student list no longer contains them', async () => {
    const teacher = await verifiedTeacher('circleunenroll');
    const student = await registerStudent('circleleaver');
    const circleId = await makeCircle(teacher.accessToken, 'unenroll');

    const enrolled = await request(app)
      .post(`/circles/${circleId}/students`)
      .set(bearer(teacher.accessToken))
      .send({ student_id: student.userId });
    assert.equal(enrolled.status, 201);

    const removed = await request(app)
      .delete(`/circles/${circleId}/students/${student.userId}`)
      .set(bearer(teacher.accessToken));
    assert.equal(removed.status, 200);

    const listed = await request(app)
      .get(`/circles/${circleId}/students`)
      .set(bearer(teacher.accessToken));
    assert.equal(listed.status, 200);
    assert.ok(
      !listed.body.data.some((s: { student_id: number }) => s.student_id === student.userId),
      'student should no longer be listed after unenrollment',
    );
  });
});

describe('GET /circles/:id/overview', () => {
  test('owning teacher gets 200 with per-student assigned/mastered/overdue rows', async () => {
    const teacher = await verifiedTeacher('circleoverview');
    const student = await registerStudent('circleoverviewstu');
    const circleId = await makeCircle(teacher.accessToken, 'overview');

    const enrolled = await request(app)
      .post(`/circles/${circleId}/students`)
      .set(bearer(teacher.accessToken))
      .send({ student_id: student.userId });
    assert.equal(enrolled.status, 201);

    const res = await request(app)
      .get(`/circles/${circleId}/overview`)
      .set(bearer(teacher.accessToken));
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.data));
    const row = res.body.data.find(
      (r: { student_id: number }) => Number(r.student_id) === student.userId,
    );
    assert.ok(row, 'overview should contain a row for the enrolled student');
    for (const field of ['assigned', 'mastered', 'overdue'] as const) {
      assert.ok(field in row, `overview row missing ${field}`);
      assert.ok(!Number.isNaN(Number(row[field])), `${field} should be numeric`);
    }
  });
});

describe('overview mastered threshold (frontend PRD: mastery >= 3)', () => {
  test('mastery 3 counts as mastered, mastery 2 does not', async () => {
    const teacher = await verifiedTeacher('ovth');
    const student = await registerStudent('ovthstu');
    const circleId = await makeCircle(teacher.accessToken, 'ovth');
    await request(app)
      .post(`/circles/${circleId}/students`)
      .set(bearer(teacher.accessToken))
      .send({ student_id: student.userId });

    const hadith = await pool.query<{ hadith_id: number }>(
      'SELECT hadith_id FROM corpus.hadiths ORDER BY hadith_id LIMIT 1',
    );
    const setRes = await request(app)
      .post('/study-sets')
      .set(bearer(teacher.accessToken))
      .send({ name: 'ovth set' });
    const setId = setRes.body.data.study_set_id;
    await request(app)
      .post(`/study-sets/${setId}/items`)
      .set(bearer(teacher.accessToken))
      .send({ hadith_id: hadith.rows[0].hadith_id });
    await request(app)
      .post('/assignments')
      .set(bearer(teacher.accessToken))
      .send({ circle_id: circleId, study_set_id: setId, due_date: '2027-06-01' });

    const prog = await pool.query<{ progress_id: number }>(
      'SELECT progress_id FROM app.progress WHERE student_id = $1',
      [student.userId],
    );
    const progressId = prog.rows[0].progress_id;
    const mastered = async () => {
      const res = await request(app)
        .get(`/circles/${circleId}/overview`)
        .set(bearer(teacher.accessToken));
      assert.equal(res.status, 200);
      const row = res.body.data.find(
        (r: { student_id: number }) => Number(r.student_id) === student.userId,
      );
      return Number(row.mastered);
    };

    await request(app)
      .patch(`/progress/${progressId}`)
      .set(bearer(teacher.accessToken))
      .send({ mastery: 3 });
    assert.equal(await mastered(), 1);

    await request(app)
      .patch(`/progress/${progressId}`)
      .set(bearer(teacher.accessToken))
      .send({ mastery: 2 });
    assert.equal(await mastered(), 0);
  });
});
