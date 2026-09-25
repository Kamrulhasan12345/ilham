import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../../app.js';
import { pool } from '../../db/pool.js';
import { hashPassword } from '../../lib/password.js';
import { bearer, loginAndGetToken, registerAndGetToken, uniqueEmail } from '../../testUtils/helpers.js';

async function verifiedTeacher(tag: string): Promise<{ accessToken: string }> {
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
  return { accessToken };
}

describe('GET /students?q=', () => {
  test('an email fragment narrows the directory; empty q lists all', async () => {
    const teacher = await verifiedTeacher('studentsearch');
    const marker = uniqueEmail('needle').split('@')[0];
    await registerAndGetToken(app, `${marker}@example.com`, 'student');
    await registerAndGetToken(app, uniqueEmail('other'), 'student');

    const narrowed = await request(app)
      .get(`/students?q=${marker}`)
      .set(bearer(teacher.accessToken));
    assert.equal(narrowed.status, 200);
    assert.ok(narrowed.body.data.length >= 1);
    assert.ok(
      narrowed.body.data.every((s: { email: string }) => s.email.includes(marker)),
    );

    const all = await request(app).get('/students').set(bearer(teacher.accessToken));
    assert.equal(all.status, 200);
    assert.ok(all.body.data.length > narrowed.body.data.length);

    const none = await request(app)
      .get('/students?q=no-such-student-zzz')
      .set(bearer(teacher.accessToken));
    assert.equal(none.status, 200);
    assert.deepEqual(none.body.data, []);
  });

  test('a student caller still gets 403, filtered or not', async () => {
    const { accessToken } = await registerAndGetToken(app, uniqueEmail('searchstudent'), 'student');

    const res = await request(app).get('/students?q=a').set(bearer(accessToken));
    assert.equal(res.status, 403);
  });
});
