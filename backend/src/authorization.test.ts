import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { app } from './app.js';
import { pool } from './db/pool.js';
import { hashPassword } from './lib/password.js';

// The 60% evaluation checks, against the real dev database:
// - 401 for unauthenticated requests,
// - 403 when a role touches another role's capability,
// - object-level ownership (one user's note is invisible to another),
// - login as every role, including an admin created directly in app.admins
//   (admins never self-register: POST /auth/register rejects role "admin").
function uniqueEmail(tag: string): string {
  return `test-authz-${tag}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
}

// The login/register limiter allows 5 requests per minute per IP. Each test
// call sends its own address so the suite never trips it; production
// behavior is unchanged.
function fakeIp(): string {
  return `10.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}`;
}

async function register(email: string, role: 'student' | 'teacher'): Promise<string> {
  const res = await app.request('/auth/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': fakeIp() },
    body: JSON.stringify({ email, password: 'password123', full_name: `${role} Person`, role }),
  });
  assert.equal(res.status, 201);
  const body = (await res.json()) as { data: { accessToken: string } };
  return body.data.accessToken;
}

async function login(email: string): Promise<string> {
  const res = await app.request('/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': fakeIp() },
    body: JSON.stringify({ email, password: 'password123' }),
  });
  assert.equal(res.status, 200);
  const body = (await res.json()) as { data: { accessToken: string } };
  return body.data.accessToken;
}

function bearer(token: string): Record<string, string> {
  return { authorization: `Bearer ${token}` };
}

describe('unauthenticated requests get 401', () => {
  for (const [method, path] of [
    ['GET', '/circles'],
    ['POST', '/circles'],
    ['GET', '/notes'],
    ['GET', '/students'],
    ['GET', '/teachers/unverified'],
  ] as const) {
    test(`${method} ${path} without a token`, async () => {
      const res = await app.request(path, { method });
      assert.equal(res.status, 401);
      const body = (await res.json()) as { error: { code: string } };
      assert.equal(body.error.code, 'unauthenticated');
    });
  }
});

describe('cross-role access is blocked with 403', () => {
  test('a student cannot open a circle (teacher-only)', async () => {
    const token = await register(uniqueEmail('stud'), 'student');
    const res = await app.request('/circles', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...bearer(token) },
      body: JSON.stringify({ name: 'Sneaky circle' }),
    });
    assert.equal(res.status, 403);
  });

  test('a student cannot read the teacher verification queue (admin-only)', async () => {
    const token = await register(uniqueEmail('stud2'), 'student');
    const res = await app.request('/teachers/unverified', { headers: bearer(token) });
    assert.equal(res.status, 403);
  });

  test('a teacher cannot read the verification queue either', async () => {
    const token = await register(uniqueEmail('teach'), 'teacher');
    const res = await app.request('/teachers/unverified', { headers: bearer(token) });
    assert.equal(res.status, 403);
  });

  test('an unverified teacher cannot open a circle yet', async () => {
    const token = await register(uniqueEmail('teach2'), 'teacher');
    const res = await app.request('/circles', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...bearer(token) },
      body: JSON.stringify({ name: 'Too early' }),
    });
    assert.equal(res.status, 403);
    const body = (await res.json()) as { error: { code: string } };
    assert.equal(body.error.code, 'teacher_not_verified');
  });
});

describe('object-level ownership on notes', () => {
  test("one student cannot read, change, or delete another student's note", async () => {
    const tokenA = await register(uniqueEmail('noteA'), 'student');
    const tokenB = await register(uniqueEmail('noteB'), 'student');

    // hadith_id 1 does not exist in every database; read a real one.
    const { rows: hadithRows } = await pool.query<{ hadith_id: number }>(
      'SELECT hadith_id FROM corpus.hadiths ORDER BY hadith_id LIMIT 1',
    );
    assert.ok(hadithRows[0], 'expected at least one hadith in the corpus');

    const created = await app.request('/notes', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...bearer(tokenA) },
      body: JSON.stringify({ hadith_id: hadithRows[0].hadith_id, body: 'private note' }),
    });
    assert.equal(created.status, 201);
    const { data: note } = (await created.json()) as { data: { note_id: number } };

    // B's list does not contain A's note.
    const listB = await app.request('/notes', { headers: bearer(tokenB) });
    const { data: notesB } = (await listB.json()) as { data: { note_id: number }[] };
    assert.ok(!notesB.some((n) => n.note_id === note.note_id));

    // B touching A's note by id gets 404, not 403: the response never
    // confirms the row exists.
    const patch = await app.request(`/notes/${note.note_id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', ...bearer(tokenB) },
      body: JSON.stringify({ body: 'hijacked' }),
    });
    assert.equal(patch.status, 404);

    const del = await app.request(`/notes/${note.note_id}`, {
      method: 'DELETE',
      headers: bearer(tokenB),
    });
    assert.equal(del.status, 404);
  });
});

describe('teachers and admins can list students, students cannot', () => {
  test('a new student starts at beginner level', async () => {
    const teacherToken = await register(uniqueEmail('teachlvl'), 'teacher');
    const studentEmail = uniqueEmail('studlvl');
    await register(studentEmail, 'student');

    const res = await app.request('/students', { headers: bearer(teacherToken) });
    assert.equal(res.status, 200);
    const { data } = (await res.json()) as {
      data: { email: string; student_level: string | null }[];
    };
    const row = data.find((s) => s.email === studentEmail);
    assert.ok(row, 'expected the new student in the teacher list');
    assert.equal(row.student_level, 'beginner');
  });

  test('teacher and admin get 200, student gets 403', async () => {
    const teacherToken = await register(uniqueEmail('teachlist'), 'teacher');
    const studentToken = await register(uniqueEmail('studlist'), 'student');

    const adminEmail = uniqueEmail('adminlist');
    await pool.query(
      `INSERT INTO app.admins (email, password_hash, full_name, role, admin_level)
       VALUES ($1, $2, 'List Admin', 'admin', 'super')`,
      [adminEmail, await hashPassword('password123')],
    );
    const adminToken = await login(adminEmail);

    for (const token of [teacherToken, adminToken]) {
      const res = await app.request('/students', { headers: bearer(token) });
      assert.equal(res.status, 200);
      const { data } = (await res.json()) as { data: { user_id: number }[] };
      assert.ok(Array.isArray(data));
    }

    const denied = await app.request('/students', { headers: bearer(studentToken) });
    assert.equal(denied.status, 403);
  });
});

describe('every role can log in, and the verified-teacher flow works end to end', () => {
  test('admin (seeded in app.admins) -> verify teacher -> teacher opens circle', async () => {
    const adminEmail = uniqueEmail('admin');
    await pool.query(
      `INSERT INTO app.admins (email, password_hash, full_name, role, admin_level)
       VALUES ($1, $2, 'Demo Admin', 'admin', 'super')`,
      [adminEmail, await hashPassword('password123')],
    );
    const adminToken = await login(adminEmail);

    const me = await app.request('/auth/me', { headers: bearer(adminToken) });
    assert.equal(me.status, 200);
    assert.equal(((await me.json()) as { data: { role: string } }).data.role, 'admin');

    const teacherEmail = uniqueEmail('teachflow');
    const teacherToken = await register(teacherEmail, 'teacher');
    const { rows } = await pool.query<{ user_id: number }>(
      'SELECT user_id FROM app.users WHERE email = $1',
      [teacherEmail],
    );

    const queue = await app.request('/teachers/unverified', { headers: bearer(adminToken) });
    assert.equal(queue.status, 200);
    const { data: queued } = (await queue.json()) as { data: { user_id: number }[] };
    assert.ok(queued.some((t) => t.user_id === rows[0].user_id));

    const verify = await app.request(`/teachers/${rows[0].user_id}/verify`, {
      method: 'POST',
      headers: bearer(adminToken),
    });
    assert.equal(verify.status, 200);

    const circle = await app.request('/circles', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...bearer(teacherToken) },
      body: JSON.stringify({ name: 'First halaqa' }),
    });
    assert.equal(circle.status, 201);

    const list = await app.request('/circles', { headers: bearer(teacherToken) });
    const { data: circles } = (await list.json()) as { data: { name: string }[] };
    assert.ok(circles.some((c) => c.name === 'First halaqa'));
  });
});
