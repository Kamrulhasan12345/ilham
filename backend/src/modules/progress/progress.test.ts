import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../../app.js';
import { pool } from '../../db/pool.js';
import { hashPassword } from '../../lib/password.js';
import { bearer, loginAndGetToken, registerAndGetToken, uniqueEmail } from '../../testUtils/helpers.js';


async function firstHadithId(): Promise<number> {
  const { rows } = await pool.query<{ hadith_id: number }>(
    'SELECT hadith_id FROM corpus.hadiths ORDER BY hadith_id LIMIT 1',
  );
  return rows[0].hadith_id;
}

async function seedAdmin(tag: string): Promise<string> {
  const email = uniqueEmail(tag);
  await pool.query(
    `INSERT INTO app.admins (email, password_hash, full_name, role, admin_level)
     VALUES ($1, $2, 'Admin', 'admin', 'super')`,
    [email, await hashPassword('password123')],
  );
  return loginAndGetToken(app, email);
}

async function verifiedTeacherWithCircle(
  tag: string,
): Promise<{ accessToken: string; userId: number; circleId: number }> {
  const email = uniqueEmail(tag);
  const { accessToken } = await registerAndGetToken(app, email, 'teacher');
  const { rows } = await pool.query<{ user_id: number }>(
    'SELECT user_id FROM app.users WHERE email = $1',
    [email],
  );
  const adminToken = await seedAdmin(`${tag}admin`);
  await request(app).post(`/teachers/${rows[0].user_id}/verify`).set(bearer(adminToken));

  const circle = await request(app)
    .post('/circles')
    .set(bearer(accessToken))
    .send({ name: `Circle ${tag}` });

  return { accessToken, userId: rows[0].user_id, circleId: circle.body.data.circle_id };
}

async function enrollStudentAndAssign(
  teacherToken: string,
  circleId: number,
): Promise<{ studentEmail: string; studentId: number; assignmentId: number; hadithId: number }> {
  const studentEmail = uniqueEmail('progstudent');
  await registerAndGetToken(app, studentEmail, 'student');
  const { rows: studentRows } = await pool.query<{ user_id: number }>(
    'SELECT user_id FROM app.users WHERE email = $1',
    [studentEmail],
  );
  const studentId = studentRows[0].user_id;

  await request(app)
    .post(`/circles/${circleId}/students`)
    .set(bearer(teacherToken))
    .send({ student_id: studentId });

  const studySet = await request(app)
    .post('/study-sets')
    .set(bearer(teacherToken))
    .send({ name: `Override test set ${circleId}` });
  const studySetId = studySet.body.data.study_set_id;

  await request(app)
    .post('/assignments')
    .set(bearer(teacherToken))
    .send({ circle_id: circleId, study_set_id: studySetId, due_date: '2027-01-01' });
  const { rows: assignmentRows } = await pool.query<{ assignment_id: number }>(
    'SELECT assignment_id FROM app.assignments WHERE circle_id = $1 ORDER BY assignment_id DESC LIMIT 1',
    [circleId],
  );
  const assignmentId = assignmentRows[0].assignment_id;
  const hadithId = await firstHadithId();

  await request(app)
    .post('/review-sessions')
    .set(bearer(teacherToken))
    .send({
      student_id: studentId,
      assignment_id: assignmentId,
      circle_id: circleId,
      items: [{ hadith_id: hadithId, result: 'pass' }],
    });

  return { studentEmail, studentId, assignmentId, hadithId };
}

describe('PATCH /progress/:progressId -- the override flow', () => {
  test('the owning teacher can override mastery on an assignment-linked row', async () => {
    const teacher = await verifiedTeacherWithCircle('overrideok');
    const { studentId, assignmentId } = await enrollStudentAndAssign(teacher.accessToken, teacher.circleId);

    const { rows } = await pool.query<{ progress_id: number }>(
      `SELECT progress_id FROM app.progress WHERE student_id = $1 AND assignment_id = $2`,
      [studentId, assignmentId],
    );
    assert.equal(rows.length, 1, 'expected the seeded review to have created one progress row');
    const progressId = rows[0].progress_id;

    const res = await request(app)
      .patch(`/progress/${progressId}`)
      .set(bearer(teacher.accessToken))
      .send({ mastery: 3 });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.mastery, 3);
  });

  test('PRD §5.10 rule: a teacher may NOT override a self-study row (assignment_id IS NULL) -- 422', async () => {
    const teacher = await verifiedTeacherWithCircle('overrideself');
    const studentEmail = uniqueEmail('selfstudyoverride');
    const student = await registerAndGetToken(app, studentEmail, 'student');
    const { rows: userRows } = await pool.query<{ user_id: number }>(
      'SELECT user_id FROM app.users WHERE email = $1',
      [studentEmail],
    );
    const studentId = userRows[0].user_id;
    const hadithId = await firstHadithId();

    await request(app)
      .post('/review-sessions')
      .set(bearer(student.accessToken))
      .send({ student_id: studentId, items: [{ hadith_id: hadithId, result: 'pass' }] });

    const { rows } = await pool.query<{ progress_id: number }>(
      `SELECT progress_id FROM app.progress WHERE student_id = $1 AND assignment_id IS NULL`,
      [studentId],
    );
    assert.equal(rows.length, 1);
    const progressId = rows[0].progress_id;

    const res = await request(app)
      .patch(`/progress/${progressId}`)
      .set(bearer(teacher.accessToken))
      .send({ mastery: 4 });
    assert.equal(res.status, 422);
  });

  test('a teacher who does not own the circle cannot override that circle\'s progress rows', async () => {
    const owner = await verifiedTeacherWithCircle('overrideowner');
    const intruder = await verifiedTeacherWithCircle('overrideintruder');
    const { studentId, assignmentId } = await enrollStudentAndAssign(owner.accessToken, owner.circleId);

    const { rows } = await pool.query<{ progress_id: number }>(
      `SELECT progress_id FROM app.progress WHERE student_id = $1 AND assignment_id = $2`,
      [studentId, assignmentId],
    );
    const progressId = rows[0].progress_id;

    const res = await request(app)
      .patch(`/progress/${progressId}`)
      .set(bearer(intruder.accessToken))
      .send({ mastery: 4 });
    assert.equal(res.status, 403);
  });

  test('overriding mastery fires trg_progress_audit with the correct changed_by', async () => {
    const teacher = await verifiedTeacherWithCircle('auditcheck');
    const { studentId, assignmentId } = await enrollStudentAndAssign(teacher.accessToken, teacher.circleId);

    const { rows: progressRows } = await pool.query<{ progress_id: number }>(
      `SELECT progress_id FROM app.progress WHERE student_id = $1 AND assignment_id = $2`,
      [studentId, assignmentId],
    );
    const progressId = progressRows[0].progress_id;

    await request(app)
      .patch(`/progress/${progressId}`)
      .set(bearer(teacher.accessToken))
      .send({ mastery: 2 });

    const { rows: auditRows } = await pool.query(
      `SELECT changed_by, new_value->>'mastery' AS new_mastery FROM app.audit_log
        WHERE table_name = 'app.progress' AND row_key = $1 ORDER BY changed_at DESC LIMIT 1`,
      [String(progressId)],
    );
    assert.equal(auditRows.length, 1, 'expected trg_progress_audit to have written a row');
    assert.equal(Number(auditRows[0].changed_by), teacher.userId);
    assert.equal(Number(auditRows[0].new_mastery), 2);
  });

  test('rejects a mastery value outside 0-4 with 400', async () => {
    const teacher = await verifiedTeacherWithCircle('overridebad');
    const { studentId, assignmentId } = await enrollStudentAndAssign(teacher.accessToken, teacher.circleId);
    const { rows } = await pool.query<{ progress_id: number }>(
      `SELECT progress_id FROM app.progress WHERE student_id = $1 AND assignment_id = $2`,
      [studentId, assignmentId],
    );
    const res = await request(app)
      .patch(`/progress/${rows[0].progress_id}`)
      .set(bearer(teacher.accessToken))
      .send({ mastery: 99 });
    assert.equal(res.status, 400);
  });
});

describe('GET /progress/audit-log -- admin only', () => {
  test('a teacher (non-admin) gets 403', async () => {
    const teacher = await verifiedTeacherWithCircle('auditforbidden');
    const res = await request(app).get('/progress/audit-log').set(bearer(teacher.accessToken));
    assert.equal(res.status, 403);
  });

  test('an admin gets 200 with a paged array', async () => {
    const adminToken = await seedAdmin('auditadmin');
    const res = await request(app).get('/progress/audit-log').set(bearer(adminToken));
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.data));
  });
});
