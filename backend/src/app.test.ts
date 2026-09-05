import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { app } from './app.js';

// These tests hit the real dev database (this scaffold has no mocking
// layer). Each register call uses a randomized email so re-running the
// suite never collides with rows from a previous run.
function uniqueEmail(tag: string): string {
  return `test-${tag}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
}

function extractCookie(res: Response): string {
  const raw = res.headers.get('set-cookie');
  assert.ok(raw, 'expected a Set-Cookie header');
  return raw!.split(';')[0];
}

describe('guarded route prefixes', () => {
  for (const prefix of ['/collections', '/chapters', '/hadiths', '/narrators']) {
    test(`${prefix} rejects an unauthenticated request with 401`, async () => {
      const res = await app.request(prefix);
      assert.equal(res.status, 401);
      const body = (await res.json()) as { error: { code: string } };
      assert.equal(body.error.code, 'unauthenticated');
    });
  }
});

describe('register', () => {
  test('rejects a public request for role "admin" with 400', async () => {
    const res = await app.request('/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: uniqueEmail('admin'),
        password: 'password123',
        full_name: 'Would-be Admin',
        role: 'admin',
      }),
    });
    assert.equal(res.status, 400);
  });

  test('a duplicate email returns 409 via the assert_email_unique trigger', async () => {
    const email = uniqueEmail('dup');
    const payload = JSON.stringify({
      email,
      password: 'password123',
      full_name: 'Duplicate Person',
      role: 'student',
    });

    const first = await app.request('/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: payload,
    });
    assert.equal(first.status, 201);

    const second = await app.request('/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: payload,
    });
    assert.equal(second.status, 409);
    const body = (await second.json()) as { error: { code: string } };
    assert.equal(body.error.code, 'conflict');
  });
});

describe('register -> logout -> refresh', () => {
  test('refresh succeeds once, then fails after logout (server-side revocation)', async () => {
    const registerRes = await app.request('/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: uniqueEmail('session'),
        password: 'password123',
        full_name: 'Session Person',
        role: 'student',
      }),
    });
    assert.equal(registerRes.status, 201);
    const refreshCookie = extractCookie(registerRes);

    const refreshRes = await app.request('/auth/refresh', {
      method: 'POST',
      headers: { cookie: refreshCookie },
    });
    assert.equal(refreshRes.status, 200);
    const refreshBody = (await refreshRes.json()) as { data: { accessToken: string } };
    assert.ok(refreshBody.data.accessToken);

    const logoutRes = await app.request('/auth/logout', {
      method: 'POST',
      headers: { cookie: refreshCookie },
    });
    assert.equal(logoutRes.status, 200);

    const refreshAfterLogout = await app.request('/auth/refresh', {
      method: 'POST',
      headers: { cookie: refreshCookie },
    });
    assert.equal(refreshAfterLogout.status, 401);
  });
});
