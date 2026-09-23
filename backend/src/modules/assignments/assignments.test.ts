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

async function makeCircleAndStudySet(
  teacherToken: string,
): Promise<{ circleId: number; studySetId: number }> {
  const circle = await request(app)
    .post('/circles')
    .set(bearer(teacherToken))
    .send({ name: `Circle ${uniqueEmail('c')}` });
  const studySet = await request(app)
    .post('/study-sets')
    .set(bearer(teacherToken))
    .send({ name: `Set ${uniqueEmail('s')}` });
  return { circleId: circle.body.data.circle_id, studySetId: studySet.body.data.study_set_id };
}

describe('POST /assignments -- the CALL app.assign_study_set procedure pattern', () => {
  test('a verified teacher can assign a study set to their own circle', async () => {
    const teacher = await verifiedTeacher('assignok');
    const { circleId, studySetId } = await makeCircleAndStudySet(teacher.accessToken);

    const res = await request(app)
      .post('/assignments')
      .set(bearer(teacher.accessToken))
      .send({ circle_id: circleId, study_set_id: studySetId, due_date: '2027-06-01' });

    assert.equal(res.status, 201);
    assert.equal(res.body.data.circle_id, circleId);
    assert.equal(res.body.data.study_set_id, studySetId);
  });

  test('PRD §5.8 rule: calling twice with the same args creates TWO assignments, not a conflict', async () => {
    const teacher = await verifiedTeacher('assigntwice');
    const { circleId, studySetId } = await makeCircleAndStudySet(teacher.accessToken);
    const payload = { circle_id: circleId, study_set_id: studySetId, due_date: '2027-06-01' };

    const first = await request(app).post('/assignments').set(bearer(teacher.accessToken)).send(payload);
    assert.equal(first.status, 201);

    const second = await request(app).post('/assignments').set(bearer(teacher.accessToken)).send(payload);
    assert.equal(second.status, 201);

    const { rows } = await pool.query(
      'SELECT count(*) FROM app.assignments WHERE circle_id = $1 AND study_set_id = $2',
      [circleId, studySetId],
    );
    assert.equal(Number(rows[0].count), 2);
  });

  test('PRD §5.8 rule: ownership is checked BEFORE the CALL -- a teacher cannot assign into a circle they do not own', async () => {
    const owner = await verifiedTeacher('assignowner');
    const intruder = await verifiedTeacher('assignintruder');
    const { circleId, studySetId } = await makeCircleAndStudySet(owner.accessToken);

    const res = await request(app)
      .post('/assignments')
      .set(bearer(intruder.accessToken))
      .send({ circle_id: circleId, study_set_id: studySetId, due_date: '2027-06-01' });

    assert.equal(res.status, 403);

    const { rows } = await pool.query('SELECT count(*) FROM app.assignments WHERE circle_id = $1', [
      circleId,
    ]);
    assert.equal(Number(rows[0].count), 0);
  });

  test('rejects a non-integer circle_id/study_set_id with 400 before ever reaching the database', async () => {
    const teacher = await verifiedTeacher('assignbad');
    const res = await request(app)
      .post('/assignments')
      .set(bearer(teacher.accessToken))
      .send({ circle_id: 'not-a-number', study_set_id: 1, due_date: '2027-01-01' });
    assert.equal(res.status, 400);
  });

  test('GET /assignments/:id/completion is owner-only (403 for a non-owning teacher)', async () => {
    const owner = await verifiedTeacher('completionowner');
    const intruder = await verifiedTeacher('completionintruder');
    const { circleId, studySetId } = await makeCircleAndStudySet(owner.accessToken);

    const created = await request(app)
      .post('/assignments')
      .set(bearer(owner.accessToken))
      .send({ circle_id: circleId, study_set_id: studySetId, due_date: '2027-06-01' });
    assert.equal(created.status, 201);

    const { rows } = await pool.query<{ assignment_id: number }>(
      'SELECT assignment_id FROM app.assignments WHERE circle_id = $1 ORDER BY assignment_id DESC LIMIT 1',
      [circleId],
    );
    const assignmentId = rows[0].assignment_id;

    const ownerRes = await request(app)
      .get(`/assignments/${assignmentId}/completion`)
      .set(bearer(owner.accessToken));
    assert.equal(ownerRes.status, 200);

    const intruderRes = await request(app)
      .get(`/assignments/${assignmentId}/completion`)
      .set(bearer(intruder.accessToken));
    assert.equal(intruderRes.status, 403);
  });
});
