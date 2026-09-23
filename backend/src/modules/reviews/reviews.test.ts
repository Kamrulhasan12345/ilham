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
