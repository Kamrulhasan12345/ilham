import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from './app.js';
import { pool } from './db/pool.js';
import { extractCookie, fakeIp, uniqueEmail } from './testUtils/helpers.js';


describe('guarded route prefixes', () => {
  for (const prefix of ['/collections', '/chapters', '/hadiths', '/narrators', '/analytics', '/circles', '/study-sets', '/assignments', '/review-sessions', '/progress', '/notes', '/meta', '/students']) {
    test(`${prefix} rejects an unauthenticated request with 401`, async () => {
      const res = await request(app).get(prefix);
      assert.equal(res.status, 401);
      assert.equal(res.body.error.code, 'unauthenticated');
    });
  }

  test('/teachers rejects an unauthenticated request with 401, not 403', async () => {
    const res = await request(app).get('/teachers/unverified');
    assert.equal(res.status, 401);
    assert.equal(res.body.error.code, 'unauthenticated');
  });
});

describe('register', () => {
  test('rejects a public request for role "admin" with 400', async () => {
    const res = await request(app)
      .post('/auth/register')
      .set('x-forwarded-for', fakeIp())
      .send({
        email: uniqueEmail('admin'),
        password: 'password123',
        full_name: 'Would-be Admin',
        role: 'admin',
      });
    assert.equal(res.status, 400);
  });

  test('rejects a password under 8 characters with 400', async () => {
    const res = await request(app)
      .post('/auth/register')
      .set('x-forwarded-for', fakeIp())
      .send({ email: uniqueEmail('short'), password: 'short', full_name: 'X', role: 'student' });
    assert.equal(res.status, 400);
  });

  test('a duplicate email returns 409 via the assert_email_unique trigger', async () => {
    const email = uniqueEmail('dup');
    const payload = {
      email,
      password: 'password123',
      full_name: 'Duplicate Person',
      role: 'student' as const,
    };

    const first = await request(app).post('/auth/register').set('x-forwarded-for', fakeIp()).send(payload);
    assert.equal(first.status, 201);

    const second = await request(app).post('/auth/register').set('x-forwarded-for', fakeIp()).send(payload);
    assert.equal(second.status, 409);
    assert.equal(second.body.error.code, 'conflict');
  });

  test('a new student starts unverified-not-applicable and gets a usable access token immediately', async () => {
    const res = await request(app)
      .post('/auth/register')
      .set('x-forwarded-for', fakeIp())
      .send({
        email: uniqueEmail('immediate'),
        password: 'password123',
        full_name: 'Immediate Student',
        role: 'student',
      });
    assert.equal(res.status, 201);
    assert.ok(res.body.data.accessToken);

    const me = await request(app).get('/auth/me').set('authorization', `Bearer ${res.body.data.accessToken}`);
    assert.equal(me.status, 200);
    assert.equal(me.body.data.role, 'student');
  });
});

describe('register -> logout -> refresh', () => {
  test('refresh succeeds once, then fails after logout (server-side revocation)', async () => {
    const registerRes = await request(app)
      .post('/auth/register')
      .set('x-forwarded-for', fakeIp())
      .send({
        email: uniqueEmail('session'),
        password: 'password123',
        full_name: 'Session Person',
        role: 'student',
      });
    assert.equal(registerRes.status, 201);
    const refreshCookie = extractCookie(registerRes);

    const refreshRes = await request(app).post('/auth/refresh').set('Cookie', refreshCookie);
    assert.equal(refreshRes.status, 200);
    assert.ok(refreshRes.body.data.accessToken);

    const logoutRes = await request(app).post('/auth/logout').set('Cookie', refreshCookie);
    assert.equal(logoutRes.status, 200);

    const refreshAfterLogout = await request(app).post('/auth/refresh').set('Cookie', refreshCookie);
    assert.equal(refreshAfterLogout.status, 401);
  });

  test('refresh without any cookie returns 401, not a crash', async () => {
    const res = await request(app).post('/auth/refresh');
    assert.equal(res.status, 401);
    assert.equal(res.body.error.code, 'unauthenticated');
  });
});

describe('login', () => {
  test('wrong password returns 401 with a generic message (no user-enumeration hint)', async () => {
    const email = uniqueEmail('wrongpw');
    await request(app)
      .post('/auth/register')
      .set('x-forwarded-for', fakeIp())
      .send({ email, password: 'password123', full_name: 'X', role: 'student' });

    const res = await request(app)
      .post('/auth/login')
      .set('x-forwarded-for', fakeIp())
      .send({ email, password: 'totally-wrong' });
    assert.equal(res.status, 401);
    assert.equal(res.body.error.code, 'unauthenticated');
  });

  test('a nonexistent email returns the SAME 401/message as a wrong password (timing-oracle defense)', async () => {
    const res = await request(app)
      .post('/auth/login')
      .set('x-forwarded-for', fakeIp())
      .send({ email: uniqueEmail('doesnotexist'), password: 'whatever123' });
    assert.equal(res.status, 401);
    assert.equal(res.body.error.code, 'unauthenticated');
  });
});

describe('login/register rate limiting (PRD §2.8)', () => {
  test('the limiter keys by X-Forwarded-For, not the shared test-runner socket address', async () => {
    const ipA = fakeIp();
    const ipB = fakeIp();

    for (let i = 0; i < 5; i++) {
      const res = await request(app)
        .post('/auth/register')
        .set('x-forwarded-for', ipA)
        .send({ email: uniqueEmail(`ratea${i}`), password: 'password123', full_name: 'X', role: 'student' });
      assert.notEqual(res.status, 429, `request ${i + 1} from ipA was rate limited too early`);
    }

    const sixthFromA = await request(app)
      .post('/auth/register')
      .set('x-forwarded-for', ipA)
      .send({ email: uniqueEmail('ratea5'), password: 'password123', full_name: 'X', role: 'student' });
    assert.equal(sixthFromA.status, 429);

    const firstFromB = await request(app)
      .post('/auth/register')
      .set('x-forwarded-for', ipB)
      .send({ email: uniqueEmail('rateb0'), password: 'password123', full_name: 'X', role: 'student' });
    assert.notEqual(firstFromB.status, 429, 'a different IP must not share ipA\'s rate-limit bucket');
  });
});

describe('the permission test (PRD §11 week 8 gate)', () => {
  test('ilham_app cannot write to corpus.* -- INSERT fails with 42501', async () => {
    await assert.rejects(
      pool.query(
        `INSERT INTO corpus.hadiths (collection_id, hadith_num, text_plain, text_diac, sanad_count)
         VALUES (1, 'test-should-never-land', 'x', 'x', 0)`,
      ),
      (err: unknown) => {
        const pgErr = err as { code?: string };
        assert.equal(pgErr.code, '42501');
        return true;
      },
    );
  });
});
