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
  return rows[0].hadith_id;
}

async function registerAndGetUserId(
  email: string,
  role: 'student' | 'teacher',
): Promise<{ accessToken: string; userId: number }> {
  const { accessToken } = await registerAndGetToken(app, email, role);
  const { rows } = await pool.query<{ user_id: number }>(
    'SELECT user_id FROM app.users WHERE email = $1',
    [email],
  );
  return { accessToken, userId: rows[0].user_id };
}

describe('POST /review-sessions -- request validation', () => {
  test('rejects a body missing student_id with 400', async () => {
    const student = await registerAndGetUserId(uniqueEmail('missingid'), 'student');
    const hadithId = await firstHadithId();

    const res = await request(app)
      .post('/review-sessions')
      .set(bearer(student.accessToken))
      .send({ items: [{ hadith_id: hadithId, result: 'pass' }] });
    assert.equal(res.status, 400);
  });

  test('a student may not submit a review session for a different student_id', async () => {
    const a = await registerAndGetUserId(uniqueEmail('reviewA'), 'student');
    const b = await registerAndGetUserId(uniqueEmail('reviewB'), 'student');
    const hadithId = await firstHadithId();

    const res = await request(app)
      .post('/review-sessions')
      .set(bearer(a.accessToken))
      .send({ student_id: b.userId, items: [{ hadith_id: hadithId, result: 'pass' }] });
    assert.equal(res.status, 400);
  });
});

describe('POST /review-sessions -- self-study (no assignment_id) writes app.progress correctly', () => {
  test('a pass on a fresh self-study hadith sets mastery=1, times_reviewed=1, assignment_id=null', async () => {
    const student = await registerAndGetUserId(uniqueEmail('selfpass'), 'student');
    const hadithId = await firstHadithId();

    const res = await request(app)
      .post('/review-sessions')
      .set(bearer(student.accessToken))
      .send({ student_id: student.userId, items: [{ hadith_id: hadithId, result: 'pass' }] });
    assert.equal(res.status, 201);

    const { rows } = await pool.query(
      `SELECT mastery, times_reviewed, assignment_id FROM app.progress
        WHERE student_id = $1 AND hadith_id = $2 AND assignment_id IS NULL`,
      [student.userId, hadithId],
    );
    assert.equal(rows.length, 1, 'expected exactly one self-study progress row');
    assert.equal(rows[0].mastery, 1);
    assert.equal(rows[0].times_reviewed, 1);
    assert.equal(rows[0].assignment_id, null);
  });

  test('mastery rule: pass increments (capped at 4), partial holds, fail decrements (floored at 0)', async () => {
    const student = await registerAndGetUserId(uniqueEmail('masteryrule'), 'student');
    const hadithId = await firstHadithId();

    for (let i = 0; i < 5; i++) {
      const res = await request(app)
        .post('/review-sessions')
        .set(bearer(student.accessToken))
        .send({ student_id: student.userId, items: [{ hadith_id: hadithId, result: 'pass' }] });
      assert.equal(res.status, 201);
    }
    let { rows } = await pool.query(
      `SELECT mastery, times_reviewed FROM app.progress
        WHERE student_id = $1 AND hadith_id = $2 AND assignment_id IS NULL`,
      [student.userId, hadithId],
    );
    assert.equal(rows[0].mastery, 4, 'mastery must cap at 4, not keep climbing');
    assert.equal(
      rows[0].times_reviewed,
      5,
      'times_reviewed increments on every result, including a capped pass',
    );

    await request(app)
      .post('/review-sessions')
      .set(bearer(student.accessToken))
      .send({ student_id: student.userId, items: [{ hadith_id: hadithId, result: 'partial' }] });
    ({ rows } = await pool.query(
      `SELECT mastery, times_reviewed FROM app.progress
        WHERE student_id = $1 AND hadith_id = $2 AND assignment_id IS NULL`,
      [student.userId, hadithId],
    ));
    assert.equal(rows[0].mastery, 4, 'partial must not change mastery');
    assert.equal(rows[0].times_reviewed, 6);

    for (let i = 0; i < 5; i++) {
      await request(app)
        .post('/review-sessions')
        .set(bearer(student.accessToken))
        .send({ student_id: student.userId, items: [{ hadith_id: hadithId, result: 'fail' }] });
    }
    ({ rows } = await pool.query(
      `SELECT mastery, times_reviewed FROM app.progress
        WHERE student_id = $1 AND hadith_id = $2 AND assignment_id IS NULL`,
      [student.userId, hadithId],
    ));
    assert.equal(rows[0].mastery, 0, 'mastery must floor at 0, not go negative');
    assert.equal(rows[0].times_reviewed, 11);
  });

  test('a review session with multiple items updates a progress row for each hadith', async () => {
    const student = await registerAndGetUserId(uniqueEmail('multiitem'), 'student');
    const { rows: hadithRows } = await pool.query<{ hadith_id: number }>(
      'SELECT hadith_id FROM corpus.hadiths ORDER BY hadith_id LIMIT 2',
    );
    if (hadithRows.length < 2) return;

    const [h1, h2] = hadithRows.map((r) => r.hadith_id);
    const res = await request(app)
      .post('/review-sessions')
      .set(bearer(student.accessToken))
      .send({
        student_id: student.userId,
        items: [
          { hadith_id: h1, result: 'pass' },
          { hadith_id: h2, result: 'fail' },
        ],
      });
    assert.equal(res.status, 201);

    const { rows } = await pool.query(
      `SELECT hadith_id, mastery FROM app.progress
        WHERE student_id = $1 AND hadith_id = ANY($2::int[]) AND assignment_id IS NULL
        ORDER BY hadith_id`,
      [student.userId, [h1, h2]],
    );
    assert.equal(rows.length, 2);
  });
});

describe('GET /review-sessions/:id -- visibility', () => {
  test('an unrelated student gets 404, the owner gets 200 with items', async () => {
    const owner = await registerAndGetUserId(uniqueEmail('sessionowner'), 'student');
    const other = await registerAndGetUserId(uniqueEmail('sessionother'), 'student');
    const hadithId = await firstHadithId();

    const created = await request(app)
      .post('/review-sessions')
      .set(bearer(owner.accessToken))
      .send({ student_id: owner.userId, items: [{ hadith_id: hadithId, result: 'pass' }] });
    assert.equal(created.status, 201);
    const sessionId = created.body.data.session_id;

    const otherRes = await request(app)
      .get(`/review-sessions/${sessionId}`)
      .set(bearer(other.accessToken));
    assert.equal(otherRes.status, 404);

    const ownRes = await request(app)
      .get(`/review-sessions/${sessionId}`)
      .set(bearer(owner.accessToken));
    assert.equal(ownRes.status, 200);
    assert.ok(Array.isArray(ownRes.body.data.items));
  });
});

describe('GET /review-sessions', () => {
  test('a student lists their own sessions after posting one', async () => {
    const student = await registerAndGetUserId(uniqueEmail('listown'), 'student');
    const hadithId = await firstHadithId();

    const created = await request(app)
      .post('/review-sessions')
      .set(bearer(student.accessToken))
      .send({ student_id: student.userId, items: [{ hadith_id: hadithId, result: 'pass' }] });
    assert.equal(created.status, 201);
    const sessionId = created.body.data.session_id;

    const list = await request(app).get('/review-sessions').set(bearer(student.accessToken));
    assert.equal(list.status, 200);
    assert.ok(Array.isArray(list.body.data));
    assert.ok(list.body.data.some((s: { session_id: number }) => s.session_id === sessionId));

    const detail = await request(app)
      .get(`/review-sessions/${sessionId}`)
      .set(bearer(student.accessToken));
    assert.equal(detail.status, 200);
    assert.ok(Array.isArray(detail.body.data.items));
    assert.equal(detail.body.data.items.length, 1);
    assert.equal(detail.body.data.items[0].hadith_id, hadithId);
  });

  test('another student sees an empty list', async () => {
    const poster = await registerAndGetUserId(uniqueEmail('listposter'), 'student');
    const fresh = await registerAndGetUserId(uniqueEmail('listfresh'), 'student');
    const hadithId = await firstHadithId();

    const created = await request(app)
      .post('/review-sessions')
      .set(bearer(poster.accessToken))
      .send({ student_id: poster.userId, items: [{ hadith_id: hadithId, result: 'pass' }] });
    assert.equal(created.status, 201);

    const res = await request(app).get('/review-sessions').set(bearer(fresh.accessToken));
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.data, []);
  });

  test('GET /:id: owner 200 with items, unrelated student 404, bad id 400, missing 404, anonymous 401', async () => {
    const owner = await registerAndGetUserId(uniqueEmail('listdetail'), 'student');
    const other = await registerAndGetUserId(uniqueEmail('listdetailother'), 'student');
    const hadithId = await firstHadithId();

    const created = await request(app)
      .post('/review-sessions')
      .set(bearer(owner.accessToken))
      .send({ student_id: owner.userId, items: [{ hadith_id: hadithId, result: 'pass' }] });
    assert.equal(created.status, 201);
    const sessionId = created.body.data.session_id;

    const ownRes = await request(app)
      .get(`/review-sessions/${sessionId}`)
      .set(bearer(owner.accessToken));
    assert.equal(ownRes.status, 200);
    assert.ok(Array.isArray(ownRes.body.data.items));
    assert.equal(ownRes.body.data.items.length, 1);

    const otherRes = await request(app)
      .get(`/review-sessions/${sessionId}`)
      .set(bearer(other.accessToken));
    assert.equal(otherRes.status, 404);

    const badRes = await request(app)
      .get('/review-sessions/not-a-number')
      .set(bearer(owner.accessToken));
    assert.equal(badRes.status, 400);

    const missingRes = await request(app)
      .get('/review-sessions/999999999')
      .set(bearer(owner.accessToken));
    assert.equal(missingRes.status, 404);

    const anonList = await request(app).get('/review-sessions');
    assert.equal(anonList.status, 401);

    const anonDetail = await request(app).get(`/review-sessions/${sessionId}`);
    assert.equal(anonDetail.status, 401);
  });
});

describe('DELETE /review-sessions/:id -- delete restores the progress snapshot', () => {
  async function verifiedTeacher(tag: string): Promise<{ accessToken: string; userId: number }> {
    const email = uniqueEmail(tag);
    const { accessToken } = await registerAndGetToken(app, email, 'teacher');
    const { rows } = await pool.query<{ user_id: number }>(
      'SELECT user_id FROM app.users WHERE email = $1',
      [email],
    );
    const adminEmail = uniqueEmail(`${tag}admin`);
    const { hashPassword } = await import('../../lib/password.js');
    await pool.query(
      `INSERT INTO app.admins (email, password_hash, full_name, role, admin_level)
       VALUES ($1, $2, 'Flow Admin', 'admin', 'super')`,
      [adminEmail, await hashPassword('password123')],
    );
    const { loginAndGetToken } = await import('../../testUtils/helpers.js');
    const adminToken = await loginAndGetToken(app, adminEmail);
    await request(app).post(`/teachers/${rows[0].user_id}/verify`).set(bearer(adminToken));
    return { accessToken, userId: rows[0].user_id };
  }

  async function assignedTriple(tag: string) {
    const teacher = await verifiedTeacher(`${tag}t`);
    const student = await registerAndGetUserId(uniqueEmail(`${tag}s`), 'student');
    const hadithId = await firstHadithId();
    const circle = await request(app)
      .post('/circles')
      .set(bearer(teacher.accessToken))
      .send({ name: `Circle ${tag}` });
    const set = await request(app)
      .post('/sets')
      .set(bearer(teacher.accessToken))
      .send({ name: `Set ${tag}` });
    await request(app)
      .post(`/sets/${set.body.data.study_set_id}/items`)
      .set(bearer(teacher.accessToken))
      .send({ hadith_id: hadithId });
    await request(app)
      .post(`/circles/${circle.body.data.circle_id}/students`)
      .set(bearer(teacher.accessToken))
      .send({ student_id: student.userId });
    await request(app)
      .post('/assignments')
      .set(bearer(teacher.accessToken))
      .send({
        circle_id: circle.body.data.circle_id,
        study_set_id: set.body.data.study_set_id,
        due_date: '2027-06-01',
      });
    const { rows: found } = await pool.query<{ assignment_id: number }>(
      'SELECT assignment_id FROM app.assignments WHERE circle_id = $1 ORDER BY assignment_id DESC LIMIT 1',
      [circle.body.data.circle_id],
    );
    return { teacher, student, hadithId, assignmentId: found[0].assignment_id };
  }

  async function progressOf(studentId: number, hadithId: number) {
    const { rows } = await pool.query(
      `SELECT mastery, times_reviewed, last_reviewed, assignment_id FROM app.progress
        WHERE student_id = $1 AND hadith_id = $2`,
      [studentId, hadithId],
    );
    return rows;
  }

  test('deleting the fail session restores the pass state exactly', async () => {
    const { teacher, student, hadithId, assignmentId } = await assignedTriple('recompute');

    const pass = await request(app)
      .post('/review-sessions')
      .set(bearer(teacher.accessToken))
      .send({ student_id: student.userId, assignment_id: assignmentId, items: [{ hadith_id: hadithId, result: 'pass' }] });
    assert.equal(pass.status, 201);
    const fail = await request(app)
      .post('/review-sessions')
      .set(bearer(teacher.accessToken))
      .send({ student_id: student.userId, assignment_id: assignmentId, items: [{ hadith_id: hadithId, result: 'fail' }] });
    assert.equal(fail.status, 201);

    let rows = await progressOf(student.userId, hadithId);
    assert.equal(rows.length, 1);
    assert.equal(Number(rows[0].mastery), 0);
    assert.equal(Number(rows[0].times_reviewed), 2);

    const deleted = await request(app)
      .delete(`/review-sessions/${fail.body.data.session_id}`)
      .set(bearer(teacher.accessToken));
    assert.equal(deleted.status, 200);
    assert.equal(deleted.body.data, null);

    rows = await progressOf(student.userId, hadithId);
    assert.equal(rows.length, 1);
    assert.equal(Number(rows[0].mastery), 1);
    assert.equal(Number(rows[0].times_reviewed), 1);
    assert.ok(rows[0].last_reviewed !== null);

    const gone = await request(app)
      .get(`/review-sessions/${fail.body.data.session_id}`)
      .set(bearer(teacher.accessToken));
    assert.equal(gone.status, 404);
    const { rows: items } = await pool.query('SELECT count(*) FROM app.review_items WHERE session_id = $1', [
      fail.body.data.session_id,
    ]);
    assert.equal(Number(items[0].count), 0);
  });

  test('a student deletes their own self-study session back to zeros', async () => {
    const student = await registerAndGetUserId(uniqueEmail('selfdel'), 'student');
    const hadithId = await firstHadithId();

    const created = await request(app)
      .post('/review-sessions')
      .set(bearer(student.accessToken))
      .send({ student_id: student.userId, items: [{ hadith_id: hadithId, result: 'pass' }] });
    assert.equal(created.status, 201);

    let rows = await progressOf(student.userId, hadithId);
    assert.equal(Number(rows[0].mastery), 1);

    const deleted = await request(app)
      .delete(`/review-sessions/${created.body.data.session_id}`)
      .set(bearer(student.accessToken));
    assert.equal(deleted.status, 200);

    rows = await progressOf(student.userId, hadithId);
    assert.equal(rows.length, 1);
    assert.equal(Number(rows[0].mastery), 0);
    assert.equal(Number(rows[0].times_reviewed), 0);
    assert.equal(rows[0].last_reviewed, null);
  });

  test('a student cannot delete a teacher session (404, session intact)', async () => {
    const { teacher, student, hadithId, assignmentId } = await assignedTriple('selfguard');

    const created = await request(app)
      .post('/review-sessions')
      .set(bearer(teacher.accessToken))
      .send({ student_id: student.userId, assignment_id: assignmentId, items: [{ hadith_id: hadithId, result: 'pass' }] });
    assert.equal(created.status, 201);

    const res = await request(app)
      .delete(`/review-sessions/${created.body.data.session_id}`)
      .set(bearer(student.accessToken));
    assert.equal(res.status, 404);

    const { rows } = await pool.query('SELECT count(*) FROM app.review_sessions WHERE session_id = $1', [
      created.body.data.session_id,
    ]);
    assert.equal(Number(rows[0].count), 1);
  });

  test('with the same hadith self-studied and assigned, deleting the self session restores only its row', async () => {
    const { teacher, student, hadithId, assignmentId } = await assignedTriple('tworows');

    const self = await request(app)
      .post('/review-sessions')
      .set(bearer(student.accessToken))
      .send({ student_id: student.userId, items: [{ hadith_id: hadithId, result: 'pass' }] });
    assert.equal(self.status, 201);
    const assigned = await request(app)
      .post('/review-sessions')
      .set(bearer(teacher.accessToken))
      .send({ student_id: student.userId, assignment_id: assignmentId, items: [{ hadith_id: hadithId, result: 'pass' }] });
    assert.equal(assigned.status, 201);

    const res = await request(app)
      .delete(`/review-sessions/${self.body.data.session_id}`)
      .set(bearer(student.accessToken));
    assert.equal(res.status, 200);

    const rows = await progressOf(student.userId, hadithId);
    const selfRow = rows.find((r) => r.assignment_id === null);
    const assignedRow = rows.find((r) => r.assignment_id === assignmentId);
    assert.equal(Number(selfRow.mastery), 0);
    assert.equal(Number(selfRow.times_reviewed), 0);
    assert.equal(Number(assignedRow.mastery), 1);
    assert.equal(Number(assignedRow.times_reviewed), 1);
  });

  test('an earlier session cannot be deleted after a later review of the same row (409, nothing changes)', async () => {
    const { teacher, student, hadithId, assignmentId } = await assignedTriple('laterreview');
    const send = (result: string) =>
      request(app)
        .post('/review-sessions')
        .set(bearer(teacher.accessToken))
        .send({ student_id: student.userId, assignment_id: assignmentId, items: [{ hadith_id: hadithId, result }] });
    const first = await send('pass');
    await send('pass');

    const res = await request(app)
      .delete(`/review-sessions/${first.body.data.session_id}`)
      .set(bearer(teacher.accessToken));
    assert.equal(res.status, 409);

    const rows = await progressOf(student.userId, hadithId);
    assert.equal(Number(rows[0].mastery), 2);
    assert.equal(Number(rows[0].times_reviewed), 2);
  });

  test('a teacher override made before the session survives its delete', async () => {
    const { teacher, student, hadithId, assignmentId } = await assignedTriple('overridekeep');
    const { rows: pr } = await pool.query<{ progress_id: number }>(
      'SELECT progress_id FROM app.progress WHERE student_id = $1 AND assignment_id = $2',
      [student.userId, assignmentId],
    );
    const patched = await request(app)
      .patch(`/progress/${pr[0].progress_id}`)
      .set(bearer(teacher.accessToken))
      .send({ mastery: 3 });
    assert.equal(patched.status, 200);

    const session = await request(app)
      .post('/review-sessions')
      .set(bearer(teacher.accessToken))
      .send({ student_id: student.userId, assignment_id: assignmentId, items: [{ hadith_id: hadithId, result: 'fail' }] });
    assert.equal(session.status, 201);

    const res = await request(app)
      .delete(`/review-sessions/${session.body.data.session_id}`)
      .set(bearer(teacher.accessToken));
    assert.equal(res.status, 200);

    const rows = await progressOf(student.userId, hadithId);
    assert.equal(Number(rows[0].mastery), 3);
    assert.equal(Number(rows[0].times_reviewed), 0);
  });

  test('a teacher override made after the session blocks its delete (409, override kept)', async () => {
    const { teacher, student, hadithId, assignmentId } = await assignedTriple('overrideafter');
    const session = await request(app)
      .post('/review-sessions')
      .set(bearer(teacher.accessToken))
      .send({ student_id: student.userId, assignment_id: assignmentId, items: [{ hadith_id: hadithId, result: 'pass' }] });
    const { rows: pr } = await pool.query<{ progress_id: number }>(
      'SELECT progress_id FROM app.progress WHERE student_id = $1 AND assignment_id = $2',
      [student.userId, assignmentId],
    );
    await request(app).patch(`/progress/${pr[0].progress_id}`).set(bearer(teacher.accessToken)).send({ mastery: 4 });

    const res = await request(app)
      .delete(`/review-sessions/${session.body.data.session_id}`)
      .set(bearer(teacher.accessToken));
    assert.equal(res.status, 409);

    const rows = await progressOf(student.userId, hadithId);
    assert.equal(Number(rows[0].mastery), 4);
  });

  test('a session recorded before undo was stored cannot be deleted (409)', async () => {
    const { teacher, student, hadithId, assignmentId } = await assignedTriple('legacy');
    const session = await request(app)
      .post('/review-sessions')
      .set(bearer(teacher.accessToken))
      .send({ student_id: student.userId, assignment_id: assignmentId, items: [{ hadith_id: hadithId, result: 'pass' }] });
    await pool.query(
      'UPDATE app.review_items SET prev_mastery = NULL, prev_times_reviewed = NULL WHERE session_id = $1',
      [session.body.data.session_id],
    );

    const res = await request(app)
      .delete(`/review-sessions/${session.body.data.session_id}`)
      .set(bearer(teacher.accessToken));
    assert.equal(res.status, 409);
  });

  test('an unknown session id is 404', async () => {
    const teacher = await verifiedTeacher('delunknown');
    const res = await request(app)
      .delete('/review-sessions/999999')
      .set(bearer(teacher.accessToken));
    assert.equal(res.status, 404);
  });
});
